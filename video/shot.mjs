// Снимок локальной страницы в размер окна браузера на сцене: node shot.mjs <file.html> <out.png>
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const [file, out] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'chrome' })
const p = await (await b.newContext({ viewport: { width: 956, height: 782 } })).newPage()
await p.goto(pathToFileURL(resolve(file)).href)
await p.waitForTimeout(800)
await p.screenshot({ path: out, fullPage: true })
await b.close()
