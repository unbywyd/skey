// Проверка лендинга: блок «спроси свою LLM» и копирование промпта.
//   node landingcheck.mjs [url]   — без url собирает превью из relay/src/landing.ts
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

let url = process.argv[2]
if (!url) {
  const src = readFileSync('../relay/src/landing.ts', 'utf8')
  writeFileSync('out/landing-preview.html', JSON.parse(src.slice(src.indexOf('= ') + 2).trim()))
  url = pathToFileURL(resolve('out/landing-preview.html')).href
}

const b = await chromium.launch({ channel: 'chrome' })
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })).newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(url)
await p.waitForTimeout(1000)
const box = await p.locator('.ask').boundingBox()
await p.screenshot({ path: 'out/landing-ask.png', fullPage: true, clip: { x: 0, y: box.y - 420, width: 1440, height: 560 } })
await p.click('.askbtn')
const copied = await p.evaluate(() => navigator.clipboard.readText())
console.log('button:', await p.textContent('.askbtn span'), '| copied chars:', copied.length, '| starts:', JSON.stringify(copied.slice(0, 50)), '| errors:', errs)

const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await m.goto(url)
await m.waitForTimeout(800)
await m.locator('.ask').scrollIntoViewIfNeeded()
await m.screenshot({ path: 'out/landing-ask-phone.png' })
await b.close()
