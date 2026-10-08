// Проверка тура: слайды после анимации на десктопе и телефоне.
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const url = process.argv[2] || pathToFileURL(resolve('../relay/public/tour/index.html')).href
const b = await chromium.launch({ channel: 'chrome' })
for (const [w, h, tag, list] of [[1440, 900, 'desk', [1, 3, 6, 9, 10, 13, 15]], [390, 844, 'phone', [3, 6]]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage()
  p.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
  for (const n of list) {
    await p.goto(url + '#' + n); await p.reload()
    await p.waitForTimeout(5500)
    await p.screenshot({ path: `out/tour-${tag}-${String(n).padStart(2, '0')}.png`, fullPage: tag === 'phone' })
  }
}
// стрелка вправо со 2-го на 3-й: общие строки не печатаются заново
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto(url + '#2'); await p.waitForTimeout(4000)
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300)
console.log('after → visible lines:', await p.locator('.slide.on .l[data-s]:not(.hide)').count(), 'hash', await p.evaluate(() => location.hash))
await b.close()
