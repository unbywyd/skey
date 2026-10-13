/**
 * "Our products": the sibling products, added to the landing when it is served. landing.ts is generated from the design
 * (build-landing.mjs), so a section written into it would be lost on the next rebuild. The same section, in each site's
 * own design, is on ungic.com, chatick.com and vexelkit.com. Inline SVG marks: the landing's CSP allows `img-src data:`
 * only.
 */

const CSS = `
.prods{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px;margin-top:32px}
.prod{background:#fff;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px;color:var(--ink);text-decoration:none;box-shadow:inset 0 0 0 1px transparent;transition:box-shadow .15s}
.prod:hover{box-shadow:inset 0 0 0 1.5px var(--ink)}
.prod i{width:48px;height:48px;border-radius:12px;display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(17,17,16,.08)}
.prod h3{font:600 18px/1.2 var(--mono);letter-spacing:-.03em;margin:0}
.prod p{margin:0;font-size:15px;line-height:1.5;color:var(--ink2)}
.prod span{margin-top:auto;font:500 13px/1 var(--mono);color:#8C887E}
.prod:hover span{color:var(--ver)}
`

const MARKS = {
  ungic: '<svg viewBox="0 0 56 56" width="24" height="24" fill="none"><path d="M14 18 V34 a14 14 0 0 0 28 0 V26" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/><circle cx="42" cy="12" r="5" fill="#6D5DFC"/></svg>',
  chatick: '<svg viewBox="0 0 48 48" width="24" height="24" fill="none"><path d="M24 4C12.4 4 3 12.7 3 23.5c0 5.4 2.4 10.3 6.2 13.8L8 44l8.4-3.2c2.4.7 4.9 1.2 7.6 1.2 11.6 0 21-8.7 21-19.5S35.6 4 24 4Z" stroke="#EEF3E6" stroke-width="4" stroke-linejoin="round"/><path d="M15 24.5 21 30l12-12" stroke="#D4F36B" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  vexelkit: '<svg viewBox="0 0 64 64" width="28" height="28"><rect x="5.5" y="5.5" width="53" height="53" rx="17" fill="#2BC874" transform="rotate(-8 32 32)"/></svg>',
}

const card = (href: string, tile: string, mark: string, name: string, text: string, host: string): string =>
  `<a class="prod" href="${href}" target="_blank" rel="noopener"><i style="background:${tile}" aria-hidden="true">${mark}</i>` +
  `<h3>${name}</h3><p>${text}</p><span>${host} ↗</span></a>`

const HTML = `
<div class="w" id="products">
<div class="sh"><h2 class="h2">Our products</h2><span class="idx">04</span></div>
<div class="prods">
${card('https://ungic.com/', '#09090c', MARKS.ungic, 'ungic', 'A wild machine built to replace Figma for developers: your AI designs and prototypes the app.', 'ungic.com')}
${card('https://chatick.com/', '#1f2b1b', MARKS.chatick, 'Chatick', 'Task planning for your team and your AI — always clear whose move it is.', 'chatick.com')}
${card('https://vexelkit.com/en', '#f5f2eb', MARKS.vexelkit, 'Vexelkit', 'Any illustrations, generated in sets — every picture in one style.', 'vexelkit.com')}
</div>
</div>
`

/** Where the section goes: before the closing "skey" wordmark and the footer. */
const BEFORE = '\n<div class="w">\n<p class="mark"'

/** The landing with the section; unchanged when the design no longer has the spot (a rebuilt landing serves as it is). */
export function withProducts(landing: string): string {
  if (!landing.includes(BEFORE) || !landing.includes('</style>')) return landing
  return landing.replace('</style>', `${CSS}</style>`).replace(BEFORE, `${HTML}${BEFORE}`)
}
