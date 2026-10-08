#!/usr/bin/env node
/**
 * skey — токены живут в системном хранилище, а не в контексте модели.
 *
 * Ассистент видит только имена переменных и запускает команды через `run`.
 * Значение он не может ни прочитать, ни положить: `set` требует ввода с
 * клавиатуры, `export` — подтверждения с настоящего терминала.
 */

import { createInterface } from 'node:readline'
import { list, set, remove, get, has, NAME_PATTERN } from './store.js'
import { run } from './run.js'
import { startUi, serveRequest } from './ui.js'
import { writeDotenv } from './dotenv.js'
import {
  createRequest, loadRequest, pendingRequests, mark, progress, waitFor, summary, clearRequest, clearAllRequests,
  allRequestIds, type KeyRequest, type Field,
} from './request.js'
import { DEFAULT_RELAY, share, pullAnswer, importBlob, closeRemote, openLink, sendAnswer } from './remote.js'

const USAGE = `skey — keep API tokens out of your assistant's context

  skey ui [--no-open]          manage keys in the browser
  skey set <NAME>              store a secret (typed, not pasted as an argument)
  skey list                    names and when they changed — never values
  skey rm <NAME...>            delete one or more
  skey run --only A,B -- cmd   run a command with those secrets in its environment
  skey export <NAME>           print a value — needs a real terminal, refuses otherwise

Asking a person for keys (for assistants):
  skey request A "B:Label" "C?:Optional label" --note "why"
                               prints a browser link and an ID, waits until filled
  skey fill [ID]               fill a request in the terminal, field by field
  skey wait <ID>               wait for a request created earlier
  skey clean <ID>              delete the request and the keys it created

Asking someone on another computer (end-to-end encrypted):
  skey request A B --share     also prints a link that works from anywhere
      --from "Name"            who is asking, shown on their page (default: git user.name)
      --ttl <hours>            how long the link works (default 24, max 168)
      --offline                no server: they send back an encrypted reply text
  skey fill "<link>"           answer someone's link in the terminal
  skey import <skey1.…>        take an encrypted reply someone sent back

Moving keys where they belong, without reading them:
  skey dotenv <file> --only A,B=STORED    write into a .env file (upsert)
  skey run --stdin NAME -- cmd            pipe a value into a command's stdin
  skey run --only VAR=STORED -- cmd       expose a key under another variable name

Everything is stored in this machine's keychain. Nothing is written to disk in
the clear, and values never appear in output: the run command masks them if the
program prints them back.`

/** Ввод без эха: значение не должно остаться на экране и в истории терминала. */
function prompt(question: string, hidden: boolean): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })

    if (hidden) {
      const output = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput: (s: string) => void }
      output._writeToOutput = (chunk: string) => {
        // Печатаем только сам вопрос, ввод глотаем.
        if (chunk.includes(question)) output.output.write(chunk)
      }
    }

    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer)
    })
  })
}

function fail(message: string, code = 1): never {
  console.error(message)
  process.exit(code)
}

/** `A,B=C` → { A: 'A', B: 'C' }: имя для команды → имя в хранилище. */
function parseMap(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const [variable, stored = variable] = part.split('=').map((p) => p.trim())
    if (!NAME_PATTERN.test(variable) || !NAME_PATTERN.test(stored)) fail(`Invalid name in "${part}".`)
    out[variable] = stored
  }
  return out
}

/** Значение флага `--name value`, если он есть. */
function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

/** Позиционные аргументы: всё, что не флаг и не значение флага. */
function positional(args: string[], valued: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (valued.includes(args[i])) i++
    else if (!args[i].startsWith('--')) out.push(args[i])
  }
  return out
}

function minutes(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback)
  return (Number.isFinite(value) && value > 0 ? value : fallback) * 60_000
}

/** Итог ожидания одной строкой — его читает ассистент. Только имена. */
async function finish(id: string, done: boolean): Promise<never> {
  const request = loadRequest(id)
  const from = request.answeredBy ? ` (answered by ${request.answeredBy})` : ''
  console.log(`${done ? 'Done' : 'Timed out'}${from}: ${summary(request)}`)

  if (done) {
    // Ответ получен — запрос на сервере и его ключи больше не нужны.
    await closeRemote(id)
    console.log('Move them without reading: skey dotenv <file> --only ... | skey run --only ... -- cmd')
    console.log(`One-off? Remove afterwards: skey clean ${id}`)
  } else {
    const how = request.remote?.offline ? 'skey import <reply>' : `skey wait ${id}`
    console.log(`Still open — the link and the terminal command keep working. Pick it up later: ${how}`)
  }
  process.exit(done ? 0 : 3)
}

/** Спросить поля по одному, со скрытым вводом. Пустое — только где можно. */
async function askFields(
  fields: Field[],
  remote: boolean,
  onValue: (field: Field, value: string) => void,
): Promise<void> {
  for (const field of fields) {
    const title = field.label ? `${field.label} (${field.name})` : field.name
    const hint = field.existing
      ? remote ? ' [they have one — Enter keeps it]' : ' [Enter keeps the current one]'
      : field.optional ? ' [Enter skips]' : ''

    for (;;) {
      const value = await prompt(`${title}${hint}: `, true)
      if (value || field.existing || field.optional) {
        onValue(field, value)
        break
      }
      console.log('  Required — paste or type it, then Enter.')
    }
  }
}

/** Ответ на ссылку с другого компьютера: значения шифруются здесь и уходят автору. */
async function fillRemote(link: string): Promise<void> {
  let opened: Awaited<ReturnType<typeof openLink>>
  try {
    opened = await openLink(link)
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Failed.')
  }

  const { meta } = opened
  const who = meta.from || 'Someone'
  console.log(`\n${who} asks for ${meta.fields.length === 1 ? 'a key' : `${meta.fields.length} keys`}.`)
  if (meta.note) console.log(`\n  ${meta.note.split('\n').join('\n  ')}`)
  console.log(`\nEncrypted on this computer before it leaves — only ${meta.from || 'the requester'} can read it. Input is hidden.\n`)

  const values: Record<string, string> = {}
  await askFields(meta.fields, true, (field, value) => {
    if (value) values[field.name] = value
  })
  const by = (await prompt('Your name (optional, so they know who answered): ', false)).trim()

  const result = await sendAnswer(opened, values, by)
  if (result.sent) {
    console.log(`\nSent. Only ${meta.from || 'the requester'} can read it.`)
    return
  }
  console.log(`\n${result.reason ? `${result.reason} ` : ''}Send this encrypted reply to ${meta.from || 'the requester'} yourself — it is safe in any chat:\n`)
  console.log(result.blob)
}

const [command, ...rest] = process.argv.slice(2)

switch (command) {
  case 'ui': {
    const port = Number(positional(rest, [])[0] ?? 0)
    startUi(Number.isFinite(port) ? port : 0, !rest.includes('--no-open'))
    break
  }

  case 'set': {
    const name = rest[0]
    if (!name) fail('Which name? Try: skey set CF_API_TOKEN')

    if (has(name) && !rest.includes('--force')) {
      const answer = await prompt(`${name} already exists. Replace it? [y/N] `, false)
      if (answer.toLowerCase() !== 'y') fail('Left alone.', 0)
    }

    // Через stdin, а не аргументом: аргументы видны в списке процессов и
    // остаются в истории команд.
    const value = rest.includes('--stdin')
      ? (await readStdin()).trim()
      : await prompt(`Value for ${name}: `, true)

    try {
      set(name, value)
      console.log(`Stored ${name}.`)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed.')
    }
    break
  }

  case 'list': {
    const keys = list()
    if (keys.length === 0) {
      console.log('Nothing stored yet. Add one with: skey set NAME')
      break
    }
    for (const key of keys) {
      console.log(`${key.name.padEnd(24)} updated ${key.updatedAt.slice(0, 10)}`)
    }
    break
  }

  case 'rm': {
    const names = positional(rest, [])
    if (names.length === 0) fail('Which one? Try: skey rm CF_API_TOKEN')
    const missing = names.filter((n) => !has(n))
    if (missing.length) fail(`No secret named ${missing.join(', ')}.`)

    if (!rest.includes('--force')) {
      const answer = await prompt(`Delete ${names.join(', ')}? [y/N] `, false)
      if (answer.toLowerCase() !== 'y') fail('Left alone.', 0)
    }

    for (const name of names) remove(name)
    console.log(`Deleted ${names.join(', ')}.`)
    break
  }

  case 'run': {
    const separator = rest.indexOf('--')
    if (separator === -1) fail('Missing --. Try: skey run --only NAME -- your-command')

    const flags = rest.slice(0, separator)
    const [cmd, ...args] = rest.slice(separator + 1)
    if (!cmd) fail('No command after --.')

    const only = flag(flags, '--only')
    const stdin = flag(flags, '--stdin')
    if (stdin !== undefined && !NAME_PATTERN.test(stdin)) fail(`Invalid name "${stdin}" after --stdin.`)

    // Без --only отдаём всё — но не тогда, когда ключ просили только на stdin.
    const env =
      only !== undefined
        ? parseMap(only)
        : stdin !== undefined
          ? {}
          : Object.fromEntries(list().map((k) => [k.name, k.name]))

    if (Object.keys(env).length === 0 && stdin === undefined) {
      fail('Nothing to inject. Store a secret first, or pass --only NAME.')
    }

    try {
      const code = await run({ env, stdin, command: cmd, args, mask: !flags.includes('--no-mask') })
      process.exit(code)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed to run.')
    }
    break
  }

  case 'export': {
    const name = rest[0]
    if (!name) fail('Which one?')

    // Без настоящего терминала — отказ. Это то, что не даёт агенту достать
    // значение: он может выполнить команду, но не может нажать клавишу.
    if (!process.stdin.isTTY) {
      fail('export needs a real terminal. An assistant cannot read values this way.', 2)
    }

    const answer = await prompt(`Print the value of ${name} to this screen? Type yes: `, false)
    if (answer !== 'yes') fail('Cancelled.', 0)

    try {
      console.log(get(name))
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed.')
    }
    break
  }

  case 'request': {
    const specs = positional(rest, ['--note', '--timeout', '--ttl', '--from', '--relay'])
    const note = flag(rest, '--note') ?? ''
    const offline = rest.includes('--offline')
    const remote = offline || rest.includes('--share')

    let request: KeyRequest
    let shareLink = ''
    try {
      request = createRequest(specs, note)
      if (remote) {
        const ttl = Math.min(Math.max(Number(flag(rest, '--ttl') ?? 24) || 24, 1), 168)
        shareLink = await share(request, { relay: flag(rest, '--relay') ?? DEFAULT_RELAY, offline, ttlHours: ttl, from: flag(rest, '--from') })
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed.')
    }

    const names = request.fields.map((f) => f.name).join(', ')
    const terminal = `npx @tscodex/skey fill ${request.id}`
    const printRemote = () => {
      if (!remote) return
      console.log(`  Share:    ${shareLink}`)
      console.log(offline
        ? '            works on any computer; they send back a reply text → skey import <text>'
        : '            works on any computer, end-to-end encrypted; the reply arrives here by itself')
    }

    if (rest.includes('--no-wait')) {
      console.log(`Request ${request.id}: ${names}`)
      printRemote()
      console.log(`  Terminal: ${terminal}`)
      console.log(`Wait for it: skey wait ${request.id}`)
      break
    }

    // С --share браузер не открываем сами: ссылку, скорее всего, отправят другому.
    const timeout = minutes(flag(rest, '--timeout'), 30)
    const { link, close } = await serveRequest(request.id, !remote && !rest.includes('--no-open'), Date.now() + timeout)

    console.log(`Request ${request.id}: ${names}`)
    console.log('')
    printRemote()
    console.log(`  ${remote ? 'Here:    ' : 'Browser: '} ${link}`)
    console.log(`  Terminal: ${terminal}`)
    console.log('')
    console.log(`Waiting up to ${timeout / 60_000} min. Exits as soon as every field is filled.`)

    const poll = remote && !offline ? () => pullAnswer(request.id).then(() => undefined) : undefined
    const done = await waitFor(request.id, timeout, poll)
    close()
    await finish(request.id, done)
  }

  case 'fill': {
    // Поле за полем, со скрытым вводом. Только с живой клавиатуры: иначе
    // ассистент мог бы сам «заполнить» запрос, адресованный человеку.
    if (!process.stdin.isTTY) fail('fill needs a real terminal — it is for the person, not the assistant.', 2)

    let id = rest[0]

    // Ссылка с другого компьютера: шифруем и отправляем, к своему хранилищу не прикасаемся.
    if (id?.includes('://')) {
      await fillRemote(id)
      break
    }

    if (!id) {
      const pending = pendingRequests()
      if (pending.length === 0) fail('No open requests.', 0)
      if (pending.length === 1) id = pending[0].id
      else {
        pending.forEach((r, i) =>
          console.log(`  ${i + 1}. ${r.id}  ${r.fields.map((f) => f.name).join(', ')}${r.note ? `  — ${r.note}` : ''}`),
        )
        const pick = Number(await prompt('Which one? ', false))
        id = pending[pick - 1]?.id ?? fail('Cancelled.', 0)
      }
    }

    let request: KeyRequest
    try {
      request = loadRequest(id)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed.')
    }

    const missing = new Set(progress(request).missing)
    if (missing.size === 0) {
      console.log('Everything in this request is already filled.')
      break
    }

    console.log(`\nAn assistant asks for ${missing.size === 1 ? 'a key' : `${missing.size} keys`}.`)
    if (request.note) console.log(`\n  ${request.note.split('\n').join('\n  ')}`)
    console.log('\nValues go straight to the keychain. Input is hidden.\n')

    await askFields(
      request.fields.filter((f) => missing.has(f.name)),
      false,
      (field, value) => {
        if (value) {
          set(field.name, value)
          mark(request.id, field.name, 'stored')
          console.log('  ✓ stored')
        } else {
          mark(request.id, field.name, 'skipped')
          console.log('  – left as is')
        }
      },
    )

    console.log('\nDone. The assistant picks it up by itself — it sees only the names.')
    break
  }

  case 'wait': {
    const id = rest[0] ?? fail('Which request? Try: skey wait <ID>')
    let request: KeyRequest
    try {
      request = loadRequest(id)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed.')
    }
    const poll = request.remote && !request.remote.offline ? () => pullAnswer(id).then(() => undefined) : undefined
    await finish(id, await waitFor(id, minutes(flag(rest, '--timeout'), 30), poll))
  }

  case 'import': {
    // Строку ответа можно передать аргументом или через stdin. Она зашифрована
    // для этого компьютера, поэтому ей не страшно побывать в чате.
    const text = rest[0] ?? (process.stdin.isTTY ? '' : await readStdin())
    if (!text.trim()) fail('Paste the reply: skey import skey1.…')
    try {
      const request = await importBlob(text)
      const complete = progress(request).missing.length === 0
      if (complete) await closeRemote(request.id)
      console.log(`Imported request ${request.id}${request.answeredBy ? ` (from ${request.answeredBy})` : ''}: ${summary(request)}`)
      if (complete) console.log(`One-off? Remove afterwards: skey clean ${request.id}`)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed.')
    }
    break
  }

  case 'clean': {
    if (rest.includes('--requests')) {
      for (const id of allRequestIds()) await closeRemote(id)
      console.log(`Closed ${clearAllRequests()} request(s). Keys untouched.`)
      break
    }
    const id = rest[0] ?? fail('Which request? Try: skey clean <ID>, or skey clean --requests')
    try {
      await closeRemote(id)
      const { removed, kept } = clearRequest(id)
      console.log(`Removed from keychain: ${removed.join(', ') || '—'}.`)
      if (kept.length) console.log(`Kept (stored before the request): ${kept.join(', ')}. Use skey rm to drop them.`)
      console.log(`Request ${id} closed.`)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed.')
    }
    break
  }

  case 'dotenv': {
    const file = positional(rest, ['--only'])[0] ?? fail('Which file? Try: skey dotenv .env --only A,B')
    const only = flag(rest, '--only') ?? fail('Which keys? Try: skey dotenv .env --only A,B')
    try {
      const { updated, added } = writeDotenv(file, parseMap(only))
      console.log(`Wrote to ${file}: ${[...updated.map((n) => `${n} (updated)`), ...added].join(', ')}.`)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Failed.')
    }
    break
  }

  default:
    console.log(USAGE)
    if (command && command !== '--help' && command !== '-h') process.exit(1)
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}
