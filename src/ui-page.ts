/**
 * Страница управления ключами — одним файлом, без сборки и внешних ресурсов.
 *
 * Значения нигде не показываются: их не отдаёт сервер, и запрашивать их
 * странице незачем. Поле ввода — единственное место, где значение существует,
 * и оно очищается сразу после отправки.
 */

export const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>skey</title>
<style>
:root {
  --bg: #141a1c; --surface: #1c2427; --border: #2a3438;
  --fg: #f2f4f4; --muted: #a8b0b2; --dim: #6e7778; --accent: #22d3ee;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--fg);
  font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  padding: 3rem 1.5rem;
}
main { max-width: 42rem; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 .5rem; letter-spacing: -.02em; }
.lead { color: var(--muted); margin: 0 0 2.5rem; font-size: .9rem; }
.mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }

.row {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: .9rem 1rem; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface); margin-bottom: .5rem;
}
.row .name { font-family: ui-monospace, monospace; font-size: .85rem; }
.row .when { color: var(--dim); font-size: .75rem; margin-top: .15rem; }
.row .acts { display: flex; gap: .5rem; flex-shrink: 0; }

button {
  font: inherit; font-size: .8rem; cursor: pointer; border-radius: 6px;
  border: 1px solid var(--border); background: transparent; color: var(--muted);
  padding: .4rem .8rem; transition: .15s;
}
button:hover { color: var(--fg); border-color: var(--accent); }
button.primary {
  background: var(--accent); color: #10181a; border-color: var(--accent);
  font-weight: 500; padding: .55rem 1.1rem;
}
button.primary:hover { opacity: .9; }
button.danger:hover { color: #f87171; border-color: #f87171; }

.empty {
  border: 1px dashed var(--border); border-radius: 8px;
  padding: 2rem; text-align: center; color: var(--dim); font-size: .85rem;
}

form {
  margin-top: 2.5rem; padding-top: 2rem; border-top: 1px solid var(--border);
}
label { display: block; margin-bottom: 1rem; }
label span {
  display: block; font-size: .7rem; text-transform: uppercase;
  letter-spacing: .1em; color: var(--dim); margin-bottom: .4rem;
}
input {
  width: 100%; padding: .6rem .8rem; border-radius: 6px;
  border: 1px solid var(--border); background: var(--bg); color: var(--fg);
  font-family: ui-monospace, monospace; font-size: .85rem; outline: none;
}
input:focus { border-color: var(--accent); }
.hint { color: var(--dim); font-size: .75rem; margin: .75rem 0 0; }
.err { color: #f87171; font-size: .8rem; margin: .75rem 0 0; min-height: 1.2em; }
</style></head>
<body><main>
  <h1>Your keys</h1>
  <p class="lead">
    Stored in this machine's keychain. Values are never shown here, and never
    reach an assistant's context — only these names do.
  </p>

  <div id="keys"></div>

  <form id="add">
    <label>
      <span>Name</span>
      <input id="name" placeholder="CF_API_TOKEN" spellcheck="false" autocomplete="off">
    </label>
    <label>
      <span>Value</span>
      <input id="value" type="password" placeholder="paste the token" autocomplete="off">
    </label>
    <button class="primary" type="submit">Save</button>
    <p class="err" id="err"></p>
    <p class="hint">
      Saving an existing name replaces it. Use it with:
      <span class="mono">skey run --only NAME -- your-command</span>
    </p>
  </form>
</main>

<script>
// Токен из адреса: он же ключ доступа к серверу, поэтому дальше он идёт
// заголовком, а не в URL каждого запроса.
const token = new URLSearchParams(location.search).get('t')
const api = (path, options = {}) =>
  fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'x-skey-token': token } })

const ago = (iso) => {
  const min = Math.round((Date.now() - new Date(iso)) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return min + 'm ago'
  const hours = Math.round(min / 60)
  if (hours < 24) return hours + 'h ago'
  return Math.round(hours / 24) + 'd ago'
}

async function load() {
  const { keys } = await (await api('/api/keys')).json()
  const box = document.getElementById('keys')

  if (keys.length === 0) {
    box.innerHTML = '<div class="empty">No keys yet. Add one below.</div>'
    return
  }

  box.innerHTML = keys.map((k) =>
    '<div class="row"><div><div class="name">' + k.name + '</div>' +
    '<div class="when">updated ' + ago(k.updatedAt) + '</div></div>' +
    '<div class="acts">' +
    '<button data-edit="' + k.name + '">Replace</button>' +
    '<button class="danger" data-del="' + k.name + '">Delete</button>' +
    '</div></div>'
  ).join('')
}

document.addEventListener('click', async (e) => {
  const del = e.target.dataset?.del
  if (del) {
    if (!confirm('Delete ' + del + '? This cannot be undone.')) return
    await api('/api/keys', { method: 'DELETE', body: JSON.stringify({ name: del }) })
    load()
    return
  }

  const edit = e.target.dataset?.edit
  if (edit) {
    // Замена — это та же запись под тем же именем: значения у нас нет и
    // показать в поле нечего.
    document.getElementById('name').value = edit
    document.getElementById('value').value = ''
    document.getElementById('value').focus()
  }
})

document.getElementById('add').addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = document.getElementById('name').value.trim()
  const value = document.getElementById('value').value
  const err = document.getElementById('err')
  err.textContent = ''

  const res = await api('/api/keys', { method: 'POST', body: JSON.stringify({ name, value }) })
  const body = await res.json()

  if (!res.ok) { err.textContent = body.error; return }

  // Чистим оба поля сразу: значение не должно остаться в форме, где его
  // подхватит менеджер паролей или увидит человек через плечо.
  document.getElementById('name').value = ''
  document.getElementById('value').value = ''
  load()
})

load()
</script>
</body></html>`
