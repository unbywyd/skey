// Мини-клиент VexelKit для ролика. Ключ берётся из окружения (VEXELKIT) —
// его туда кладёт `skey run --only VEXELKIT`, значение в вывод не попадает.
//   node vk.mjs me | packs <query> | pack <id> | quote <type> <count> <refs>
const BASE = 'https://vexelkit.com/api/v1'
const auth = { Authorization: `Bearer ${process.env.VEXELKIT}` }
const get = async (path) => {
  const res = await fetch(BASE + path, { headers: auth })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}
const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'me') {
  const me = await get('/me')
  console.log(JSON.stringify({ name: me.name, balance: me.balance, own_keys: me.own_keys }))
} else if (cmd === 'packs') {
  const b = await get(`/packs?${new URLSearchParams({ limit: '50' })}`)
  const items = (b.items || b.packs || b.data || [])
  const q = (args[0] || '').toLowerCase()
  for (const p of items) {
    const text = JSON.stringify([p.title, p.name, p.prompt]).toLowerCase()
    if (!q || text.includes(q)) console.log(p.id, '|', p.type, '|', p.status, '|', (p.title || p.name || p.prompt || '').slice(0, 90), '|', (p.images || []).length, 'images')
  }
} else if (cmd === 'pack') {
  const p = await get(`/packs/${args[0]}`)
  console.log(JSON.stringify({ id: p.id, title: p.title, type: p.type, mode: p.mode, prompt: (p.prompt || '').slice(0, 400), images: (p.images || []).map((i) => ({ id: i.id, status: i.status, name: i.name || i.subject })) }, null, 1))
} else if (cmd === 'quote') {
  const [type, count, refs] = args
  console.log(JSON.stringify(await get(`/quote?${new URLSearchParams({ type, count, mode: 'fast', background: 'transparent', refs })}`)))
}

// generate <outDir> <count> <ref1,ref2,ref3> <prompt> — набор в стиле референсов,
// ждём готовности и скачиваем PNG. Печатает то, что агент покажет в терминале.
if (cmd === 'generate') {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const [outDir, count, refs, prompt] = args
  const body = { prompt, count: Number(count), type: 'illustrations', mode: 'fast', background: 'transparent', reference_image_ids: refs.split(',') }
  const res = await fetch(BASE + '/generations', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const job = await res.json()
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(job).slice(0, 300)}`)
  console.log(`VexelKit: generating ${count} illustrations · job ${String(job.id).slice(0, 8)}`)
  let gen
  for (let i = 0; i < 120; i++) {
    gen = await get(`/generations/${job.id}`)
    if (gen.status === 'ready' || gen.status === 'done' || gen.status === 'failed') break
    await new Promise((r) => setTimeout(r, 5000))
  }
  console.log(`VexelKit: ${gen.status}`)
  const pack = await get(`/packs/${gen.pack_id || job.id}`)
  mkdirSync(outDir, { recursive: true })
  let n = 0
  for (const im of pack.images || []) {
    if (im.status !== 'ready') continue
    const png = await fetch(`${BASE}/images/${im.id}/download?format=png`, { headers: auth })
    writeFileSync(`${outDir}/cafe-${++n}.png`, Buffer.from(await png.arrayBuffer()))
  }
  console.log(`Saved ${n} images to ${outDir}`)
  console.log(`pack ${pack.id}`)
}
