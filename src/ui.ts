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

export function startUi(port = 0): void {
  const token = randomBytes(24).toString('hex')

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    const provided = url.searchParams.get('t') ?? req.headers['x-skey-token']
    if (typeof provided !== 'string' || !sameToken(provided, token)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Open the URL printed in the terminal.')
      return
    }

    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    try {
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
  })

  server.listen(port, '127.0.0.1', () => {
    const address = server.address()
    const actual = typeof address === 'object' && address ? address.port : port
    const link = `http://127.0.0.1:${actual}/?t=${token}`

    console.log(`\n  Manage your keys at:\n  ${link}\n`)
    console.log('  The link works only while this stays open. Ctrl+C when done.\n')
    openBrowser(link)
  })
}

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
