/**
 * Запрос ключей от ассистента к человеку.
 *
 * Ассистенту нужен ключ, но получить его в чат он не должен. Поэтому он
 * создаёт запрос — список имён с подсказками, — а человек заполняет его в
 * браузере или в терминале. Значения уходят сразу в хранилище; в файле
 * запроса лежат только имена, подписи и отметки о том, что уже заполнено.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { list, remove, NAME_PATTERN } from './store.js'

const DIR = join(homedir(), '.tscodex', 'skey-requests')

/** Неделя: дольше незаполненный запрос никому не нужен. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000

/** Без похожих символов: ID диктуют и перепечатывают руками. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export interface Field {
  name: string
  label: string
  /** Можно пропустить. */
  optional: boolean
  /** Уже лежал в хранилище, когда запрос создали: пустое значение = оставить. */
  existing: boolean
}

export interface KeyRequest {
  id: string
  note: string
  createdAt: string
  fields: Field[]
  /** Заполненные через форму или fill. */
  stored: string[]
  /** Пропущенные или оставленные как есть. */
  skipped: string[]
  /** Запрос открыт и для других компьютеров — см. remote.ts. */
  remote?: { relay: string; offline: boolean; expiresAt: string }
  /** Кто ответил удалённо, если назвался. */
  answeredBy?: string
}

export interface Progress {
  stored: string[]
  skipped: string[]
  missing: string[]
}

function file(id: string): string {
  return join(DIR, `${id}.json`)
}

function newId(): string {
  const bytes = randomBytes(6)
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

/**
 * Разбор поля из командной строки: `NAME`, `NAME:Подпись`, `NAME?:Подпись`.
 * Вопрос после имени — поле необязательное.
 */
export function parseField(spec: string): Omit<Field, 'existing'> {
  const colon = spec.indexOf(':')
  let name = (colon === -1 ? spec : spec.slice(0, colon)).trim()
  const label = colon === -1 ? '' : spec.slice(colon + 1).trim()

  const optional = name.endsWith('?')
  if (optional) name = name.slice(0, -1)

  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Invalid name "${name}". Use A-Z, 0-9 and underscore, starting with a letter.`)
  }
  return { name, label, optional }
}

function cleanup(): void {
  try {
    for (const entry of readdirSync(DIR)) {
      const path = join(DIR, entry)
      if (Date.now() - statSync(path).mtimeMs > STALE_MS) unlinkSync(path)
    }
  } catch {
    // Папки ещё нет — чистить нечего.
  }
}

export function createRequest(specs: string[], note: string): KeyRequest {
  const known = new Set(list().map((k) => k.name))
  const fields: Field[] = []

  for (const spec of specs) {
    const field = parseField(spec)
    if (fields.some((f) => f.name === field.name)) continue
    fields.push({ ...field, existing: known.has(field.name) })
  }
  if (fields.length === 0) throw new Error('Nothing to ask for. Try: skey request SMTP_USER SMTP_PASS')

  cleanup()
  mkdirSync(DIR, { recursive: true })

  const request: KeyRequest = {
    id: newId(),
    note,
    createdAt: new Date().toISOString(),
    fields,
    stored: [],
    skipped: [],
  }
  save(request)
  return request
}

/** Дописать поля запроса, перечитав файл: его могут менять параллельно. */
export function patchRequest(id: string, patch: Partial<KeyRequest>): void {
  save({ ...loadRequest(id), ...patch })
}

function save(request: KeyRequest): void {
  writeFileSync(file(request.id), JSON.stringify(request, null, 2), { mode: 0o600 })
}

export function loadRequest(id: string): KeyRequest {
  try {
    return JSON.parse(readFileSync(file(id), 'utf8')) as KeyRequest
  } catch {
    throw new Error(`No request ${id}. It may have expired — ask for a new one.`)
  }
}

/** Незаполненные запросы, новые первыми. */
export function pendingRequests(): KeyRequest[] {
  let entries: string[] = []
  try {
    entries = readdirSync(DIR).filter((e) => e.endsWith('.json'))
  } catch {
    return []
  }
  return entries
    .map((e) => {
      try {
        return loadRequest(e.slice(0, -5))
      } catch {
        return null
      }
    })
    .filter((r): r is KeyRequest => r !== null && progress(r).missing.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Отметить поле. Перечитываем файл: форма и терминал могут писать одновременно. */
export function mark(id: string, name: string, how: 'stored' | 'skipped'): void {
  const request = loadRequest(id)
  request.stored = request.stored.filter((n) => n !== name)
  request.skipped = request.skipped.filter((n) => n !== name)
  request[how].push(name)
  save(request)
}

/**
 * Что уже есть. Поле считается заполненным и тогда, когда человек положил ключ
 * в обход запроса — через `skey set` или `skey ui` после создания запроса.
 */
export function progress(request: KeyRequest): Progress {
  const fresh = new Set(list().filter((k) => k.updatedAt >= request.createdAt).map((k) => k.name))
  const out: Progress = { stored: [], skipped: [], missing: [] }

  for (const { name } of request.fields) {
    if (request.stored.includes(name) || fresh.has(name)) out.stored.push(name)
    else if (request.skipped.includes(name)) out.skipped.push(name)
    else out.missing.push(name)
  }
  return out
}

/**
 * Ждать, пока всё заполнят. true — готово, false — время вышло.
 * `poll` вызывается раз в 10 секунд — забрать удалённый ответ. Чаще не надо:
 * на бесплатном тарифе ретранслятора опрос и есть основная нагрузка.
 */
export function waitFor(id: string, timeoutMs: number, poll?: () => Promise<void>): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  let ticks = 0
  return new Promise((resolve) => {
    const tick = async () => {
      if (poll && ticks++ % 10 === 0) {
        try {
          await poll()
        } catch {
          // Сеть моргнула — спросим на следующем круге.
        }
      }
      if (progress(loadRequest(id)).missing.length === 0) return resolve(true)
      if (Date.now() >= deadline) return resolve(false)
      setTimeout(tick, 1000)
    }
    tick()
  })
}

/** Итог одной строкой — его и увидит ассистент. Только имена. */
export function summary(request: KeyRequest): string {
  const { stored, skipped, missing } = progress(request)
  const parts = [`stored: ${stored.join(', ') || '—'}`]
  if (skipped.length) parts.push(`skipped (left as is): ${skipped.join(', ')}`)
  if (missing.length) parts.push(`still missing: ${missing.join(', ')}`)
  return parts.join('; ')
}

/**
 * Убрать за собой: удалить запрос и ключи, которые появились благодаря ему.
 *
 * Ключи, лежавшие в хранилище до запроса, не трогаем, даже если их заменили:
 * человек хранил их для чего-то своего, и разовый перенос не повод их терять.
 */
export function clearRequest(id: string): { removed: string[]; kept: string[] } {
  const request = loadRequest(id)
  const { stored } = progress(request)
  const removed: string[] = []
  const kept: string[] = []

  for (const field of request.fields) {
    if (!stored.includes(field.name)) continue
    if (field.existing) kept.push(field.name)
    else {
      remove(field.name)
      removed.push(field.name)
    }
  }

  unlinkSync(file(id))
  return { removed, kept }
}

/** Закрыть все запросы. Ключи остаются. */
export function clearAllRequests(): number {
  let count = 0
  try {
    for (const entry of readdirSync(DIR)) {
      unlinkSync(join(DIR, entry))
      count++
    }
  } catch {
    // Папки нет — закрывать нечего.
  }
  return count
}

/** ID всех запросов, включая заполненные. */
export function allRequestIds(): string[] {
  try {
    return readdirSync(DIR).filter((e) => e.endsWith('.json')).map((e) => e.slice(0, -5))
  } catch {
    return []
  }
}
