/**
 * Ретранслятор skey: передаёт зашифрованный ответ с одного компьютера на другой.
 *
 * Сервер ничего не может прочитать: описание запроса зашифровано секретом из
 * фрагмента ссылки (после `#`, браузер его не отправляет), ответ — ключом
 * автора запроса. Здесь хранятся только шифр, хеши двух токенов и сроки.
 *
 *   — ответить может только тот, у кого есть ссылка: токен ответа выводится из
 *     её секрета, а здесь лежит лишь его хеш;
 *   — забрать ответ и удалить запрос может только автор: токен владельца;
 *   — один запрос — один ответ: второй получает 409;
 *   — по истечении срока строка стирается (при следующем новом запросе), а сразу
 *     после того, как ответ забрали, — немедленно.
 */

import { REQUEST_PAGE } from '../../src/request-page.js'
import { LANDING } from './landing.js'

interface Env {
  DB: D1Database
}

const ID = /^[a-z0-9]{6,32}$/
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const MAX_META = 16 * 1024
const MAX_ANSWER = 64 * 1024
const MAX_TTL = 7 * 24 * 3600 * 1000
const MIN_TTL = 5 * 60 * 1000

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  // Страница — один файл: скрипты и стили только свои, запросы только сюда же.
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; " +
    "img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
}

const LANDING_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  let bin = ''
  for (const byte of digest) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Тело с ограничением размера: читаем текст и только потом разбираем. */
async function body<T>(req: Request, limit: number): Promise<T | null> {
  const text = await req.text()
  if (text.length > limit) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

const isBox = (v: unknown): boolean =>
  typeof v === 'object' && v !== null && typeof (v as any).iv === 'string' && typeof (v as any).ct === 'string'

async function create(req: Request, env: Env): Promise<Response> {
  const input = await body<{ id: string; meta: unknown; submitHash: string; ownerHash: string; expiresAt: number }>(req, MAX_META)
  if (!input || !ID.test(input.id) || !isBox(input.meta) || !TOKEN.test(input.submitHash) || !TOKEN.test(input.ownerHash)) {
    return json(400, { error: 'Bad request.' })
  }

  const now = Date.now()
  const expiresAt = Math.min(Math.max(Number(input.expiresAt) || 0, now + MIN_TTL), now + MAX_TTL)

  // Просроченное стираем здесь, при каждом новом запросе: шифр не должен лежать
  // дольше срока, а расписание (cron) на бесплатном тарифе требует лишней настройки.
  await env.DB.prepare('DELETE FROM requests WHERE expires_at < ?').bind(now).run()

  try {
    await env.DB.prepare(
      'INSERT INTO requests (id, meta, submit_hash, owner_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(input.id, JSON.stringify(input.meta), input.submitHash, input.ownerHash, now, expiresAt)
      .run()
  } catch {
    return json(409, { error: 'This ID is taken.' })
  }
  return json(201, { id: input.id, expiresAt })
}

interface Row {
  meta: string
  submit_hash: string
  owner_hash: string
  answer: string | null
  expires_at: number
}

async function find(env: Env, id: string): Promise<Row | null> {
  return env.DB.prepare('SELECT meta, submit_hash, owner_hash, answer, expires_at FROM requests WHERE id = ? AND expires_at > ?')
    .bind(id, Date.now())
    .first<Row>()
}

async function isOwner(req: Request, row: Row): Promise<boolean> {
  const owner = req.headers.get('x-skey-owner') ?? ''
  return TOKEN.test(owner) && (await sha256(owner)) === row.owner_hash
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname

  // Лендинг: единственная страница, которой можно шрифты с Google Fonts.
  if (req.method === 'GET' && path === '/') {
    return new Response(LANDING, { headers: LANDING_HEADERS })
  }

  // Страница ответа. Сам запрос она достанет через API, секрет — из фрагмента.
  if (req.method === 'GET' && /^\/r\/[a-z0-9]+$/.test(path)) {
    return new Response(REQUEST_PAGE, { headers: PAGE_HEADERS })
  }

  if (req.method === 'POST' && path === '/api/r') return create(req, env)

  const match = /^\/api\/r\/([a-z0-9]+)(\/answer)?$/.exec(path)
  if (!match || !ID.test(match[1])) return json(404, { error: 'Not found.' })
  const [, id, answerPath] = match

  const row = await find(env, id)
  if (!row) return json(404, { error: 'No such request, or it has expired.' })

  if (!answerPath) {
    if (req.method === 'GET') {
      return json(200, { meta: JSON.parse(row.meta), expiresAt: row.expires_at, answered: row.answer !== null })
    }
    if (req.method === 'DELETE') {
      if (!(await isOwner(req, row))) return json(403, { error: 'Not yours.' })
      await env.DB.prepare('DELETE FROM requests WHERE id = ?').bind(id).run()
      return json(200, { ok: true })
    }
    return json(405, { error: 'Method not allowed.' })
  }

  if (req.method === 'POST') {
    const input = await body<{ token: string; answer: any }>(req, MAX_ANSWER)
    const a = input?.answer
    if (!input || !TOKEN.test(input.token ?? '') || !isBox(a) || a.v !== 1 || a.id !== id || typeof a.epk !== 'string') {
      return json(400, { error: 'Bad reply.' })
    }
    if ((await sha256(input.token)) !== row.submit_hash) return json(403, { error: 'This link cannot answer this request.' })

    // Один запрос — один ответ: условие в самом UPDATE, без гонки между двумя отвечающими.
    const result = await env.DB.prepare('UPDATE requests SET answer = ?, answered_at = ? WHERE id = ? AND answer IS NULL')
      .bind(JSON.stringify(a), Date.now(), id)
      .run()
    if (!result.meta.changes) return json(409, { error: 'Already answered.' })
    return json(201, { ok: true })
  }

  if (req.method === 'GET') {
    if (!(await isOwner(req, row))) return json(403, { error: 'Not yours.' })
    return json(200, { answer: row.answer ? JSON.parse(row.answer) : null })
  }

  return json(405, { error: 'Method not allowed.' })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await route(req, env)
    } catch {
      return json(500, { error: 'Something went wrong.' })
    }
  },

}
