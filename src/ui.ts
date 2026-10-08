/**
 * Локальный интерфейс для управления ключами.
 *
 * Браузер не может обратиться к системному хранилищу напрямую, поэтому здесь
 * поднимается сервер-посредник. Три вещи держат его безопасным:
 *
 *   — слушает 127.0.0.1, не 0.0.0.0: ключи не должны быть видны из сети;
 *   — требует одноразовый токен из адресной строки, потому что на localhost
 *     может постучаться любой процесс на этой машине;
 *   — живёт, пока открыт терминал: никакого фонового демона.
 *
 * Значения наружу не отдаются никогда — страница показывает только имена.
 */

import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { exec } from 'node:child_process'
import { list, set, remove, NAME_PATTERN } from './store.js'
import { PAGE } from './ui-page.js'
import { stubPage } from './theme.js'
import { REQUEST_PAGE } from './request-page.js'
import { loadRequest, mark, progress } from './request.js'

function sameToken(a: string, b: string): boolean {
  // Сравнение по времени: обычное === выдаёт длину общего префикса и позволяет
  // подобрать токен побайтно.
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open'
  exec(`${command} "${url}"`, () => {
    // Не открылось — не беда, адрес напечатан в терминале.
  })
}

export function startUi(port = 0, open = true): void {
  const token = randomBytes(24).toString('hex')

  const server = createServer(handler(token, null, null))

  server.listen(port, '127.0.0.1', () => {
    const address = server.address()
    const actual = typeof address === 'object' && address ? address.port : port
    const link = `http://127.0.0.1:${actual}/?t=${token}`

    console.log(`\n  Manage your keys at:\n  ${link}\n`)
    console.log('  The link works only while this stays open. Ctrl+C when done.\n')
    if (open) openBrowser(link)
  })
}

/**
 * Сервер одного запроса. Страница знает только его поля, а записать через
 * неё можно только их — ссылку видит ассистент, и она не должна открывать
 * всё хранилище. Возвращает ссылку; сервер живёт, пока его не закроют.
 */
export function serveRequest(id: string, open: boolean, closesAt: number | null = null): Promise<{ link: string; close: () => void }> {
  const token = randomBytes(24).toString('hex')
  const server = createServer(handler(token, id, closesAt))

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const link = `http://127.0.0.1:${port}/?t=${token}`
      if (open) openBrowser(link)
      resolve({ link, close: () => server.close() })
    })
  })
}

function handler(token: string, requestId: string | null, closesAt: number | null) {
  return async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    const provided = url.searchParams.get('t') ?? req.headers['x-skey-token']
    if (typeof provided !== 'string' || !sameToken(provided, token)) {
      // Страницу без токена встречаем объяснением, запрос к API — коротким отказом.
      if (url.pathname.startsWith('/api/')) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Open the link printed in the terminal.' }))
        return
      }
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(stubPage({
        title: 'Open the link printed in the terminal',
        text: 'This address has no valid token.',
        icon: 'lock',
        kind: 'no',
        cmd: requestId ? undefined : 'skey ui',
      }))
      return
    }

    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    try {
      if (requestId) {
        handleRequest(requestId, req, res, url, json, closesAt)
        return
      }

      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(PAGE)
        return
      }

      if (req.method === 'GET' && url.pathname === '/api/keys') {
        json(200, { keys: list() })
        return
      }

      if (req.method === 'POST' && url.pathname === '/api/keys') {
        const body = await readJson(req)
        const { name, value } = body as { name?: string; value?: string }

        if (!name || !NAME_PATTERN.test(name)) {
          json(400, { error: 'Use A-Z, 0-9 and underscore, starting with a letter.' })
          return
        }
        if (!value) {
          json(400, { error: 'Value is empty.' })
          return
        }

        set(name, value)
        json(200, { ok: true })
        return
      }

      if (req.method === 'DELETE' && url.pathname === '/api/keys') {
        const { name } = (await readJson(req)) as { name?: string }
        if (!name) {
          json(400, { error: 'Which one?' })
          return
        }
        remove(name)
        json(200, { ok: true })
        return
      }

      json(404, { error: 'Not found' })
    } catch (error) {
      json(500, { error: error instanceof Error ? error.message : 'Failed' })
    }
  }
}

type Json = (status: number, body: unknown) => void

async function handleRequest(
  id: string,
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  url: URL,
  json: Json,
  closesAt: number | null,
): Promise<void> {
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(REQUEST_PAGE)
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/request') {
      const request = loadRequest(id)
      json(200, { ...request, ...progress(request), closesAt })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/request') {
      const request = loadRequest(id)
      const { values = {} } = (await readJson(req)) as { values?: Record<string, string> }
      const already = progress(request).stored

      // Сначала проверяем всё, потом пишем: при ошибке не должно остаться
      // половины сохранённой формы.
      for (const field of request.fields) {
        const value = values[field.name] ?? ''
        if (!value && !field.optional && !field.existing && !already.includes(field.name)) {
          json(400, { error: `${field.label || field.name} is required.` })
          return
        }
      }

      // Пишем только поля запроса — что бы ни пришло в теле.
      for (const field of request.fields) {
        const value = values[field.name] ?? ''
        if (value) {
          set(field.name, value)
          mark(id, field.name, 'stored')
        } else if (!already.includes(field.name)) {
          mark(id, field.name, 'skipped')
        }
      }
      json(200, { ok: true })
      return
    }

    json(404, { error: 'Not found' })
  } catch (error) {
    json(500, { error: error instanceof Error ? error.message : 'Failed' })
  }
}

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
