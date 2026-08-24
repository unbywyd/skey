/**
 * Затирание значений в выводе дочернего процесса.
 *
 * API и CLI охотно печатают токен обратно — в ответе на ошибку, в отладочном
 * выводе, в `env`. Без фильтра он оттуда попадёт в контекст модели, и весь
 * смысл хранилища теряется.
 *
 * Ловим точное вхождение и две кодировки, в которых значение чаще всего
 * встречается по дороге. Это не гарантия: значение, разрезанное на части или
 * перекодированное иначе, пройдёт. Обещать полную защиту здесь нельзя, и в
 * README сказано ровно это.
 */

const REPLACEMENT = '***MASKED***'

/** Короткие строки не маскируем: «1» или «ok» затёрли бы половину вывода. */
const MIN_LENGTH = 6

function variants(value: string): string[] {
  const out = new Set<string>([value])

  out.add(Buffer.from(value, 'utf8').toString('base64'))
  out.add(encodeURIComponent(value))
  // JSON-строка добавляет экранирование — токен со слэшем в теле ответа
  // выглядит иначе, чем в исходном виде.
  out.add(JSON.stringify(value).slice(1, -1))

  return [...out].filter((v) => v.length >= MIN_LENGTH)
}

export function makeMasker(values: string[]): (text: string) => string {
  // Длинные значения заменяем первыми: иначе более короткое вхождение,
  // оказавшееся частью длинного, разорвёт его на куски и остаток утечёт.
  const needles = values
    .flatMap(variants)
    .sort((a, b) => b.length - a.length)

  if (needles.length === 0) return (text) => text

  return (text) => {
    let out = text
    for (const needle of needles) out = out.split(needle).join(REPLACEMENT)
    return out
  }
}
