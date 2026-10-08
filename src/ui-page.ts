/**
 * Страница управления ключами — одним файлом, без сборки и внешних ресурсов.
 *
 * Значения нигде не показываются: их не отдаёт сервер, и запрашивать их
 * странице незачем. Поле ввода — единственное место, где значение существует,
 * и оно очищается сразу после отправки.
 */

import { THEME_CSS, ICON, LOGO, FAVICON } from './theme.js'

export const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>skey — your keys</title>
${FAVICON}
<style>${THEME_CSS}
.list{display:flex;flex-direction:column;gap:4px}
.row{display:flex;align-items:center;gap:14px;padding:10px 10px 10px 18px;min-height:62px;background:var(--surface);border-radius:10px;transition:background var(--dur)}
.row .kn{font:600 14px/1.35 var(--mono);color:var(--text)}
.row .meta{font-size:12.5px;color:var(--faint);margin-top:2px}
.row.saved{background:var(--ok-soft)}
.row.saved .meta{color:var(--ok)}
.row.confirm{background:var(--danger-soft);flex-wrap:wrap}
.row.confirm .meta{color:var(--danger)}
.row.replacing{background:var(--accent-soft)}
.row.replacing .rd{background:var(--accent)}
.row .badge{margin-top:4px}
.grow{flex:1;min-width:0}
.acts{display:flex;align-items:center;gap:2px;flex-shrink:0}
.narrow{display:none}
mark{background:var(--accent-soft);color:var(--accent);border-radius:2px}
.filter{height:34px;width:220px;border:0;background:var(--surface);color:var(--text);border-radius:8px;padding:0 10px;font:13px var(--sans);text-transform:none;letter-spacing:0;outline:none}
.filter:focus{box-shadow:0 0 0 2px var(--accent)}
.filter::placeholder{color:var(--faint)}
.form{padding:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.formfoot{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.formnote{font-size:13px;color:var(--muted)}
.formbtns{display:flex;gap:8px;margin-left:auto}
.empty{background:var(--sunken);border-radius:14px;padding:36px 28px;display:flex;gap:28px;align-items:center}
.slots{display:flex;flex-direction:column;gap:8px;flex-shrink:0}
.slot{display:flex;align-items:center;gap:10px}
.slot i{display:block;height:9px;border-radius:2px;background:var(--line-strong)}
.chip{display:inline-block;font:600 12.5px/1 var(--mono);padding:7px 9px;border-radius:6px;background:var(--surface);margin:0 6px 6px 0}
@media (max-width:560px){
  .sec{flex-wrap:wrap}
  #filterbox{flex-basis:100%}
  .filter{width:100%;height:44px;font-size:15px}
  .row{flex-wrap:wrap;padding:12px 6px 8px 14px;gap:2px 8px}
  .row .grow{flex-basis:100%}
  .row .rd{display:none}
  .row .acts{margin-left:auto}
  .wide{display:none}
  .narrow{display:inline-flex}
  .form{grid-template-columns:1fr;padding:16px}
  .formbtns{width:100%}
  .formbtns .btn{flex:1;height:48px}
  .empty{flex-direction:column;align-items:flex-start;padding:24px 20px}
}
</style></head>
<body>
<main class="col" id="app">
  <div class="top">${LOGO}<span class="pill"><span class="dot"></span>Local · closes with the terminal</span></div>
  <h1 class="t">Your keys</h1>
  <p class="lede">In this machine's keychain. Values are never shown — assistants only see names.</p>

  <div class="sec"><span id="count">Loading…</span>
    <label id="filterbox" hidden><span class="vh">Filter keys</span><input class="filter" id="filter" type="search" placeholder="Filter by name" autocomplete="off" spellcheck="false"></label>
  </div>
  <div class="list" id="list" role="list"></div>

  <div class="sec"><span id="formtitle">Add a key</span></div>
  <form class="card form" id="form" novalidate>
    <div>
      <label class="lbl" for="name">Name</label>
      <div class="fld"><input class="in" id="name" type="text" placeholder="CF_API_TOKEN" autocomplete="off" spellcheck="false" aria-describedby="namehelp"><span class="lockmark" id="namelock" hidden>${ICON.lock}</span></div>
      <div class="help" id="namehelp" aria-live="polite"></div>
    </div>
    <div>
      <label class="lbl" for="value" id="valuelabel">Value</label>
      <div class="fld"><input class="in" id="value" type="password" placeholder="Paste the value" autocomplete="off" aria-describedby="valuehelp"><button class="ib eye" type="button" aria-label="Show value">${ICON.eye}</button></div>
      <div class="help e" id="valuehelp" aria-live="polite"></div>
    </div>
    <div class="formfoot">
      <span class="formnote" id="formnote"></span>
      <div class="formbtns"><button class="btn btn-g" type="button" id="cancel" hidden>Cancel</button><button class="btn btn-p" type="submit" id="save">Save</button></div>
    </div>
  </form>

  <div class="sec"><span>Use it</span></div>
  <div class="cmd"><code><span class="p">$ </span>skey run --only NAME -- your-command</code><button class="ib" type="button" data-copy="skey run --only NAME -- your-command" aria-label="Copy command">${ICON.copy}</button></div>

  <div class="foot"><span>part of <a href="https://tscodex.com">tscodex</a></span><span>Enter save · Esc cancel</span></div>
</main>
<div class="toastbox" id="toast" role="status" aria-live="polite"></div>

<script>
const ICON = ${JSON.stringify(ICON)}
const NAME = /^[A-Z][A-Z0-9_]{0,63}$/
const FILTER_FROM = 8

// Токен из адреса: он же ключ доступа к серверу, поэтому дальше он идёт
// заголовком, а не в URL каждого запроса.
const token = new URLSearchParams(location.search).get('t')
const api = (path, options = {}) =>
  fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'x-skey-token': token } })

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';')

let keys = []
let confirming = null
let replacing = null
let justSaved = null

function ago(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return min + 'm ago'
  const hours = Math.round(min / 60)
  if (hours < 24) return hours + 'h ago'
  const days = Math.round(hours / 24)
  if (days < 45) return days + 'd ago'
  return Math.round(days / 30) + 'mo ago'
}

function toast(icon, text, name) {
  $('toast').innerHTML = '<div class="toast">' + ICON[icon] + text + (name ? ' <b>' + esc(name) + '</b>' : '') + '</div>'
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => { $('toast').innerHTML = '' }, 3000)
}

/** Терминал закрыли — сервера больше нет, работать странице не с кем. */
function sessionEnded() {
  $('app').innerHTML =
    '<div class="top">' + ${JSON.stringify(LOGO)} + '</div>' +
    '<div class="stub"><div class="ic mu">' + ICON.terminal + '</div>' +
    '<h1 class="t">This session ended</h1><p class="d">The terminal was closed. Run it again:</p>' +
    '<div class="cmd"><code><span class="p">$ </span>skey ui</code><button class="ib" type="button" data-copy="skey ui" aria-label="Copy command">' + ICON.copy + '</button></div></div>'
}

async function load() {
  let res
  try { res = await api('/api/keys') } catch (e) { return sessionEnded() }
  if (!res.ok) return sessionEnded()
  keys = (await res.json()).keys
  renderList()
  checkName()
}

function highlight(name, q) {
  const i = q ? name.indexOf(q) : -1
  if (i < 0) return esc(name)
  return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length))
}

function row(k, q) {
  const n = esc(k.name)
  if (k.name === confirming) {
    return '<div class="row confirm" role="listitem" data-name="' + n + '">' +
      '<div class="grow" style="min-width:220px"><div class="kn">Delete ' + n + '?</div><div class="meta">This cannot be undone.</div></div>' +
      '<div class="acts" style="gap:8px"><button class="btn btn-s btn-sm" type="button" data-act="keep" id="keep">Cancel</button>' +
      '<button class="btn btn-d btn-sm" type="button" data-act="drop">' + ICON.trash + 'Delete</button></div></div>'
  }
  if (k.name === replacing) {
    return '<div class="row replacing" role="listitem" data-name="' + n + '">' +
      '<div class="grow"><div class="kn">' + n + '</div><span class="badge ac">Replacing</span></div>' +
      '<span class="rd" aria-hidden="true"></span>' +
      '<div class="acts"><button class="btn btn-g btn-sm" type="button" data-act="unreplace">Cancel</button></div></div>'
  }
  const saved = k.name === justSaved
  return '<div class="row' + (saved ? ' saved' : '') + '" role="listitem" data-name="' + n + '">' +
    '<div class="grow"><div class="kn">' + highlight(k.name, q) + '</div>' +
    '<div class="meta" title="' + esc(new Date(k.updatedAt).toLocaleString()) + '">' + ago(k.updatedAt) + '</div></div>' +
    '<span class="rd" aria-hidden="true"></span>' +
    '<div class="acts">' +
    '<button class="ib" type="button" data-act="copy" aria-label="Copy run command for ' + n + '">' + ICON.copy + '</button>' +
    '<button class="btn btn-g btn-sm" type="button" data-act="replace">Replace</button>' +
    '<button class="btn btn-dg btn-sm wide" type="button" data-act="delete">Delete</button>' +
    '<button class="ib d narrow" type="button" data-act="delete" aria-label="Delete ' + n + '">' + ICON.trash + '</button>' +
    '</div></div>'
}

function renderList() {
  const q = $('filter').value.trim().toUpperCase()
  $('filterbox').hidden = keys.length < FILTER_FROM
  const shown = keys.length >= FILTER_FROM && q ? keys.filter((k) => k.name.includes(q)) : keys

  $('count').textContent = keys.length + (keys.length === 1 ? ' key' : ' keys') + (shown.length !== keys.length ? ' · ' + shown.length + ' shown' : '')

  if (keys.length === 0) {
    $('list').innerHTML =
      '<div class="empty"><div class="slots" aria-hidden="true">' +
      '<div class="slot"><i style="width:120px"></i><i style="width:36px;background:var(--text)"></i></div>' +
      '<div class="slot"><i style="width:90px"></i><i style="width:36px;background:var(--text)"></i></div>' +
      '<div class="slot"><i style="width:140px"></i><i style="width:36px;background:var(--accent)"></i></div></div>' +
      '<div><p style="margin:0;font-weight:600;font-size:16px">Nothing stored yet</p>' +
      '<p style="margin:4px 0 12px;color:var(--muted)">Add a key below. Use names like</p>' +
      '<span class="chip">CF_API_TOKEN</span><span class="chip">HEROKU_API_KEY</span></div></div>'
    return
  }
  $('list').innerHTML = shown.map((k) => row(k, q)).join('') ||
    '<div class="row"><div class="grow meta">No key matches “' + esc(q) + '”.</div></div>'
  if (confirming) $('keep')?.focus()
}

// --- форма: добавить или заменить -----------------------------------------------

function setReplace(name) {
  replacing = name
  confirming = null
  $('formtitle').textContent = name ? 'Replace ' + name : 'Add a key'
  $('name').value = name || ''
  $('name').readOnly = Boolean(name)
  $('namelock').hidden = !name
  $('valuelabel').textContent = name ? 'New value' : 'Value'
  $('value').placeholder = name ? 'Paste the new value' : 'Paste the value'
  $('value').value = ''
  $('valuehelp').textContent = ''
  $('value').classList.remove('err')
  $('formnote').textContent = name ? 'The old value is overwritten.' : ''
  $('cancel').hidden = !name
  renderList()
  checkName()
  if (name) $('value').focus()
}

function checkName(final) {
  const name = $('name').value
  const help = $('namehelp')
  const exists = keys.some((k) => k.name === name)
  const bad = name && !NAME.test(name)

  $('name').classList.toggle('err', Boolean(bad && (final || name.length > 1)))
  $('name').setAttribute('aria-invalid', bad ? 'true' : 'false')
  $('save').textContent = exists ? 'Replace' : 'Save'

  if (replacing) { help.className = 'help'; help.innerHTML = ''; return true }
  if (bad && (final || name.length > 1)) {
    help.className = 'help e'
    help.innerHTML = ICON.alert + '<span>Use A–Z, 0–9 and underscore, starting with a letter</span>'
  } else if (exists) {
    help.className = 'help w'
    help.innerHTML = ICON.alert + '<span>Exists — saving replaces it</span>'
  } else {
    help.className = 'help'
    help.textContent = 'A–Z, 0–9, _ · spaces become _'
  }
  return !bad
}

$('name').addEventListener('input', () => {
  const input = $('name')
  const at = input.selectionStart
  input.value = input.value.toUpperCase().split(' ').join('_').split('-').join('_')
  input.setSelectionRange(at, at)
  checkName()
})

$('form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = $('name').value
  const value = $('value').value
  if (!name) { $('name').focus(); return checkName(true) }
  if (!checkName(true)) return $('name').focus()
  if (!value) {
    $('value').classList.add('err')
    $('valuehelp').innerHTML = ICON.alert + '<span>Paste a value</span>'
    return $('value').focus()
  }

  $('save').disabled = true
  let res
  try {
    res = await api('/api/keys', { method: 'POST', body: JSON.stringify({ name, value }) })
  } catch (error) {
    return sessionEnded()
  } finally {
    $('save').disabled = false
  }
  if (res.status === 403) return sessionEnded()
  const body = await res.json()
  if (!res.ok) {
    $('valuehelp').innerHTML = ICON.alert + '<span>' + esc(body.error) + '</span>'
    return
  }

  // Значение не должно задерживаться в форме: его подхватит менеджер паролей
  // или увидит человек через плечо.
  $('value').value = ''
  $('value').type = 'password'
  justSaved = name
  setTimeout(() => { justSaved = null; renderList() }, 2000)
  setReplace(null)
  $('name').value = ''
  toast('check', 'Stored', name)
  load()
})

$('value').addEventListener('input', () => {
  $('value').classList.remove('err')
  $('valuehelp').textContent = ''
})

$('cancel').addEventListener('click', () => setReplace(null))
$('filter').addEventListener('input', renderList)

// --- действия в строках, копирование, показать значение --------------------------

document.addEventListener('click', async (e) => {
  const copy = e.target.closest('[data-copy]')
  if (copy) {
    await navigator.clipboard.writeText(copy.dataset.copy)
    return toast('check', 'Copied')
  }

  const eye = e.target.closest('.eye')
  if (eye) {
    const input = eye.previousElementSibling
    const show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    eye.innerHTML = show ? ICON.eyeOff : ICON.eye
    eye.setAttribute('aria-label', show ? 'Hide value' : 'Show value')
    return
  }

  const button = e.target.closest('[data-act]')
  if (!button) return
  const name = button.closest('.row').dataset.name
  const act = button.dataset.act

  if (act === 'copy') {
    await navigator.clipboard.writeText('skey run --only ' + name + ' -- your-command')
    return toast('check', 'Copied run command for', name)
  }
  if (act === 'replace') return setReplace(name)
  if (act === 'unreplace') return setReplace(null)
  if (act === 'delete') { confirming = name; replacing = null; return renderList() }
  if (act === 'keep') { confirming = null; return renderList() }
  if (act === 'drop') {
    let res
    try {
      res = await api('/api/keys', { method: 'DELETE', body: JSON.stringify({ name }) })
    } catch (error) {
      return sessionEnded()
    }
    if (res.status === 403) return sessionEnded()
    confirming = null
    toast('trash', 'Deleted', name)
    load()
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (confirming) { confirming = null; renderList() }
  else if (replacing) setReplace(null)
})

load()
</script>
</body></html>`
