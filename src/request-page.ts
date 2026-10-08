/**
 * Страница одного запроса: форма ровно на те поля, которые попросил ассистент.
 *
 * Одна страница на два режима, чтобы для человека не было разницы, отвечает
 * он на своём компьютере или на чужом:
 *
 *   — локально (`?t=` в адресе): её отдаёт `skey request` на 127.0.0.1,
 *     значения уходят прямо в хранилище этой машины;
 *   — удалённо (`/r/<id>#<секрет>`): её отдаёт ретранслятор, значения
 *     шифруются здесь же, в браузере, ключом автора запроса, и сервер видит
 *     только шифр. Если в ссылке после секрета есть описание запроса
 *     (`#секрет.описание`), сервер не нужен вовсе: ответ выдаётся строкой,
 *     которую отвечающий пересылает сам.
 *
 * В обоих режимах значения только отправляются — страница их не получает.
 */

import { ENVELOPE_JS } from './envelope-js.js'
import { THEME_CSS, ICON, LOGO, FAVICON } from './theme.js'

export const REQUEST_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>skey — keys requested</title>
${FAVICON}
<style>${THEME_CSS}
.who{display:flex;align-items:center;gap:12px;margin-top:48px;color:var(--muted)}
.who b{color:var(--text)}
.who + .t{margin-top:18px}
.av{width:40px;height:40px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:flex;align-items:center;justify-content:center;font:700 16px var(--mono);flex-shrink:0}
.trust{display:flex;gap:10px;align-items:flex-start;color:var(--muted);margin-top:14px}
.trust svg{color:var(--text);margin-top:2px}
.vault{background:var(--vault);color:var(--vault-text);border-radius:16px;padding:22px 24px;margin-top:28px;display:flex;gap:16px;align-items:flex-start}
.vault .lk{width:40px;height:40px;border-radius:10px;background:#C93E12;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.vault .lk svg.i{width:20px;height:20px}
.vault h2{font:650 18px/1.3 var(--mono);letter-spacing:-.03em;margin:0}
.vault p{margin:4px 0 0;color:var(--vault-muted)}
.facts{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}
.facts span{font:500 12px/1 var(--mono);padding:7px 9px;border-radius:6px;background:var(--vault-chip);color:var(--vault-chip-text)}
.note{background:var(--sunken);border-radius:4px 14px 14px 14px;padding:14px 16px;margin-top:32px}
.note-h{display:flex;align-items:center;gap:8px;font:600 12px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-bottom:8px}
.note-h svg.i{width:14px;height:14px}
.note p{margin:0;white-space:pre-line;overflow-wrap:anywhere}
.fields{padding:24px;display:flex;flex-direction:column;gap:24px;margin-top:16px}
.fields .lbl .kn{font-weight:500}
.alert{display:flex;gap:8px;align-items:center;color:var(--danger);font-size:14px;font-weight:500;margin:20px 0 0}
.alert:empty{display:none}
.submit{margin-top:20px}
.alt{margin-top:40px;display:flex;flex-direction:column;gap:10px}
.alt-h{display:flex;justify-content:space-between;gap:12px;font-size:14px;color:var(--muted)}
.alt-h .mono{font:12.5px var(--mono)}
.blob{margin-top:24px;background:var(--surface);border-radius:14px;padding:16px}
.blob-h{display:flex;justify-content:space-between;font:600 11px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-bottom:10px}
.blob textarea{width:100%;height:208px;border:0;resize:none;background:var(--sunken);border-radius:8px;padding:12px;font:12.5px/1.6 var(--mono);color:var(--text);word-break:break-all;outline:none}
.blob .btn{margin-top:12px}
.btn-done{background:var(--ok-soft);color:var(--ok)}
.safe{display:flex;gap:8px;align-items:flex-start;font-size:14px;color:var(--muted);margin-top:20px}
.safe svg{color:var(--ok);margin-top:2px}
@media (max-width:560px){
  .who{margin-top:36px;font-size:14px}
  .av{width:32px;height:32px;font-size:14px}
  .vault{flex-direction:column;padding:18px;gap:12px}
  .fields{padding:16px}
  .note{background:var(--surface)}
}
</style></head>
<body><main class="col" id="root"><div class="top">${LOGO}</div><p class="lede" style="margin-top:48px">Loading…</p></main>

<script>
const E = (${ENVELOPE_JS})(window.crypto)
const ICON = ${JSON.stringify(ICON)}
const LOGO = ${JSON.stringify(LOGO)}

const root = document.getElementById('root')
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';')
const decodeJson = (text) => JSON.parse(new TextDecoder().decode(E.unb64u(text)))
const plural = (n, one) => n === 1 ? 'a ' + one : '<span class="n">' + n + '</span> ' + one + 's'

// Режим определяется адресом: локальный токен или удалённый запрос с секретом.
const token = new URLSearchParams(location.search).get('t')
const remoteMatch = /^[/]r[/]([a-z0-9]+)$/.exec(location.pathname)
const [secret, offlineMeta] = location.hash.slice(1).split('.')
const remote = !token && remoteMatch && secret ? { id: remoteMatch[1], secret, offline: Boolean(offlineMeta) } : null

let request = null

function cmd(text, shown) {
  return '<div class="cmd"><code><span class="p">$ </span>' + esc(shown || text) + '</code>' +
    '<button class="ib" type="button" data-copy="' + esc(text) + '" aria-label="Copy command">' + ICON.copy + '</button></div>'
}

/** Один шаблон для всех конечных состояний: значок, заголовок, одна-две строки. */
function stub(kind, icon, title, text, extra) {
  root.innerHTML = '<div class="top">' + LOGO + '</div>' +
    '<div class="stub" role="status"><div class="ic ' + kind + '">' + ICON[icon] + '</div>' +
    '<h1 class="t">' + title + '</h1><p class="d">' + text + '</p>' + (extra || '') + '</div>' +
    '<div class="foot"><span>part of <a href="https://tscodex.com">tscodex</a></span>' +
    (remote ? '<span><a href="/">What is skey?</a></span>' : '') + '</div>'
}

// --- загрузка: одинаковая форма для обоих режимов ---------------------------------

async function loadLocal(quiet) {
  let res
  try { res = await fetch('/api/request', { headers: { 'x-skey-token': token } }) } catch (e) { res = null }
  if (!res || !res.ok) {
    if (quiet && request) return
    return stub('mu', 'terminal', 'This request is closed', 'Ask the assistant for a new link.')
  }
  const r = await res.json()
  if (r.missing.length === 0) return localDone(r)
  if (quiet) return
  request = { id: r.id, note: r.note, fields: r.fields, stored: r.stored, closesAt: r.closesAt }
  render()
}

async function loadRemote() {
  let box
  if (remote.offline) {
    try { box = decodeJson(offlineMeta) } catch (e) { return broken() }
  } else {
    let res
    try { res = await fetch('/api/r/' + remote.id) } catch (e) { res = null }
    if (!res || !res.ok) return stub('mu', 'alert', 'This link no longer works', 'It has expired or was already used. Ask for a new one.')
    const r = await res.json()
    if (r.answered) return stub('mu', 'lock', 'Already answered', 'Someone has already replied to this request. Each link takes one reply.')
    box = r.meta
  }

  let meta
  try { meta = await E.openMeta(remote.secret, box) } catch (e) { return broken() }
  request = { id: remote.id, note: meta.note, fields: meta.fields, stored: [], from: meta.from, pub: meta.pub, expiresAt: meta.expiresAt }
  render()
}

function broken() {
  stub('no', 'alert', 'Part of the link is missing', 'Copy the whole link, including everything after #.')
}

function localDone(r) {
  const badge = (f) => r.stored.includes(f.name) ? '<span class="badge ok">stored</span>'
    : f.existing ? '<span class="badge">kept</span>' : '<span class="badge">skipped</span>'
  const names = '<div class="names">' + r.fields.map((f) =>
    '<div class="r"><span class="kn">' + esc(f.name) + '</span><span class="rd" aria-hidden="true"' +
    (r.stored.includes(f.name) || f.existing ? '' : ' style="opacity:.2"') + '></span>' + badge(f) + '</div>').join('') + '</div>'
  stub('ok', 'check', "Saved to this machine's keychain", 'You can close this tab. The assistant continues on its own.', names)
}

// --- форма --------------------------------------------------------------------

function field(f) {
  const done = request.stored.includes(f.name)
  const id = 'f-' + f.name
  const badge = done ? '<span class="badge ok">' + ICON.check + 'Stored</span>'
    : f.existing ? '<span class="badge">' + (remote ? 'Has one' : 'Already stored') + '</span>'
    : f.optional ? '<span class="badge">Optional</span>' : ''
  const placeholder = done ? 'Type to replace'
    : f.existing ? (remote ? 'They already have one — leave empty to keep it' : 'Leave empty to keep the current one') : ''
  return '<div>' +
    '<label class="lbl" for="' + id + '"><span>' + esc(f.label || f.name) + '</span>' +
    (f.label ? '<span class="kn">' + esc(f.name) + '</span>' : '') + badge + '</label>' +
    '<div class="fld"><input class="in" id="' + id + '" data-name="' + esc(f.name) + '" type="password" autocomplete="off" spellcheck="false"' +
    ' placeholder="' + esc(placeholder) + '" aria-describedby="h-' + esc(f.name) + '">' +
    '<button class="ib eye" type="button" aria-label="Show value">' + ICON.eye + '</button></div>' +
    '<div class="help" id="h-' + esc(f.name) + '">' + (done ? 'Already saved. Type to replace it.' : '') + '</div></div>'
}

function render() {
  const r = request
  const n = r.fields.length
  const from = r.from ? esc(r.from) : ''

  const head = remote
    ? (from ? '<div class="who"><span class="av" aria-hidden="true">' + esc(r.from.trim().charAt(0).toUpperCase()) + '</span>' +
        '<span>Request from <b>' + from + '</b></span></div>' : '') +
      '<h1 class="t">' + (from || 'Someone') + ' asks<br>for ' + plural(n, 'key') + '</h1>' +
      '<div class="vault"><span class="lk">' + ICON.lock + '</span><div>' +
      '<h2>Only ' + (from ? from + "'s" : "the requester's") + ' computer can read this</h2>' +
      '<p>Encrypted in this browser before it leaves. Not this server, not an assistant.</p>' +
      '<div class="facts"><span>no account</span><span>nothing to install</span><span>one reply per link</span></div></div></div>'
    : '<h1 class="t">' + (n === 1 ? 'An assistant needs a key' : 'An assistant<br>needs ' + plural(n, 'key')) + '</h1>' +
      '<div class="trust">' + ICON.lock + "<span>Values go straight into this machine's keychain. The assistant only sees the names.</span></div>"

  const note = r.note
    ? '<div class="note"><div class="note-h">' + ICON.terminal + (remote ? 'Note' : 'From the assistant') + '</div><p>' + esc(r.note) + '</p></div>'
    : ''

  const name = remote
    ? '<div style="padding-top:8px"><label class="lbl" for="by">Your name <span class="badge">Optional</span></label>' +
      '<input class="txt" id="by" type="text" autocomplete="name" placeholder="So ' + (from || 'they') + ' know' + (from ? 's' : '') + ' who replied">' +
      '<div class="help">Visible text, sent with the reply. Not for secrets.</div></div>'
    : ''

  const terminal = remote ? 'npx @tscodex/skey fill "' + location.href + '"' : 'npx @tscodex/skey fill ' + r.id
  const shownTerminal = remote ? 'npx @tscodex/skey fill "' + location.origin + '/r/' + r.id + '#…"' : terminal
  const left = remote
    ? (r.expiresAt ? 'Link expires ' + new Date(r.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
    : 'part of <a href="https://tscodex.com">tscodex</a>'
  const right = remote ? '<a href="/">What is skey?</a> · part of tscodex' : closesIn()

  root.innerHTML =
    '<div class="top">' + LOGO + '<span class="pill">' + (remote ? esc(location.host) : '<span class="dot"></span>Local · request ' + esc(r.id)) + '</span></div>' +
    head + note +
    '<form id="form" novalidate><div class="card fields">' + r.fields.map(field).join('') + name + '</div>' +
    '<div class="alert" id="alert" role="alert"></div>' +
    '<button class="btn btn-block submit ' + (remote ? 'btn-a btn-big' : 'btn-p') + '" type="submit" id="save">' +
    (remote ? ICON.lock + 'Encrypt and send' : 'Save') + '</button></form>' +
    '<div class="alt"><div class="alt-h"><span>Prefer the terminal?</span>' + (remote ? '' : '<span class="mono">ID ' + esc(r.id) + '</span>') + '</div>' +
    cmd(terminal, shownTerminal) + '</div>' +
    '<div class="foot"><span>' + left + '</span><span id="closes">' + right + '</span></div>'

  root.querySelector('input')?.focus()
}

function closesIn() {
  if (!request.closesAt) return ''
  const min = Math.max(0, Math.round((request.closesAt - Date.now()) / 60000))
  return 'closes in ' + min + ' min'
}

// --- отправка -----------------------------------------------------------------

function markErrors(values) {
  let missing = 0
  for (const f of request.fields) {
    const input = $('f-' + f.name)
    const help = $('h-' + f.name)
    const empty = !values[f.name] && !f.optional && !f.existing && !request.stored.includes(f.name)
    input.classList.toggle('err', empty)
    input.setAttribute('aria-invalid', empty ? 'true' : 'false')
    if (empty) { help.className = 'help e'; help.innerHTML = ICON.alert + 'Required'; missing++ }
    else if (help.classList.contains('e')) { help.className = 'help'; help.textContent = '' }
  }
  $('alert').innerHTML = missing
    ? ICON.alert + 'Fill in ' + missing + ' required key' + (missing === 1 ? '' : 's') + '. Nothing was ' + (remote ? 'sent' : 'saved') + '.'
    : ''
  if (missing) root.querySelector('.in.err').focus()
  return missing === 0
}

function busy(on) {
  const save = $('save')
  if (!save) return
  save.disabled = on
  for (const input of root.querySelectorAll('input')) input.disabled = on
  save.innerHTML = on
    ? ICON.spinner + (remote ? 'Encrypting…' : 'Saving…')
    : (remote ? ICON.lock + 'Encrypt and send' : 'Save')
}

document.addEventListener('submit', async (e) => {
  e.preventDefault()
  const values = {}
  for (const input of root.querySelectorAll('input[data-name]')) values[input.dataset.name] = input.value
  if (!markErrors(values)) return

  busy(true)
  try {
    if (remote) await sendRemote(values)
    else await sendLocal(values)
  } catch (error) {
    $('alert').innerHTML = ICON.alert + esc(error.message || 'Failed.')
  } finally {
    busy(false)
  }
})

async function sendLocal(values) {
  let res
  try {
    res = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-skey-token': token },
      body: JSON.stringify({ values }),
    })
  } catch (e) {
    return stub('mu', 'terminal', 'This request is closed', 'Ask the assistant for a new link.')
  }
  const body = await res.json()
  // При ошибке сервер ничего не сохранил — введённое остаётся в полях.
  if (!res.ok) throw new Error(body.error)
  for (const input of root.querySelectorAll('input[data-name]')) input.value = ''
  await loadLocal()
}

async function sendRemote(values) {
  for (const name of Object.keys(values)) if (!values[name]) delete values[name]
  const by = $('by').value.trim()
  const envelope = await E.sealAnswer(remote.secret, remote.id, request.pub, { values, by })
  // Шифр готов — открытые значения в форме больше не нужны.
  for (const input of root.querySelectorAll('input[data-name]')) input.value = ''
  const blob = E.toBlob(envelope)
  const to = request.from ? esc(request.from) : 'the requester'

  if (remote.offline) return showBlob(blob, "It's encrypted. Paste it into the chat where you got the link.")

  let res
  try {
    res = await fetch('/api/r/' + remote.id + '/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: await E.submitToken(remote.secret), answer: envelope }),
    })
  } catch (e) {
    return showBlob(blob, "Couldn't reach the server, but your reply is encrypted. Paste it into the chat where you got the link.")
  }

  if (res.ok) return stub('ok', 'check', 'Sent', 'Encrypted and delivered. Only ' + to + ' can read it. You can close this tab.')
  if (res.status === 409) return stub('mu', 'lock', 'Already answered', 'Someone replied first. Nothing was sent.')
  if (res.status === 404 || res.status === 410) return showBlob(blob, 'The link has expired, but your reply is encrypted. Paste it into the chat where you got the link.')
  return showBlob(blob, 'The server refused the reply, but it is encrypted. Paste it into the chat where you got the link.')
}

/** Ответ строкой — когда сервера нет или он не принял ответ. */
function showBlob(blob, text) {
  const to = request.from ? esc(request.from) : 'the requester'
  root.innerHTML = '<div class="top">' + LOGO + '<span class="pill">' + (remote.offline ? 'offline reply' : esc(location.host)) + '</span></div>' +
    '<div class="stub" style="margin-top:40px"><div class="ic ink">' + ICON.lock + '</div>' +
    '<h1 class="t">Send this reply to ' + to + '</h1><p class="d">' + text + '</p></div>' +
    '<div class="blob"><div class="blob-h"><span>Encrypted reply</span><span>' + blob.length + ' chars</span></div>' +
    '<label class="vh" for="blob">Encrypted reply</label><textarea id="blob" readonly>' + esc(blob) + '</textarea>' +
    '<button class="btn btn-a btn-block btn-big" type="button" id="copyblob">' + ICON.copy + 'Copy encrypted reply</button></div>' +
    '<div class="safe">' + ICON.check + '<span>Safe to send in any chat. Only ' + to + "'s computer can open it.</span></div>" +
    '<div class="foot"><span>part of <a href="https://tscodex.com">tscodex</a></span><span><a href="/">What is skey?</a></span></div>'
  $('copyblob').onclick = async () => {
    await navigator.clipboard.writeText(blob)
    $('copyblob').className = 'btn btn-done btn-block btn-big'
    $('copyblob').innerHTML = ICON.check + 'Copied'
  }
}

// --- мелочи -------------------------------------------------------------------

document.addEventListener('click', async (e) => {
  const copy = e.target.closest('[data-copy]')
  if (copy) {
    await navigator.clipboard.writeText(copy.dataset.copy)
    copy.innerHTML = ICON.check
    setTimeout(() => { copy.innerHTML = ICON.copy }, 1500)
    return
  }
  const eye = e.target.closest('.eye')
  if (!eye) return
  const input = eye.previousElementSibling
  const show = input.type === 'password'
  input.type = show ? 'text' : 'password'
  eye.innerHTML = show ? ICON.eyeOff : ICON.eye
  eye.setAttribute('aria-label', show ? 'Hide value' : 'Show value')
})

document.addEventListener('input', (e) => {
  const input = e.target.closest('.in.err')
  if (!input || !input.value) return
  input.classList.remove('err')
  const help = $('h-' + input.dataset.name)
  if (help) { help.className = 'help'; help.textContent = '' }
})

if (remote) loadRemote()
else if (token) {
  loadLocal()
  // Поля могут заполнить из терминала, пока страница открыта.
  setInterval(() => {
    loadLocal(true)
    if ($('closes') && request && request.closesAt) $('closes').textContent = closesIn()
  }, 3000)
}
else stub('no', 'lock', 'Open the full link', 'This page needs the whole link, including the part after #.')
</script>
</body></html>`
