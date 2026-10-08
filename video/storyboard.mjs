// Раскадровка: каждый кадр сцены — PNG 1920×1080 плюс страница-обзор.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { scenes } from './scenes.mjs'

const out = new URL('./out/storyboard/', import.meta.url)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message))
await page.goto(pathToFileURL(new URL('./stage.html', import.meta.url).pathname.slice(1)).href)
await page.evaluate(() => document.fonts.ready)

const files = []
for (const [i, scene] of scenes.entries()) {
  await page.evaluate((s) => window.render(s), scene)
  await page.waitForTimeout(250)
  const file = `${String(i + 1).padStart(2, '0')}-${scene.id}.png`
  await page.screenshot({ path: new URL(file, out).pathname.slice(1) })
  files.push({ file, scene })
}
await browser.close()

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const caption = (s) => s.caption || s.title.replace(/<[^>]+>/g, ' ')
writeFileSync(new URL('index.html', out).pathname.slice(1), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>skey — storyboard</title><style>
body{margin:0;background:#F4F2EC;color:#111110;font:16px/1.5 ui-sans-serif,system-ui,sans-serif;padding:48px}
h1{font:600 36px ui-monospace,Menlo,Consolas,monospace;letter-spacing:-.04em;margin:0 0 8px}
.lead{color:#4A4843;margin:0 0 40px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:32px}
.f{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.f img{display:block;width:100%;border-bottom:1px solid #ECE9E1}
.f div{padding:14px 18px}
.n{font:600 13px ui-monospace,Menlo,Consolas,monospace;color:#C93E12}
.c{font-weight:600;margin:4px 0}
.d{color:#6E6A62;font-size:14px}
</style></head><body><h1>skey — storyboard</h1>
<p class="lead">${files.length} key frames · 1920×1080 · real skey output and real pages, demo keys only.</p>
<div class="grid">${files.map(({ file, scene }, i) => `<div class="f"><a href="${file}"><img src="${file}" alt=""></a><div>
<span class="n">${String(i + 1).padStart(2, '0')} · ${esc(scene.chapterLabel || scene.layout)}</span>
<p class="c">${esc(caption(scene))}</p><p class="d">${esc(scene.note)}</p></div></div>`).join('')}</div></body></html>`)
console.log('frames:', files.map((f) => f.file).join(' '))
