// Презентация-тур по skey для skey.tscodex.com/tour: те же сцены, что и в
// раскадровке, но терминал «живой» — строки печатаются при переходе на слайд.
// Пишет relay/public/tour/index.html и картинки в relay/public/tour/img/.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, join } from 'node:path'
import { scenes } from './scenes.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'relay', 'public', 'tour')
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'img'), { recursive: true })

/** PNG → WebP рядом со страницей. Сами снимки — 956×782, им хватает качества 82. */
function webp(src) {
  const name = basename(src).replace(/\.png$/, '.webp')
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(here, src), '-c:v', 'libwebp', '-quality', '82', join(out, 'img', name)])
  return `img/${name}`
}

// Пара предложений к каждому слайду: что происходит и почему это безопасно.
const DESC = {
  'c0-ask': 'VEXELKIT lives in your OS keychain. Claude Code calls it through skey run — the value goes straight to the process, never into the conversation.',
  'c0-done': 'A real VexelKit generation: nine illustrations in the style of an existing pack, saved into the project. The chat only ever saw the name VEXELKIT.',
  'c1-ask': 'Instead of “paste your key here”, the agent runs skey request. A local page opens with exactly the fields it needs — and a note on where to find them.',
  'c1-fill': 'Values go from the form straight into the keychain. The page never shows them back, and the agent only learns the names.',
  'c1-done': 'The request exits by itself the moment you are done. The agent writes .env and runs the app — any echo of the key comes out as ***MASKED***.',
  'c2-fill': 'No browser needed: skey fill asks field by field. Input is hidden and nothing lands in your shell history.',
  'c2-done': 'Optional fields are skipped with Enter. The agent was waiting — it picks the key up the moment you finish.',
  'c3-ask': 'With --share, skey makes an end-to-end encrypted link. Send it through any chat: the link can answer the request, but never read the answer.',
  'c3-open': 'Nina needs no account and nothing to install. The page says who is asking and that only Alex’s computer can read the reply.',
  'c3-fill': 'Her browser encrypts the value with Alex’s public key before anything leaves the laptop.',
  'c3-done': 'The ciphertext passes through skey.tscodex.com into Alex’s keychain. The relay deletes it the moment it is picked up.',
  'keys': 'skey ui lists every key by name and date, newest on top. Values are never displayed — not even here.',
  'keys-replace': 'Rotating a key is one row: paste the new value and the old one is overwritten.',
}

/** Куда тур прокрутит окно браузера: точки фокуса пишет capture.mjs в <кейс>-meta.json. */
function focusOf(img) {
  const [, prefix, suffix] = basename(img).match(/^(c\d)-(.+)\.png$/) || []
  try {
    return JSON.parse(readFileSync(join(here, 'out', 'capture', `${prefix}-meta.json`), 'utf8'))[suffix] || 0
  } catch {
    return 0
  }
}

const slides = scenes.map((s) => {
  const slide = { ...s, desc: DESC[s.id] || '' }
  if (s.browser?.img) slide.browser = { ...s.browser, img: webp(s.browser.img), focus: focusOf(s.browser.img) }
  return slide
})

const LOGO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6.5" cy="12" r="3.75" stroke="currentColor" stroke-width="2.2"/><path d="M10.25 12H22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="14" y="14" width="8" height="4.5" rx="1" fill="#C93E12"/></svg>'

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>skey tour — how Claude Code works with your API keys</title>
<meta name="description" content="A one-minute walkthrough: an AI agent uses your API keys by name, asks for new ones without a paste, and gets keys from a friend end-to-end encrypted.">
<meta property="og:title" content="skey tour — your AI agent uses the key, never sees it">
<meta property="og:description" content="Five short chapters: keys you have, asking in the browser, the terminal, a friend's computer, and your key list.">
<meta property="og:url" content="https://skey.tscodex.com/tour">
<meta name="theme-color" content="#F4F2EC">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22%3E%3Ccircle cx=%226.5%22 cy=%2212%22 r=%223.75%22 stroke=%22%23111110%22 stroke-width=%222.2%22/%3E%3Cpath d=%22M10.25 12H22%22 stroke=%22%23111110%22 stroke-width=%222.2%22 stroke-linecap=%22round%22/%3E%3Crect x=%2214%22 y=%2214%22 width=%228%22 height=%224.5%22 rx=%221%22 fill=%22%23C93E12%22/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--paper:#F4F2EC;--ink:#111110;--ink2:#4A4843;--muted:#8A857A;--rule:#D9D5CB;--ver:#C93E12;--ver-soft:#FBE3D8;--night:#0F0F0E;--night2:#1D1C1A;--tt:#ECEAE4;--td:#8C887E;--tok:#71C28F;--tv:#FF7A45;--sans:"Geist",ui-sans-serif,system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--paper);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
body{display:flex;flex-direction:column;overflow:hidden}
a{color:inherit}
/* шапка */
.top{display:flex;align-items:center;gap:20px;padding:18px clamp(16px,3vw,40px);flex-shrink:0}
.logo{display:inline-flex;align-items:center;gap:10px;font:700 19px/1 var(--mono);letter-spacing:-.04em;text-decoration:none}
.top .sep{color:var(--muted);font:500 14px var(--mono)}
.top .grow{flex:1}
.count{font:500 14px var(--mono);color:var(--ink2);min-width:64px;text-align:right}
.btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:999px;border:0;background:#E5E1D7;color:var(--ink);font:500 14px var(--mono);cursor:pointer;text-decoration:none}
.btn:hover{background:#DAD5C9}
.btn.solid{background:var(--ink);color:var(--paper)}
.btn.solid:hover{background:#000}
.btn svg{width:16px;height:16px}
/* колода */
.deck{flex:1;position:relative;min-height:0}
.slide{position:absolute;inset:0;padding:8px clamp(16px,3vw,40px) 12px;display:flex;flex-direction:column;opacity:0;pointer-events:none;transform:translateX(24px);transition:opacity .35s,transform .35s}
.slide.on{opacity:1;pointer-events:auto;transform:none}
.slide.left{transform:translateX(-24px)}
.chap{font:500 15px/1 var(--mono);color:var(--ver);margin:0 0 12px;display:flex;gap:12px;align-items:center}
.dots{display:flex;gap:5px}.dots i{width:22px;height:4px;border-radius:2px;background:var(--rule)}.dots i.on{background:var(--ver)}
h2{font:600 clamp(24px,2.6vw,40px)/1.1 var(--mono);letter-spacing:-.045em;margin:0;max-width:1300px}
.desc{font-size:clamp(15px,1.25vw,19px);line-height:1.5;color:var(--ink2);margin:10px 0 0;max-width:900px}
.desc code{font:500 .92em var(--mono);color:var(--ink);background:#E9E6DD;padding:1px 6px;border-radius:5px}
.panes{flex:1;display:flex;gap:20px;min-height:0;margin-top:20px}
.win{border-radius:14px;overflow:hidden;display:flex;flex-direction:column;min-height:0;box-shadow:0 1px 2px rgba(17,17,16,.06),0 18px 50px rgba(17,17,16,.13)}
.bar{height:38px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 14px}
.lights{display:flex;gap:7px}.lights i{width:11px;height:11px;border-radius:50%;background:#3A3733}
.wt{font:500 13px var(--mono);color:var(--td);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.term{flex:0 0 44%;background:var(--night);color:var(--tt)}
.term.wide{flex:1}
.term .bar{background:var(--night2)}
.tb{flex:1;padding:16px 20px;font:clamp(12.5px,1vw,15.5px)/1.6 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
.l{min-height:1.6em}
.l.hide{display:none}
.l.user{background:#26251F;border-radius:8px;padding:5px 11px;margin:6px 0 9px;align-self:flex-start}
.l.user::before{content:"› ";color:var(--tv)}
.l.agent::before{content:"● ";color:var(--tv)}
.l.cmd{color:#fff;font-weight:500}.l.cmd::before{content:"$ ";color:var(--tv)}
.l.out{color:var(--td)}.l.ok{color:var(--tok)}.l.prompt{color:var(--tt)}
.mask{background:var(--tt);color:var(--night);padding:0 6px;border-radius:4px;font-weight:600}
.u{text-decoration:underline;text-decoration-color:var(--tv);text-underline-offset:3px}
.cur{display:inline-block;width:.6em;height:1.1em;vertical-align:-.18em;background:var(--tv);animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.browser{flex:1;background:#fff;position:relative}
.browser::after{content:"";position:absolute;left:0;right:0;bottom:0;height:56px;background:linear-gradient(rgba(244,242,236,0),rgba(244,242,236,.95));pointer-events:none}
.browser.dark::after{background:linear-gradient(rgba(15,15,14,0),rgba(15,15,14,.95))}
.browser .bar{background:#ECE9E1}.browser .lights i{background:#D6D2C7}
.url{flex:1;height:26px;border-radius:7px;background:#fff;display:flex;align-items:center;gap:7px;padding:0 10px;font:500 13px var(--mono);color:var(--ink2);white-space:nowrap;overflow:hidden}
.who{font:600 11px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--ink);padding:6px 9px;border-radius:999px;white-space:nowrap}
.view{flex:1;min-height:0;background:var(--paper);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.browser.dark .view{background:#0F0F0E}
.view img{display:block;width:100%;height:auto;opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s}
.view img.in{opacity:1;transform:none}
.chat{flex:1;background:#fff}.chat .bar{background:#ECE9E1}.chat .wt{color:var(--ink2)}
.thread{flex:1;padding:24px;display:flex;flex-direction:column;gap:12px;justify-content:flex-end;background:#F7F5F0}
.bubble{max-width:85%;padding:12px 16px;border-radius:16px;font:16px/1.45 var(--sans);align-self:flex-end;background:var(--ink);color:#fff;border-bottom-right-radius:5px;opacity:0;transform:translateY(10px);transition:opacity .5s,transform .5s}
.bubble.in{opacity:1;transform:none}
.bubble .lnk{font:500 14px/1.4 var(--mono);color:#FFB08F;word-break:break-all;display:block;margin-top:5px}
.bubble small{display:block;font:12px var(--sans);opacity:.6;margin-top:5px}
/* титульный и финальный */
.card{justify-content:center;padding-left:clamp(20px,8vw,140px);padding-right:clamp(20px,8vw,140px)}
.card .eye{font:500 clamp(14px,1.3vw,20px)/1 var(--mono);color:var(--ver);margin:0 0 28px}
.card h1{font:600 clamp(48px,8vw,124px)/.95 var(--mono);letter-spacing:-.06em;margin:0}
.card h1 .q{color:var(--muted)}
.card p{font:400 clamp(18px,1.8vw,26px)/1.4 var(--sans);color:var(--ink2);max-width:900px;margin:36px 0 0}
.card .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:40px}
.cmdline{display:inline-flex;align-items:center;gap:12px;background:var(--ink);color:var(--paper);font:500 clamp(16px,1.6vw,24px) var(--mono);padding:14px 22px;border-radius:12px;border:0;cursor:pointer}
.cmdline b{color:var(--ver);font-weight:500}
.card .credit{font:500 15px/1.5 var(--mono);color:var(--ink2);margin-top:34px}
.credit a{color:var(--ver)}
.card .hint{font:500 13px var(--mono);color:var(--muted);margin-top:28px}
/* низ */
.ctl{display:flex;align-items:center;gap:14px;padding:12px clamp(16px,3vw,40px) 18px;flex-shrink:0}
.prog{flex:1;display:flex;gap:4px}
.prog button{flex:1;height:6px;border:0;border-radius:3px;background:var(--rule);cursor:pointer;padding:0}
.prog button.done{background:#E7A58C}.prog button.on{background:var(--ver)}
.prog button.gap{margin-left:10px}
.nav{width:44px;height:44px;border-radius:50%;border:0;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:center;cursor:pointer}
.nav:disabled{opacity:.25;cursor:default}
.nav svg{width:20px;height:20px}
@media (max-width:860px){
  body{overflow:auto}
  .slide{position:relative;inset:auto;display:none;transform:none;padding-bottom:20px}
  .slide.on{display:flex}
  .deck{flex:none}
  .panes{flex-direction:column}
  .term{flex:none;min-height:320px}
  .chat{flex:none;min-height:300px}
  .browser{flex:none}
  .view{max-height:72vh}
  .top .sep,.top .tour,.gh{display:none}
}
@media (prefers-reduced-motion:reduce){.slide,.view img,.bubble{transition:none}.cur{animation:none}}
</style>
</head>
<body>
<header class="top">
  <a class="logo" href="/">${LOGO}skey</a><span class="sep">/</span><span class="sep tour">tour</span>
  <span class="grow"></span>
  <span class="count" id="count"></span>
  <button class="btn" id="play" type="button" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Autoplay</span></button>
  <a class="btn gh" href="https://github.com/unbywyd/skey">GitHub ↗</a>
</header>
<main class="deck" id="deck" aria-live="polite"></main>
<footer class="ctl">
  <button class="nav" id="prev" type="button" aria-label="Previous step"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>
  <div class="prog" id="prog"></div>
  <button class="nav" id="next" type="button" aria-label="Next step"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>
</footer>

<script>
const SLIDES = ${JSON.stringify(slides)}
const LOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4A4843" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const rich = (s) => esc(s).replace(/\\*\\*\\*MASKED\\*\\*\\*/g, '<span class="mask">***MASKED***</span>').replace(/\\[\\[(.+?)\\]\\]/g, '<span class="u">$1</span>')
const deck = document.getElementById('deck')
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

function chapHtml(s) {
  const [n, total] = s.chapter
  return '<p class="chap"><span class="dots">' + Array.from({ length: total }, (_, i) => '<i class="' + (i < n ? 'on' : '') + '"></i>').join('') + '</span>' + esc(s.chapterLabel) + '</p>'
}
const desc = (s) => s.desc ? '<p class="desc">' + esc(s.desc).replace(/(skey (?:run|request|fill|ui|dotenv|import|clean|wait)|--share|\\.env|VEXELKIT|\\*\\*\\*MASKED\\*\\*\\*)/g, '<code>$1</code>') + '</p>' : ''
const term = (t, wide) => '<div class="win term' + (wide ? ' wide' : '') + '"><div class="bar"><span class="lights"><i></i><i></i><i></i></span><span class="wt">' + esc(t.title) + '</span></div><div class="tb">' +
  t.lines.filter((l) => !l.cursor || l.s).map((l) => '<div class="l hide ' + (l.t || 'out') + '" data-s="' + esc(l.s || '') + '">' + rich(l.s || '') + '</div>').join('') + '<div class="l out"><span class="cur"></span></div></div></div>'

function build(s, i) {
  const el = document.createElement('section')
  el.className = 'slide'
  el.setAttribute('aria-label', 'Step ' + (i + 1) + ' of ' + SLIDES.length)
  if (s.layout === 'title') {
    el.classList.add('card')
    el.innerHTML = '<p class="eye">' + esc(s.eyebrow) + '</p><h1>' + s.title + '</h1><p>' + esc(s.text) + '</p>' +
      '<div class="row"><button class="cmdline" type="button" data-go="1">Start the tour <b>→</b></button></div>' +
      '<p class="hint">← → or swipe · five chapters · about a minute</p>'
  } else if (s.layout === 'outro') {
    el.classList.add('card')
    el.innerHTML = '<p class="eye">' + esc(s.eyebrow) + '</p><h1 style="font-size:clamp(40px,6vw,96px)">' + s.title + '</h1>' +
      '<div class="row"><button class="cmdline" type="button" data-copy="' + esc(s.cmd) + '"><b>$</b>' + esc(s.cmd) + '</button>' +
      '<a class="btn solid" href="/">' + esc(s.site) + '</a><a class="btn" href="https://github.com/unbywyd/skey">GitHub ↗</a>' +
      '<a class="btn" href="https://github.com/unbywyd/skey/tree/main/skill">Agent skill ↗</a></div>' +
      '<p class="credit">Illustrations in this tour: <a href="https://vexelkit.com">VexelKit</a> — image packs in your style, generated by your agent.</p>'
  } else {
    let right = ''
    if (s.term2) right = term(s.term2, true)
    if (s.browser) right = '<div class="win browser' + (s.browser.who ? ' dark' : '') + '"><div class="bar"><span class="lights"><i></i><i></i><i></i></span><span class="url">' + (s.browser.secure ? LOCK : '') + esc(s.browser.url) + '</span>' +
      (s.browser.who ? '<span class="who">' + esc(s.browser.who) + '</span>' : '') + '</div><div class="view"><img src="' + esc(s.browser.img) + '" alt="' + esc(s.caption) + '" loading="lazy"></div></div>'
    if (s.chat) right = '<div class="win chat"><div class="bar"><span class="lights"><i></i><i></i><i></i></span><span class="wt">' + esc(s.chat.title) + '</span></div><div class="thread">' +
      s.chat.messages.map((m) => '<div class="bubble">' + esc(m.text) + (m.link ? '<span class="lnk">' + esc(m.link) + '</span>' : '') + (m.meta ? '<small>' + esc(m.meta) + '</small>' : '') + '</div>').join('') + '</div></div>'
    el.innerHTML = chapHtml(s) + '<h2>' + esc(s.caption) + '</h2>' + desc(s) + '<div class="panes">' + term(s.term, !right) + right + '</div>'
  }
  deck.appendChild(el)
  return el
}
const els = SLIDES.map(build)

// --- прогресс по главам ------------------------------------------------------------
const prog = document.getElementById('prog')
SLIDES.forEach((s, i) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.setAttribute('aria-label', 'Go to step ' + (i + 1))
  if (i > 0 && SLIDES[i - 1].chapter?.[0] !== s.chapter?.[0]) b.className = 'gap'
  b.onclick = () => go(i)
  prog.appendChild(b)
})

// --- печать терминала ----------------------------------------------------------------
let run = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms))

/** Сколько строк этого терминала уже было на предыдущем слайде той же главы — их не печатаем заново. */
function shared(prev, cur) {
  if (!prev || !cur || prev.title !== cur.title) return 0
  let n = 0
  const a = prev.lines.filter((l) => l.s), b = cur.lines.filter((l) => l.s)
  while (n < a.length && n < b.length && a[n].s === b[n].s) n++
  return n
}

async function typeTerm(win, model, skip, token) {
  const lines = [...win.querySelectorAll('.l[data-s]')]
  for (const [i, el] of lines.entries()) {
    if (token !== run) return
    el.classList.remove('hide')
    if (i < skip) continue
    if (el.classList.contains('cmd')) {
      const text = el.dataset.s
      for (let c = 1; c <= text.length; c += 2) {
        if (token !== run) return
        el.textContent = text.slice(0, c)
        await sleep(14)
      }
      el.innerHTML = rich(text)
      await sleep(260)
    } else {
      await sleep(el.classList.contains('user') ? 380 : el.classList.contains('agent') ? 240 : 90)
    }
  }
}

async function animate(i, from) {
  const token = ++run
  const s = SLIDES[i], el = els[i], prev = from === i - 1 ? SLIDES[from] : null
  if (!s.term) return
  const wins = el.querySelectorAll('.term')
  el.querySelectorAll('.l[data-s]').forEach((l) => { l.classList.add('hide'); l.innerHTML = rich(l.dataset.s) })
  el.querySelectorAll('.view img,.bubble').forEach((x) => x.classList.remove('in'))
  el.querySelectorAll('.view').forEach((v) => { v.scrollTop = 0 })
  await typeTerm(wins[0], s.term, shared(prev?.term, s.term), token)
  if (s.term2 && wins[1]) await typeTerm(wins[1], s.term2, shared(prev?.term2, s.term2), token)
  if (token !== run) return
  el.querySelectorAll('.view img,.bubble').forEach((x) => x.classList.add('in'))
  // Окно браузера само доезжает до главного места страницы; дальше его можно крутить.
  const view = el.querySelector('.view'), img = view?.querySelector('img')
  if (!view || !img || !s.browser?.focus) return
  const glide = () => setTimeout(() => token === run && view.scrollTo({ top: s.browser.focus * img.clientWidth / 956, behavior: reduced ? 'auto' : 'smooth' }), 450)
  img.complete ? glide() : img.addEventListener('load', glide, { once: true })
}

// --- навигация -----------------------------------------------------------------------
let cur = -1
function go(i) {
  i = Math.max(0, Math.min(SLIDES.length - 1, i))
  if (i === cur) return
  const from = cur
  els.forEach((el, k) => { el.classList.toggle('on', k === i); el.classList.toggle('left', k < i) })
  ;[...prog.children].forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i) })
  document.getElementById('count').textContent = String(i + 1).padStart(2, '0') + ' / ' + SLIDES.length
  document.getElementById('prev').disabled = i === 0
  document.getElementById('next').disabled = i === SLIDES.length - 1
  cur = i
  history.replaceState(null, '', '#' + (i + 1))
  animate(i, from)
  schedule()
}
document.getElementById('prev').onclick = () => go(cur - 1)
document.getElementById('next').onclick = () => go(cur + 1)
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1) }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1) }
  if (e.key === 'Home') go(0)
  if (e.key === 'End') go(SLIDES.length - 1)
})
let touchX = null
deck.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX }, { passive: true })
deck.addEventListener('touchend', (e) => {
  if (touchX === null) return
  const dx = e.changedTouches[0].clientX - touchX
  if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1))
  touchX = null
})
document.addEventListener('click', async (e) => {
  const goTo = e.target.closest('[data-go]')
  if (goTo) go(Number(goTo.dataset.go))
  const copy = e.target.closest('[data-copy]')
  if (copy) { await navigator.clipboard.writeText(copy.dataset.copy); copy.lastChild.textContent = 'Copied' }
})

// --- автопроигрывание ----------------------------------------------------------------
let auto = false, timer = null
const play = document.getElementById('play')
function schedule() {
  clearTimeout(timer)
  if (!auto) return
  if (cur === SLIDES.length - 1) { setAuto(false); return }
  timer = setTimeout(() => go(cur + 1), cur === 0 ? 3500 : 6500)
}
function setAuto(on) {
  auto = on
  play.setAttribute('aria-pressed', String(on))
  play.querySelector('span').textContent = on ? 'Pause' : 'Autoplay'
  play.querySelector('svg').innerHTML = on ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>'
  schedule()
}
play.onclick = () => setAuto(!auto)

go(Math.max(0, Number(location.hash.slice(1)) - 1 || 0))
</script>
</body>
</html>`

writeFileSync(join(out, 'index.html'), html)
console.log('tour:', slides.length, 'slides →', out)
