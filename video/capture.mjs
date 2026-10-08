// Снимки настоящих страниц skey для ролика: открыть, ввести демо-значения,
// снять кадры до и после отправки. Размер — как окно браузера на сцене.
//
//   node capture.mjs local  <url> <out-prefix> '<values json>'
//   node capture.mjs remote <url> <out-prefix> '<values json>' <name>
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const [mode, url, prefix, valuesJson, name] = process.argv.slice(2)
const values = JSON.parse(valuesJson)
const VIEW = { width: 956, height: 782 }

const browser = await chromium.launch({ channel: 'chrome' })

// Страница ключей: добавить через форму фоновые демо-ключи, состарить их даты
// в демо-индексе (name = путь к нему), снять список и замену в строке.
if (mode === 'keys') {
  const { readFileSync } = await import('node:fs')
  const page = await (await browser.newContext({ viewport: VIEW })).newPage()
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))
  await page.goto(url)
  await page.waitForSelector('#save')
  for (const key of Object.keys(values)) {
    await page.fill('#name', key)
    await page.fill('#value', `demo-${key.toLowerCase()}-value-0000`)
    await page.click('#save')
    await page.waitForTimeout(400)
  }
  const index = JSON.parse(readFileSync(name, 'utf8'))
  for (const k of index) {
    if (k.name in values) k.updatedAt = new Date(Date.now() - values[k.name] * 86_400_000).toISOString()
  }
  writeFileSync(name, JSON.stringify(index, null, 2))
  await page.reload()
  await page.waitForSelector('.row')
  await page.mouse.move(5, 5) // курсор не должен висеть над кнопкой
  await page.waitForTimeout(3500) // тост «Stored» успевает исчезнуть
  const y = (sel) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  const meta = { keys: Math.round(await y('#form')) - 40 }
  await page.screenshot({ path: `${prefix}-keys.png`, fullPage: true })
  await page.locator('.row[data-name="STRIPE_SECRET_KEY"] [data-act="replace"]').click()
  await page.locator('#rvalue').pressSequentially('demo-only-rotated-key-not-real-0000', { delay: 4 })
  await page.mouse.move(5, 5)
  meta.replace = Math.round(await y('.row.replacing')) - 260
  await page.screenshot({ path: `${prefix}-replace.png`, fullPage: true })
  writeFileSync(`${prefix}-meta.json`, JSON.stringify(meta))
  await browser.close()
  process.exit(0)
}

const page = await (await browser.newContext({ viewport: VIEW, colorScheme: mode === 'remote' ? 'dark' : 'light' })).newPage()
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))

const meta = {}
/** Снимок страницы целиком + точка, до которой тур прокрутит окно (px от верха страницы). */
const shot = async (suffix, focus = 0) => {
  meta[suffix] = Math.max(0, Math.round(focus))
  await page.screenshot({ path: `${prefix}-${suffix}.png`, fullPage: true })
}
const top = (sel) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
const settle = () => page.evaluate(() => document.activeElement && document.activeElement.blur())

await page.goto(url)
await page.waitForSelector('#save')
await settle()
await shot('open')

// Набираем по символу: так поле заполняется как у человека, и маска точек растёт.
for (const [field, value] of Object.entries(values)) {
  const input = page.locator(`input[data-name="${field}"]`)
  await input.scrollIntoViewIfNeeded()
  await input.click()
  await input.pressSequentially(value, { delay: 4 })
}
if (name) {
  await page.locator('#by').scrollIntoViewIfNeeded()
  await page.locator('#by').click()
  await page.locator('#by').pressSequentially(name, { delay: 20 })
}
await settle()
await shot('filled', (await top('.fields')) - 150)

await page.click('#save')
await page.waitForTimeout(1500)
await page.evaluate(() => window.scrollTo(0, 0))
await shot('done')

writeFileSync(`${prefix}-meta.json`, JSON.stringify(meta))
await browser.close()
