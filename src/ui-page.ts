/**
 * Страница управления ключами — одним файлом, без сборки и внешних ресурсов.
 *
 * Значения нигде не показываются: их не отдаёт сервер, и запрашивать их
 * странице незачем. Поле ввода — единственное место, где значение существует,
 * и оно очищается сразу после отправки.
 *
 * Порядок на странице выбран под длинный список: форма добавления сверху,
 * под ней несколько последних ключей и «показать все». Замена — прямо в
 * строке, чтобы не уводить человека в другой конец страницы.
 */

import { THEME_CSS, ICON, LOGO, FAVICON } from './theme.js'

export const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>skey — your keys</title>
${FAVICON}
<style>${THEME_CSS}
.form{padding:16px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) auto;gap:12px;align-items:start;margin-top:28px}
.form .lbl{font-size:13px;margin-bottom:6px}
.form .btn{height:48px;margin-top:25px}
.list{display:flex;flex-direction:column;gap:4px}
.row{display:flex;align-items:center;gap:14px;padding:10px 10px 10px 18px;min-height:62px;background:var(--surface);border-radius:10px;transition:background var(--dur)}
.row .kn{font:600 14px/1.35 var(--mono);color:var(--text)}
.row .meta{font-size:12.5px;color:var(--faint);margin-top:2px}
.row.saved{background:var(--ok-soft)}
.row.saved .meta{color:var(--ok)}
.row.confirm{background:var(--danger-soft);flex-wrap:wrap}
.row.confirm .meta{color:var(--danger)}
.row.replacing{background:var(--accent-soft);flex-wrap:wrap;padding:12px 12px 12px 18px}
.row .badge{margin-top:4px}
.rform{flex-basis:100%;display:flex;gap:8px;align-items:flex-start}
.rform .fld{flex:1;min-width:0}
.rform .in{background:var(--surface)}
.rform .btn{height:48px}
.rhelp{flex-basis:100%;font-size:13px;color:var(--danger);font-weight:500;display:flex;gap:6px;align-items:center}
.rhelp:empty{display:none}
.grow{flex:1;min-width:0}
.acts{display:flex;align-items:center;gap:2px;flex-shrink:0}
.narrow{display:none}
mark{background:var(--accent-soft);color:var(--accent);border-radius:2px}
.filter{height:34px;width:220px;border:0;background:var(--surface);color:var(--text);border-radius:8px;padding:0 10px;font:13px var(--sans);text-transform:none;letter-spacing:0;outline:none}
.filter:focus{box-shadow:0 0 0 2px var(--accent)}
.filter::placeholder{color:var(--faint)}
.more{display:flex;justify-content:center;margin-top:8px}
.empty{background:var(--sunken);border-radius:14px;padding:36px 28px;display:flex;gap:28px;align-items:center}
.slots{display:flex;flex-direction:column;gap:8px;flex-shrink:0}
.slot{display:flex;align-items:center;gap:10px}
.slot i{display:block;height:9px;border-radius:2px;background:var(--line-strong)}
.chip{display:inline-block;font:600 12.5px/1 var(--mono);padding:7px 9px;border-radius:6px;background:var(--surface);margin:0 6px 6px 0}
@media (max-width:560px){
  .form{grid-template-columns:1fr}
  .form .btn{margin-top:0;width:100%}
  .sec{flex-wrap:wrap}
  #filterbox{flex-basis:100%}
  .filter{width:100%;height:44px;font-size:15px}
  .row{flex-wrap:wrap;padding:12px 6px 8px 14px;gap:2px 8px}
  .row .grow{flex-basis:100%}
  .row .rd{display:none}
  .row .acts{margin-left:auto}
  .rform{flex-wrap:wrap}
  .rform .fld{flex-basis:100%}
  .rform .btn{flex:1}
  .wide{display:none}
  .narrow{display:inline-flex}
  .empty{flex-direction:column;align-items:flex-start;padding:24px 20px}
}
</style></head>
<body>
<main class="col" id="app">
  <div class="top">${LOGO}<span class="pill"><span class="dot"></span>Local · closes with the terminal</span></div>
  <h1 class="t">Your keys</h1>
  <p class="lede">In this machine's keychain. Values are never shown — assistants only see names.</p>

  <form class="card form" id="form" novalidate aria-label="Add a key">
    <div>
      <label class="lbl" for="name">Name</label>
      <input class="in" id="name" type="text" placeholder="CF_API_TOKEN" autocomplete="off" spellcheck="false" aria-describedby="namehelp">
      <div class="help" id="namehelp" aria-live="polite"></div>
    </div>
    <div>
      <label class="lbl" for="value">Value</label>
      <div class="fld"><input class="in" id="value" type="password" placeholder="Paste the value" autocomplete="off" aria-describedby="valuehelp"><button class="ib eye" type="button" aria-label="Show value">${ICON.eye}</button></div>
      <div class="help e" id="valuehelp" aria-live="polite"></div>
    </div>
    <button class="btn btn-p" type="submit" id="save">Save</button>
  </form>

  <div class="sec"><span id="count">Loading…</span>
    <label id="filterbox" hidden><span class="vh">Filter keys</span><input class="filter" id="filter" type="search" placeholder="Filter by name" autocomplete="off" spellcheck="false"></label>
  </div>
  <div class="list" id="list" role="list"></div>
  <div class="more" id="more" hidden><button class="btn btn-s" type="button" id="toggle"></button></div>

  <div class="sec"><span>Use it</span></div>
  <div class="cmd"><code><span class="p">$ </span>skey run --only NAME -- your-command</code><button class="ib" type="button" data-copy="skey run --only NAME -- your-command" aria-label="Copy command">${ICON.copy}</button></div>

  <div class="foot"><span>part of <a href="https://tscodex.com">tscodex</a></span><span>Enter save · Esc cancel</span></div>
</main>
<div class="toastbox" id="toast" role="status" aria-live="polite"></div>

<script>
const ICON = ${JSON.stringify(ICON)}
const NAME = /^[A-Z][A-Z0-9_]{0,63}$/
// Столько последних ключей видно сразу; остальные — по «Show all» или фильтру.
const RECENT = 5

// Токен из адреса: он же ключ доступа к серверу, поэтому дальше он идёт
// заголовком, а не в URL каждого запроса.
const token = new URLSearchParams(location.search).get('t')
const api = (path, options = {}) =>
  fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'x-skey-token': token } })

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';')

let keys = []
let showAll = false
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

async function call(path, options) {
  let res
  try { res = await api(path, options) } catch (e) { sessionEnded(); return null }
  if (res.status === 403) { sessionEnded(); return null }
  return res
}

async function load() {
  const res = await call('/api/keys')
  if (!res) return
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
      '<div class="grow"><div class="kn">' + n + '</div><span class="badge ac">Replacing · the old value is overwritten</span></div>' +
      '<form class="rform" id="rform" novalidate>' +
      '<div class="fld"><label class="vh" for="rvalue">New value for ' + n + '</label>' +
      '<input class="in" id="rvalue" type="password" placeholder="Paste the new value" autocomplete="off">' +
      '<button class="ib eye" type="button" aria-label="Show value">' + ICON.eye + '</button></div>' +
      '<button class="btn btn-g" type="button" data-act="unreplace">Cancel</button>' +
      '<button class="btn btn-p" type="submit">Replace</button></form>' +
      '<div class="rhelp" id="rhelp" aria-live="polite"></div></div>'
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

/**
 * Что показать: при фильтре — все совпадения; развёрнуто — все по алфавиту;
 * свёрнуто — последние изменённые, чтобы свежие ключи были под рукой.
 */
function visible(q) {
  if (q) return keys.filter((k) => k.name.includes(q))
  if (showAll || keys.length <= RECENT) return keys
  const recent = [...keys].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT)
  // Строку, которую сейчас меняют или удаляют, из вида не убираем.
  for (const name of [replacing, confirming]) {
    const k = name && keys.find((x) => x.name === name)
    if (k && !recent.includes(k)) recent.push(k)
  }
  return recent
}

function renderList() {
  const long = keys.length > RECENT
  const q = $('filter').value.trim().toUpperCase()
  $('filterbox').hidden = !long
  const shown = visible(long ? q : '')
  const total = keys.length + (keys.length === 1 ? ' key' : ' keys')

  $('count').textContent = q && long ? total + ' · ' + shown.length + ' shown'
    : long && !showAll ? 'Recent · ' + total : total

  $('more').hidden = !long || Boolean(q)
  $('toggle').textContent = showAll ? 'Show fewer' : 'Show all ' + keys.length + ' keys'

  if (keys.length === 0) {
    $('list').innerHTML =
      '<div class="empty"><div class="slots" aria-hidden="true">' +
      '<div class="slot"><i style="width:120px"></i><i style="width:36px;background:var(--text)"></i></div>' +
      '<div class="slot"><i style="width:90px"></i><i style="width:36px;background:var(--text)"></i></div>' +
      '<div class="slot"><i style="width:140px"></i><i style="width:36px;background:var(--accent)"></i></div></div>' +
      '<div><p style="margin:0;font-weight:600;font-size:16px">Nothing stored yet</p>' +
      '<p style="margin:4px 0 12px;color:var(--muted)">Add one above. Use names like</p>' +
      '<span class="chip">CF_API_TOKEN</span><span class="chip">HEROKU_API_KEY</span></div></div>'
    return
  }
  $('list').innerHTML = shown.map((k) => row(k, q)).join('') ||
    '<div class="row"><div class="grow meta">No key matches “' + esc(q) + '”.</div></div>'
  if (confirming) $('keep')?.focus()
  if (replacing) $('rvalue')?.focus()
}

// --- добавить ключ (форма сверху) ------------------------------------------------

function checkName(final) {
  const name = $('name').value
  const help = $('namehelp')
  const exists = keys.some((k) => k.name === name)
  const bad = name && !NAME.test(name)
  const show = bad && (final || name.length > 1)

  $('name').classList.toggle('err', Boolean(show))
  $('name').setAttribute('aria-invalid', bad ? 'true' : 'false')
  $('save').textContent = exists ? 'Replace' : 'Save'

  if (show) {
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

$('value').addEventListener('input', () => {
  $('value').classList.remove('err')
  $('valuehelp').textContent = ''
})

/** Сохранить значение. Одна дорога и для формы сверху, и для замены в строке. */
async function store(name, value) {
  const res = await call('/api/keys', { method: 'POST', body: JSON.stringify({ name, value }) })
  if (!res) return false
  const body = await res.json()
  if (!res.ok) throw new Error(body.error)

  justSaved = name
  setTimeout(() => { justSaved = null; renderList() }, 2000)
  toast('check', 'Stored', name)
  await load()
  return true
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = $('name').value
  const value = $('value').value
  if (!name) { checkName(true); return $('name').focus() }
  if (!checkName(true)) return $('name').focus()
  if (!value) {
    $('value').classList.add('err')
    $('valuehelp').innerHTML = ICON.alert + '<span>Paste a value</span>'
    return $('value').focus()
  }

  $('save').disabled = true
  try {
    // Значение не должно задерживаться в форме: его подхватит менеджер паролей
    // или увидит человек через плечо.
    if (await store(name, value)) {
      $('name').value = ''
      $('value').value = ''
      $('value').type = 'password'
      checkName()
    }
  } catch (error) {
    $('valuehelp').innerHTML = ICON.alert + '<span>' + esc(error.message) + '</span>'
  } finally {
    $('save').disabled = false
  }
})

// --- замена в строке --------------------------------------------------------------

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'rform') return
  e.preventDefault()
  const value = $('rvalue').value
  if (!value) {
    $('rvalue').classList.add('err')
    $('rhelp').innerHTML = ICON.alert + 'Paste a value'
    return $('rvalue').focus()
  }
  const name = replacing
  try {
    replacing = null
    await store(name, value)
  } catch (error) {
    replacing = name
    renderList()
    $('rhelp').innerHTML = ICON.alert + esc(error.message)
  }
})

// --- действия в строках, копирование, показать значение ---------------------------

$('filter').addEventListener('input', renderList)
$('toggle').addEventListener('click', () => { showAll = !showAll; renderList() })

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
  if (act === 'replace') { replacing = name; confirming = null; return renderList() }
  if (act === 'unreplace') { replacing = null; return renderList() }
  if (act === 'delete') { confirming = name; replacing = null; return renderList() }
  if (act === 'keep') { confirming = null; return renderList() }
  if (act === 'drop') {
    const res = await call('/api/keys', { method: 'DELETE', body: JSON.stringify({ name }) })
    if (!res) return
    confirming = null
    toast('trash', 'Deleted', name)
    load()
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (confirming) { confirming = null; renderList() }
  else if (replacing) { replacing = null; renderList() }
})

load()
</script>
</body></html>`
