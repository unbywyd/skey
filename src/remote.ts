/**
 * Запрос ключей с другого компьютера.
 *
 * Механизм тот же, что и локально: запрос, ссылка, один ответ, значения в
 * хранилище. Разница только в доставке — ответ идёт через ретранслятор,
 * зашифрованный в браузере отвечающего так, что прочитать его может только
 * этот компьютер. Сервер хранит шифр и стирает его, как только ответ забран.
 *
 * Без сервера (`offline`) описание запроса едет прямо в ссылке, а ответ
 * возвращается строкой `skey1.…`, которую отвечающий пересылает сам.
 */

import { execSync } from 'node:child_process'
import { envelope as E, type AnswerEnvelope, type Box } from './envelope.js'
import { set, getRequestSecrets, setRequestSecrets, removeRequestSecrets } from './store.js'
import { loadRequest, patchRequest, mark, progress, type Field, type KeyRequest } from './request.js'

export const DEFAULT_RELAY = process.env.SKEY_RELAY ?? 'https://skey.tscodex.com'

/** Описание запроса, как его видит отвечающий. Шифруется секретом ссылки. */
export interface RemoteMeta {
  fields: Field[]
  note: string
  from: string
  pub: string
  expiresAt: string
}

interface Answer {
  values: Record<string, string>
  by?: string
}

export interface ShareOptions {
  relay: string
  offline: boolean
  ttlHours: number
  from?: string
}

/** Имя автора для страницы ответа: «Артём просит ключи» внушает больше доверия. */
function defaultFrom(): string {
  try {
    return execSync('git config user.name', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error(`Cannot reach ${new URL(url).origin}. Check the connection, or use --offline.`)
  }
}

/** Открыть локальный запрос для других компьютеров. Возвращает ссылку. */
export async function share(request: KeyRequest, options: ShareOptions): Promise<string> {
  const relay = options.relay.replace(/\/+$/, '')
  const secret = E.newSecret()
  const { pub, priv } = await E.keypair()
  const expiresAt = new Date(Date.now() + options.ttlHours * 3_600_000).toISOString()

  const meta: RemoteMeta = {
    fields: request.fields,
    note: request.note,
    from: options.from ?? defaultFrom(),
    pub,
    expiresAt,
  }
  const box = await E.sealMeta(secret, meta)

  let owner: string | undefined
  if (!options.offline) {
    owner = E.newSecret()
    const res = await call(`${relay}/api/r`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: request.id,
        meta: box,
        submitHash: await E.sha256(await E.submitToken(secret)),
        ownerHash: await E.sha256(owner),
        expiresAt: Date.parse(expiresAt),
      }),
    })
    if (!res.ok) throw new Error(`The relay refused the request (${res.status}): ${await res.text()}`)
  }

  setRequestSecrets(request.id, { secret, priv, owner })
  patchRequest(request.id, { remote: { relay, offline: options.offline, expiresAt } })

  const fragment = options.offline
    ? `${secret}.${E.b64u(new TextEncoder().encode(JSON.stringify(box)))}`
    : secret
  return `${relay}/r/${request.id}#${fragment}`
}

/** Расшифровать ответ и разложить значения по хранилищу. Возвращает итог. */
export async function applyAnswer(envelope: AnswerEnvelope): Promise<KeyRequest> {
  const request = loadRequest(envelope.id)
  const secrets = getRequestSecrets(envelope.id)
  if (!secrets) throw new Error(`The keys for request ${envelope.id} are gone — it was cleaned up or made on another computer.`)

  let answer: Answer
  try {
    answer = await E.openAnswer<Answer>(secrets.secret, secrets.priv, envelope)
  } catch {
    throw new Error('This reply does not decrypt — it was damaged or is not for this request.')
  }

  const already = progress(request).stored
  for (const field of request.fields) {
    const value = answer.values?.[field.name]
    if (value) {
      set(field.name, value)
      mark(request.id, field.name, 'stored')
    } else if (!already.includes(field.name)) {
      mark(request.id, field.name, 'skipped')
    }
  }
  if (answer.by) patchRequest(request.id, { answeredBy: answer.by.slice(0, 80) })
  return loadRequest(request.id)
}

/** Забрать ответ с ретранслятора, если он там есть. */
export async function pullAnswer(id: string): Promise<boolean> {
  const request = loadRequest(id)
  const secrets = getRequestSecrets(id)
  if (!request.remote || request.remote.offline || !secrets?.owner) return false

  const res = await call(`${request.remote.relay}/api/r/${id}/answer`, { headers: { 'x-skey-owner': secrets.owner } })
  if (!res.ok) return false
  const { answer } = (await res.json()) as { answer: AnswerEnvelope | null }
  if (!answer) return false

  await applyAnswer(answer)
  return true
}

export async function importBlob(text: string): Promise<KeyRequest> {
  let envelope: AnswerEnvelope
  try {
    envelope = E.fromBlob(text)
  } catch {
    throw new Error('That is not a skey reply. It starts with skey1.')
  }
  return applyAnswer(envelope)
}

/** Стереть запрос с ретранслятора и его ключи отсюда. Ошибки сети не мешают. */
export async function closeRemote(id: string): Promise<void> {
  let request: KeyRequest | null = null
  try {
    request = loadRequest(id)
  } catch {
    // Файла нет — ключи всё равно уберём.
  }
  const secrets = getRequestSecrets(id)

  if (request?.remote && !request.remote.offline && secrets?.owner) {
    try {
      await fetch(`${request.remote.relay}/api/r/${id}`, { method: 'DELETE', headers: { 'x-skey-owner': secrets.owner } })
    } catch {
      // Не дотянулись — сервер удалит сам по сроку.
    }
  }
  removeRequestSecrets(id)
}

// --- сторона отвечающего: `skey fill <ссылка>` --------------------------------

export interface OpenedLink {
  relay: string
  id: string
  secret: string
  offline: boolean
  meta: RemoteMeta
}

export async function openLink(link: string): Promise<OpenedLink> {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    throw new Error('That does not look like a link.')
  }
  const id = /^\/r\/([a-z0-9]+)$/.exec(url.pathname)?.[1]
  const [secret, offlineMeta] = url.hash.slice(1).split('.')
  if (!id || !secret) throw new Error('The link is incomplete — copy it whole, including the part after #.')

  let box: Box
  if (offlineMeta) {
    box = JSON.parse(new TextDecoder().decode(E.unb64u(offlineMeta))) as Box
  } else {
    const res = await call(`${url.origin}/api/r/${id}`)
    if (!res.ok) throw new Error('This link no longer works: it expired or was already used.')
    const body = (await res.json()) as { meta: Box; answered: boolean }
    if (body.answered) throw new Error('Someone has already answered this request.')
    box = body.meta
  }

  try {
    const meta = await E.openMeta<RemoteMeta>(secret, box)
    return { relay: url.origin, id, secret, offline: Boolean(offlineMeta), meta }
  } catch {
    throw new Error('The link is damaged — part of it is missing.')
  }
}

/**
 * Отправить ответ. Возвращает строку `skey1.…`, если её надо переслать
 * вручную (без сервера или когда сервер не принял), иначе null.
 */
export async function sendAnswer(opened: OpenedLink, values: Record<string, string>, by: string): Promise<{ blob: string; sent: boolean; reason?: string }> {
  const envelope = await E.sealAnswer(opened.secret, opened.id, opened.meta.pub, { values, by })
  const blob = E.toBlob(envelope)
  if (opened.offline) return { blob, sent: false }

  try {
    const res = await fetch(`${opened.relay}/api/r/${opened.id}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: await E.submitToken(opened.secret), answer: envelope }),
    })
    if (res.ok) return { blob, sent: true }
    if (res.status === 409) return { blob, sent: false, reason: 'Someone answered first.' }
    return { blob, sent: false, reason: `The server refused the reply (${res.status}).` }
  } catch {
    return { blob, sent: false, reason: 'Cannot reach the server.' }
  }
}
