import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const url = pathToFileURL(resolve('../relay/public/tour/index.html')).href
const b = await chromium.launch({ channel: 'chrome' })
const p = await (await b.newContext({ viewport: { width: 2000, height: 1000 } })).newPage()
p.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
for (const n of [5, 11, 14]) {
  await p.goto(url + '#' + n); await p.reload(); await p.waitForTimeout(6500)
  const st = await p.evaluate(() => { const v = document.querySelector('.slide.on .view'); return v && [Math.round(v.scrollTop), v.scrollHeight, v.clientHeight] })
  console.log('slide', n, 'scrollTop/scrollHeight/clientHeight', st)
  await p.screenshot({ path: `out/tourwide-${n}.png` })
}
await b.close()
