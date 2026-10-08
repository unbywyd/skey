// Сцены ролика. Весь вывод skey — настоящий, из out/capture/ (его пишет
// capture.sh). Реплики агента и человека — сценарий. Вывод skey fill повторяет
// строки из src/cli.ts дословно: сам fill требует живую клавиатуру.
import { readFileSync } from 'node:fs'

const read = (f) => readFileSync(new URL(`./out/capture/${f}`, import.meta.url), 'utf8').replace(/\r/g, '')
const lines = (text) => text.split('\n')
const grab = (text, re) => (text.match(re) || [])[1] || ''

const c1 = read('c1.out'), c2 = read('c2.out'), c3 = read('c3.out')
const id1 = grab(c1, /^Request (\w+):/m), id2 = grab(c2, /^Request (\w+):/m), id3 = grab(c3, /^Request (\w+):/m)
const url1 = grab(c1, /Browser:\s+(\S+)/), share = grab(c3, /Share:\s+(\S+)/)
const short = (u) => u.replace(/^https?:\/\//, '').replace(/(t=|#)(.{6}).*$/, '$1$2…')
/** Ссылка в терминале и в чате: токен и секрет обрезаны — в кадре они только мешают читать. */
const clip = (u) => u.replace(/(t=|#)(.{6}).*$/, '$1$2…')

/** Вывод skey как строки терминала, без пустых хвостов. */
function output(text, { until } = {}) {
  const out = []
  for (const raw of lines(text)) {
    if (until && raw.startsWith(until)) break
    const s = raw.replace(/(https?:\/\/\S+)/g, (u) => `[[${clip(u)}]]`)
    out.push({ t: raw.startsWith('Done') ? 'ok' : 'out', s })
  }
  while (out.length && !out.at(-1).s.trim()) out.pop()
  return out
}

const say = (s) => ({ t: 'agent', s })
const you = (s) => ({ t: 'user', s })
const cmd = (s) => ({ t: 'cmd', s })
const blank = { t: 'out', s: '' }
const done = (text) => lines(text).filter((l) => l.startsWith('Done')).map((s) => ({ t: 'ok', s }))

// --- 0: ключ уже есть — агент пользуется им по имени -----------------------------
const ask0 = [
  you('Make illustrations for the Morning Bloom café — same style as our Grain pack.'),
  say('On it. Using VEXELKIT from your keychain — I won’t see the key:'),
  cmd('skey run --only VEXELKIT -- node scripts/vexelkit.mjs "9 café illustrations, Grain style"'),
]
const made0 = [
  { t: 'out', s: 'VexelKit: generating 9 illustrations · job 0eadbbb2' },
  { t: 'out', s: 'VexelKit: ready' },
  { t: 'ok', s: 'Saved 9 images to assets/cafe' },
  { t: 'out', s: '' },
  say('Here you go — nine illustrations in assets/cafe.'),
]

// --- 1 ---------------------------------------------------------------------------
const ask1 = [
  you('Set up Stripe payments for the shop.'),
  say('I need two Stripe keys. Please don’t paste them here —'),
  say('fill in this form instead. They go straight to your keychain.'),
  cmd('skey request "STRIPE_SECRET_KEY:Stripe secret key" "STRIPE_WEBHOOK_SECRET:…" --note "…"'),
  ...output(c1, { until: 'Done' }),
]
const after1 = [
  ...done(c1),
  blank,
  say('Got them. Moving them into .env without reading the values:'),
  cmd('skey dotenv .env --only STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET'),
  ...output(read('c1.dotenv.out')),
  cmd('skey run --only STRIPE_SECRET_KEY -- npm run stripe:check'),
  ...output(read('c1.run.out')).filter((l) => l.s.trim()),
  blank,
  say('Payments are set up. I only ever saw the names.'),
]
const term1 = (extra = []) => ({ title: 'Claude Code — ~/shop', lines: [...ask1, ...extra] })
const page1 = (img) => ({ url: short(url1), img: `out/capture/${img}` })

// --- 2 ---------------------------------------------------------------------------
const ask2 = [
  you('Add welcome emails through Resend.'),
  say('I need a Resend API key. Fill it in the browser — or in your terminal:'),
  cmd('skey request "RESEND_API_KEY:Resend API key" "RESEND_AUDIENCE_ID?:Audience ID" --note "…"'),
  ...output(c2, { until: 'Done' }),
]
const fillStart = [
  cmd(`skey fill ${id2}`),
  blank,
  { t: 'prompt', s: 'An assistant asks for 2 keys.' },
  blank,
  { t: 'prompt', s: '  For the welcome emails.' },
  { t: 'prompt', s: '  Resend → API Keys → Create API key.' },
  blank,
  { t: 'out', s: 'Values go straight to the keychain. Input is hidden.' },
  blank,
]
const fillDone = [
  { t: 'prompt', s: 'Resend API key (RESEND_API_KEY): ' },
  { t: 'ok', s: '  ✓ stored' },
  { t: 'prompt', s: 'Audience ID (RESEND_AUDIENCE_ID) [Enter skips]: ' },
  { t: 'out', s: '  – left as is' },
  blank,
  { t: 'out', s: 'Done. The assistant picks it up by itself — it sees only the names.' },
]

// --- 3 ---------------------------------------------------------------------------
const ask3 = [
  you('Run the migration on production.'),
  say('The production database URL is with Nina.'),
  say('I’ll make a link that only this machine can read:'),
  cmd('skey request "SUPABASE_DB_URL:Production database URL" --share --from Alex --note "…"'),
  ...output(c3, { until: 'Done' }),
]
const after3 = [
  ...done(c3),
  blank,
  say('Got it. Running the migration with SUPABASE_DB_URL — by name.'),
]
const term3 = (extra = []) => ({ title: 'Claude Code — ~/shop', lines: [...ask3, ...extra] })
const nina = (img) => ({ url: short(share), secure: true, who: 'Nina’s laptop', img: `out/capture/${img}` })

// --- 4 ---------------------------------------------------------------------------
const c4 = read('c4.out')
const keysTerm = { title: 'Terminal — you', lines: [cmd('skey ui'), ...output(c4).filter((l) => l.s.trim())] }
const keysPage = (img) => ({ url: short(grab(c4, /(http:\/\/\S+)/)), img: `out/capture/${img}` })

export const scenes = [
  {
    id: 'title', layout: 'title', eyebrow: 'skey · API keys for AI agents',
    title: 'Your AI agent<br>uses the key.<br><span class="q">Never sees it.</span>',
    text: 'How Claude Code works with your API keys — and never sees them.',
    note: 'Opening title, ~3 s.',
  },
  {
    id: 'c0-ask', chapter: [1, 5], chapterLabel: 'Keys you already have',
    caption: 'Your keys are already in skey. Just ask — the agent uses them by name.',
    term: { title: 'Claude Code — ~/morning-bloom', lines: [...ask0, { t: 'out', s: '', cursor: true }] },
    note: 'VEXELKIT is in skey already; the agent never sees its value.',
  },
  {
    id: 'c0-done', chapter: [1, 5], chapterLabel: 'Here you go',
    caption: 'Here you go: nine café illustrations. The key never reached the chat.',
    term: { title: 'Claude Code — ~/morning-bloom', lines: [...ask0, ...made0] },
    browser: { url: 'assets/cafe — 9 files', img: 'out/capture/c0-gallery.png' },
    note: 'Real VexelKit generation in the style of the Grain pack.',
  },
  {
    id: 'c1-ask', chapter: [2, 5], chapterLabel: 'The agent asks',
    caption: 'The agent needs a key — and sends a link instead of asking for a paste.',
    term: term1([{ t: 'out', s: '', cursor: true }]), browser: page1('c1-open.png'),
    note: 'Terminal types the request; the form opens in the browser by itself.',
  },
  {
    id: 'c1-fill', chapter: [2, 5], chapterLabel: 'You fill',
    caption: 'You fill a form. Values go straight into your OS keychain.',
    term: term1([{ t: 'out', s: '', cursor: true }]), browser: page1('c1-filled.png'),
    note: 'Typing into the real page; dots grow as you type.',
  },
  {
    id: 'c1-done', chapter: [2, 5], chapterLabel: 'It continues',
    caption: 'The agent carries on by itself. It only ever sees the names.',
    term: term1(after1), browser: page1('c1-done.png'),
    note: 'Request exits on its own; .env written; output masked.',
  },
  {
    id: 'c2-fill', chapter: [3, 5], chapterLabel: 'Prefer the terminal?',
    caption: 'Same request — answered field by field in your terminal.',
    term: { title: 'Claude Code — ~/shop', lines: [...ask2, { t: 'out', s: '', cursor: true }] },
    term2: { title: 'Terminal — you', lines: [...fillStart, { t: 'prompt', s: 'Resend API key (RESEND_API_KEY): ', cursor: true }] },
    note: 'Hidden input: nothing appears as you type.',
  },
  {
    id: 'c2-done', chapter: [3, 5], chapterLabel: 'Input stays hidden',
    caption: 'Input stays hidden. The agent picks it up the moment you finish.',
    term: { title: 'Claude Code — ~/shop', lines: [...ask2, ...done(c2), blank, say('Got it. Wiring up welcome emails with RESEND_API_KEY.')] },
    term2: { title: 'Terminal — you', lines: [...fillStart, ...fillDone] },
    note: 'Optional field skipped with Enter.',
  },
  {
    id: 'c3-ask', chapter: [4, 5], chapterLabel: 'The key is with a friend',
    caption: 'The key is on someone else’s computer? Share a link.',
    term: term3([{ t: 'out', s: '', cursor: true }]),
    chat: {
      title: 'Messages — Nina',
      messages: [
        { from: 'me', text: 'Hey! Can you drop the prod database URL here?', link: clip(share), meta: 'Only my machine can read the reply · Delivered' },
      ],
    },
    note: 'The link goes through any chat — it can answer, not read.',
  },
  {
    id: 'c3-open', chapter: [4, 5], chapterLabel: 'On Nina’s laptop',
    caption: 'Nina opens it — no account, nothing to install.',
    term: term3([{ t: 'out', s: '', cursor: true }]), browser: nina('c3-open.png'),
    note: 'Real skey.tscodex.com page, dark mode on her machine.',
  },
  {
    id: 'c3-fill', chapter: [4, 5], chapterLabel: 'Encrypted in her browser',
    caption: 'It’s encrypted in her browser. Only your machine can read it.',
    term: term3([{ t: 'out', s: '', cursor: true }]), browser: nina('c3-filled.png'),
    note: 'Typing the value and her name.',
  },
  {
    id: 'c3-done', chapter: [4, 5], chapterLabel: 'The reply arrives',
    caption: 'The reply comes back by itself. The server never saw it.',
    term: term3(after3), browser: nina('c3-done.png'),
    note: '“answered by Nina”; the relay deletes the ciphertext.',
  },
  {
    id: 'keys', chapter: [5, 5], chapterLabel: 'Your keys',
    caption: 'Everything lands in one place — names and dates, never values.',
    term: keysTerm, browser: keysPage('c4-keys.png'),
    note: 'skey ui: the three new keys on top as “just now”, older ones below.',
  },
  {
    id: 'keys-replace', chapter: [5, 5], chapterLabel: 'Rotate in place',
    caption: 'Rotate a key right in the list. The old value is overwritten, never shown.',
    term: keysTerm, browser: keysPage('c4-replace.png'),
    note: 'Inline replace; the value is typed as dots.',
  },
  {
    id: 'outro', layout: 'outro', eyebrow: 'Open source · MIT · macOS, Windows, Linux',
    title: 'Keys stay in your keychain.<br><span class="q">Agents get names.</span>',
    cmd: 'npx @tscodex/skey ui', site: 'skey.tscodex.com', credit: 'Illustrations in this video: VexelKit · vexelkit.com',
    note: 'End card, ~4 s.',
  },
]

export const ids = { id1, id2, id3 }
