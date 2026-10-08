/**
 * Хранилище секретов поверх системного: Keychain на macOS, Credential Manager
 * на Windows, secret-service на Linux.
 *
 * Значения не попадают ни в файлы, ни в переменные окружения этого процесса —
 * только в окружение дочернего в момент запуска. Смысл в том, чтобы токен не
 * оказался в контексте модели: увидев его, она обязана считать ключ
 * скомпрометированным и начинает отказываться работать.
 */

import { Entry } from '@napi-rs/keyring'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

/** Общий префикс, чтобы наши записи было видно среди чужих в Keychain. */
const SERVICE = 'tscodex-skey'

/**
 * Список имён и дат ведём отдельно.
 *
 * Системные хранилища не дают перечислить записи по сервису — только достать
 * по точному имени. Без своего индекса `list` был бы невозможен. В файле лежат
 * только имена и даты, значений там нет никогда.
 */
const INDEX = join(homedir(), '.tscodex', 'skey-index.json')

export interface KeyInfo {
  name: string
  updatedAt: string
}

/** Имя переменной окружения: то, что можно подставить в команду без кавычек. */
export const NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/

function readIndex(): KeyInfo[] {
  try {
    return JSON.parse(readFileSync(INDEX, 'utf8')) as KeyInfo[]
  } catch {
    // Файла нет или он испорчен — для вызывающего это пустой список.
    return []
  }
}

function writeIndex(keys: KeyInfo[]): void {
  mkdirSync(dirname(INDEX), { recursive: true })
  writeFileSync(INDEX, JSON.stringify(keys, null, 2), { mode: 0o600 })
}

export function list(): KeyInfo[] {
  return readIndex().sort((a, b) => a.name.localeCompare(b.name))
}

export function has(name: string): boolean {
  return readIndex().some((k) => k.name === name)
}

export function set(name: string, value: string): void {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Invalid name "${name}". Use A-Z, 0-9 and underscore, starting with a letter.`)
  }
  if (value.length === 0) throw new Error('Value is empty.')

  new Entry(SERVICE, name).setPassword(value)

  const keys = readIndex().filter((k) => k.name !== name)
  keys.push({ name, updatedAt: new Date().toISOString() })
  writeIndex(keys)
}

/**
 * Достать значение.
 *
 * Вызывается ровно из двух мест: при запуске дочернего процесса и командой
 * export. Наружу значения не отдаём — см. cli.
 */
export function get(name: string): string {
  const value = new Entry(SERVICE, name).getPassword()
  // Отсутствующая запись приходит как null, а не исключением.
  if (value === null) throw new Error(`No secret named ${name}.`)
  return value
}

export function remove(name: string): boolean {
  const removed = new Entry(SERVICE, name).deletePassword()
  writeIndex(readIndex().filter((k) => k.name !== name))
  return removed
}

/**
 * Ключи удалённого запроса: секрет ссылки, приватный ключ, токен владельца.
 *
 * Лежат в том же хранилище, но под отдельным сервисом и вне индекса: это не
 * ключи пользователя, в `list` и `run` им делать нечего.
 */
const REQUEST_SERVICE = 'tscodex-skey-request'

export interface RequestSecrets {
  secret: string
  priv: string
  owner?: string
}

export function setRequestSecrets(id: string, secrets: RequestSecrets): void {
  new Entry(REQUEST_SERVICE, id).setPassword(JSON.stringify(secrets))
}

export function getRequestSecrets(id: string): RequestSecrets | null {
  const raw = new Entry(REQUEST_SERVICE, id).getPassword()
  return raw ? (JSON.parse(raw) as RequestSecrets) : null
}

export function removeRequestSecrets(id: string): void {
  try {
    new Entry(REQUEST_SERVICE, id).deletePassword()
  } catch {
    // Не было — и ладно.
  }
}
