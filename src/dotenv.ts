/**
 * Перенос ключей в .env без участия ассистента.
 *
 * Самое частое место, куда ключ должен попасть в итоге, — файл окружения
 * проекта. Собирать его через `sh -c 'printf ...'` хрупко (кавычки, Windows,
 * спецсимволы в пароле), поэтому запись делаем сами. Наружу — только имена.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { get } from './store.js'

export interface DotenvResult {
  updated: string[]
  added: string[]
}

/**
 * Значение в виде, который одинаково прочитают dotenv, docker compose и
 * shell. Одинарные кавычки буквальны — `$` внутри не раскроется; двойные
 * нужны только для переводов строки и самих одинарных кавычек.
 */
function quote(value: string): string {
  if (/^[A-Za-z0-9_\-.\/:@+,]*$/.test(value)) return value
  if (!/['\n\r]/.test(value)) return `'${value}'`
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}"`
}

/** @param env имя в файле → имя ключа в хранилище */
export function writeDotenv(path: string, env: Record<string, string>): DotenvResult {
  // Все значения достаём до записи: отсутствующий ключ не должен оставить
  // файл заполненным наполовину.
  const values: Record<string, string> = {}
  for (const [variable, stored] of Object.entries(env)) values[variable] = get(stored)

  const original = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const eol = original.includes('\r\n') ? '\r\n' : '\n'
  const lines = original.length ? original.split(/\r?\n/) : []
  // Хвостовой перевод строки даёт пустой последний элемент — уберём, вернём в конце.
  if (lines.length && lines[lines.length - 1] === '') lines.pop()

  const result: DotenvResult = { updated: [], added: [] }

  for (const [variable, value] of Object.entries(values)) {
    const pattern = new RegExp(`^\\s*(export\\s+)?${variable}\\s*=`)
    const index = lines.findIndex((line) => pattern.test(line))
    const line = `${variable}=${quote(value)}`

    if (index === -1) {
      lines.push(line)
      result.added.push(variable)
    } else {
      // `export ` оставляем: файл могут подключать через source.
      const prefix = /^\s*export\s+/.test(lines[index]) ? 'export ' : ''
      lines[index] = prefix + line
      result.updated.push(variable)
    }
  }

  writeFileSync(path, lines.join(eol) + eol, { mode: 0o600 })
  return result
}
