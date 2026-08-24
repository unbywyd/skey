#!/usr/bin/env node
/**
 * skey — токены живут в системном хранилище, а не в контексте модели.
 *
 * Ассистент видит только имена переменных и запускает команды через `run`.
 * Значение он не может ни прочитать, ни положить: `set` требует ввода с
 * клавиатуры, `export` — подтверждения с настоящего терминала.
 */

import { createInterface } from 'node:readline'
import { list, set, remove, get, has } from './store.js'
import { run } from './run.js'
import { startUi } from './ui.js'

const USAGE = `skey — keep API tokens out of your assistant's context

  skey ui                      manage keys in the browser
  skey set <NAME>              store a secret (typed, not pasted as an argument)
  skey list                    names and when they changed — never values
  skey rm <NAME>               delete one
  skey run --only A,B -- cmd   run a command with those secrets in its environment
  skey export <NAME>           print a value — needs a real terminal, refuses otherwise

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

const [command, ...rest] = process.argv.slice(2)

switch (command) {
  case 'ui': {
    const port = Number(rest[0] ?? 0)
    startUi(Number.isFinite(port) ? port : 0)
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
    const name = rest[0]
    if (!name) fail('Which one? Try: skey rm CF_API_TOKEN')
    if (!has(name)) fail(`No secret named ${name}.`)

    if (!rest.includes('--force')) {
      const answer = await prompt(`Delete ${name}? [y/N] `, false)
      if (answer.toLowerCase() !== 'y') fail('Left alone.', 0)
    }

    remove(name)
    console.log(`Deleted ${name}.`)
    break
  }

  case 'run': {
    const separator = rest.indexOf('--')
    if (separator === -1) fail('Missing --. Try: skey run --only NAME -- your-command')

    const flags = rest.slice(0, separator)
    const [cmd, ...args] = rest.slice(separator + 1)
    if (!cmd) fail('No command after --.')

    const onlyIndex = flags.indexOf('--only')
    const names =
      onlyIndex === -1
        ? list().map((k) => k.name)
        : (flags[onlyIndex + 1] ?? '').split(',').map((n) => n.trim()).filter(Boolean)

    if (names.length === 0) fail('Nothing to inject. Store a secret first, or pass --only NAME.')

    try {
      const code = await run({ names, command: cmd, args, mask: !flags.includes('--no-mask') })
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

  default:
    console.log(USAGE)
    if (command && command !== '--help' && command !== '-h') process.exit(1)
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}
