/**
 * Запуск команды с секретами в её окружении.
 *
 * Значения живут только в окружении дочернего процесса и только на время его
 * работы: родительское окружение не трогаем, в аргументы командной строки не
 * пишем (они видны в списке процессов любому на машине).
 */

import { spawn } from 'node:child_process'
import { get } from './store.js'
import { makeMasker } from './mask.js'

export interface RunOptions {
  names: string[]
  command: string
  args: string[]
  mask: boolean
}

export async function run(options: RunOptions): Promise<number> {
  const secrets: Record<string, string> = {}

  // Достаём всё до запуска: отсутствующий секрет должен остановить нас раньше,
  // чем команда что-то сделает наполовину.
  for (const name of options.names) secrets[name] = get(name)

  const masker = options.mask ? makeMasker(Object.values(secrets)) : (t: string) => t

  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      env: { ...process.env, ...secrets },
      // На Windows оболочка нужна только раннерам (npx, git — это .cmd, без
      // неё они не стартуют). Для остального она вредна: переинтерпретирует
      // кавычки, и аргумент с пробелами приезжает разорванным.
      shell: process.platform === 'win32' && /\.(cmd|bat)$|^(npx|npm|yarn|pnpm)$/i.test(options.command),
      stdio: options.mask ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    })

    if (options.mask) {
      // Построчно, а не по мере прихода байтов: значение может разорваться
      // между двумя чанками, и тогда фильтр его не увидит.
      pipeMasked(child.stdout, process.stdout, masker)
      pipeMasked(child.stderr, process.stderr, masker)
    }

    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })
}

function pipeMasked(
  source: NodeJS.ReadableStream | null,
  target: NodeJS.WritableStream,
  masker: (text: string) => string,
): void {
  if (!source) return

  let buffer = ''
  source.setEncoding('utf8')

  source.on('data', (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    // Последний элемент — незавершённая строка, ждём остаток.
    buffer = lines.pop() ?? ''
    for (const line of lines) target.write(masker(line) + '\n')
  })

  source.on('end', () => {
    if (buffer.length > 0) target.write(masker(buffer))
  })
}
