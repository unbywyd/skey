/**
 * Общий вид страниц skey: токены, иконки, компоненты.
 *
 * Страницы — по одному HTML-файлу без внешних ресурсов (их отдаёт и локальный
 * сервер без сети, и ретранслятор со строгим CSP), поэтому тема живёт строками
 * и вставляется в каждую страницу целиком. Источник — макеты в canvas
 * «skey — UI и лендинг»: системные шрифты, один акцент (киноварь), без рамок —
 * только поверхности и заливки.
 */

/** Иконки: сетка 24, обводка 1.75. Только то, что есть в макете. */
export const ICON = {
  lock: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  eye: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/></svg>',
  copy: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
  trash: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  terminal: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>',
  alert: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>',
  spinner: '<svg class="i spin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"/></svg>',
}

/** Знак: кольцо ключа и бородка-«замазка» цвета акцента. */
export const LOGO =
  '<span class="logo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="6.5" cy="12" r="3.75" stroke="currentColor" stroke-width="2.2"/>' +
  '<path d="M10.25 12H22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
  '<rect x="14" y="14" width="8" height="4.5" rx="1" fill="var(--accent)"/></svg>skey</span>'

/** Тот же знак для вкладки браузера. */
export const FAVICON =
  '<link rel="icon" href="data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="6.5" cy="12" r="3.75" stroke="#111110" stroke-width="2.2"/><path d="M10.25 12H22" stroke="#111110" stroke-width="2.2" stroke-linecap="round"/><rect x="14" y="14" width="8" height="4.5" rx="1" fill="#C93E12"/></svg>',
  ) +
  '">'

export const THEME_CSS = `
:root{
  --bg:#F4F2EC;--surface:#FFFFFF;--sunken:#ECE9E1;--line-strong:#C9C4B8;
  --text:#111110;--muted:#4F4C46;--faint:#6E6A62;
  --accent:#C93E12;--accent-hover:#A83310;--accent-soft:#FBE3D8;--on-accent:#FFFFFF;
  --ok:#2B6E45;--ok-soft:#E2EFE6;--on-ok:#FFFFFF;
  --danger:#B4123A;--danger-soft:#FBE1E6;--on-danger:#FFFFFF;
  --vault:#111110;--vault-text:#F4F2EC;--vault-muted:#C9C5BB;--vault-chip:#26251F;--vault-chip-text:#ECEAE4;
  --shadow:0 1px 2px rgba(17,17,16,.06),0 10px 30px rgba(17,17,16,.10);
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
  --dur:160ms;color-scheme:light;
}
@media (prefers-color-scheme: dark){:root{
  --bg:#0F0F0E;--surface:#181715;--sunken:#0B0B0A;--line-strong:#3A3733;
  --text:#ECEAE4;--muted:#A9A59B;--faint:#8C887E;
  --accent:#FF7A45;--accent-hover:#FF9566;--accent-soft:#2E1A10;--on-accent:#1A0A03;
  --ok:#71C28F;--ok-soft:#13241A;--on-ok:#0B1A11;
  --danger:#FF6B8A;--danger-soft:#2E1219;--on-danger:#1F060C;
  --vault:#ECEAE4;--vault-text:#111110;--vault-muted:#4F4C46;--vault-chip:#DAD6CC;--vault-chip-text:#111110;
  --shadow:0 1px 2px rgba(0,0,0,.5),0 10px 30px rgba(0,0,0,.45);
  color-scheme:dark;
}}
@media (prefers-reduced-motion: reduce){:root{--dur:0ms}}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 var(--sans);-webkit-font-smoothing:antialiased;padding:56px 16px 40px}
a{color:var(--accent)}a:hover{color:var(--accent-hover)}
button,input,textarea{font:inherit;color:inherit}
:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--accent)}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.col{max-width:600px;margin:0 auto}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.logo{display:inline-flex;align-items:center;gap:8px;font:700 18px/1 var(--mono);letter-spacing:-.04em;color:var(--text);text-decoration:none}
.pill{display:inline-flex;align-items:center;gap:6px;font:500 12px/1 var(--mono);color:var(--muted);padding:8px 11px;background:var(--sunken);border-radius:999px}
.dot{width:6px;height:6px;border-radius:50%;background:var(--ok)}
.t{font:650 44px/1.02 var(--mono);letter-spacing:-.06em;margin:48px 0 0;overflow-wrap:anywhere}
.t .n{color:var(--accent)}
.lede{color:var(--muted);margin:12px 0 0;max-width:520px}
.sec{display:flex;align-items:center;justify-content:space-between;gap:12px;font:600 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin:40px 0 12px}
.card{background:var(--surface);border-radius:14px}
svg.i{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.spin{animation:spin 900ms linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.spin{animation:none}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:8px;font:600 14px/1 var(--sans);border:0;cursor:pointer;white-space:nowrap;background:transparent;color:var(--muted);transition:background var(--dur),color var(--dur),opacity var(--dur)}
.btn:disabled{cursor:progress;opacity:.72}
.btn-p{background:var(--text);color:var(--bg)}
.btn-p:hover:not(:disabled){opacity:.86}
.btn-a{background:var(--accent);color:var(--on-accent)}
.btn-a:hover:not(:disabled){background:var(--accent-hover)}
.btn-s{background:var(--sunken);color:var(--text)}
.btn-g:hover{color:var(--text);background:var(--sunken)}
.btn-d{background:var(--danger);color:var(--on-danger)}
.btn-dg{color:var(--danger)}
.btn-dg:hover{background:var(--danger-soft)}
.btn-sm{height:32px;padding:0 10px;font-size:13px;border-radius:6px}
.btn-block{width:100%;height:48px;font-size:15px;border-radius:10px}
.btn-big{height:52px;font-size:16px}
.ib{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;border:0;background:transparent;color:var(--muted);cursor:pointer;padding:0;flex-shrink:0}
.ib:hover{color:var(--text);background:var(--sunken)}
.ib.d{color:var(--danger)}
.lbl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:15px;font-weight:600;margin-bottom:8px}
.kn{font:500 12.5px var(--mono);color:var(--faint);overflow-wrap:anywhere}
.fld{position:relative}
.in{width:100%;height:48px;border:0;background:var(--sunken);color:var(--text);border-radius:8px;padding:0 48px 0 14px;font:14px var(--mono);outline:none;transition:box-shadow var(--dur),background var(--dur)}
.in::placeholder{color:var(--faint);font-family:var(--sans)}
.in:focus{box-shadow:0 0 0 2px var(--accent);background:var(--surface)}
.in.err{box-shadow:0 0 0 2px var(--danger);background:var(--danger-soft)}
.in[readonly]{color:var(--muted)}
.fld .eye,.fld .lockmark{position:absolute;right:8px;top:8px}
.fld .lockmark{right:14px;top:15px;color:var(--faint)}
.txt{width:100%;height:48px;border:0;border-radius:0;background:transparent;box-shadow:inset 0 -2px 0 var(--line-strong);color:var(--text);padding:0 2px;font:16px var(--sans);outline:none}
.txt:focus{box-shadow:inset 0 -2px 0 var(--accent)}
.txt::placeholder{color:var(--faint)}
.help{font-size:13px;color:var(--muted);margin-top:6px;display:flex;gap:6px;align-items:flex-start}
.help svg.i{width:16px;height:16px;margin-top:1px}
.help.e{color:var(--danger);font-weight:500}
.help.w{color:var(--accent)}
.badge{display:inline-flex;align-items:center;gap:4px;font:600 11px/1 var(--mono);padding:5px 8px;border-radius:999px;background:var(--sunken);color:var(--muted);white-space:nowrap;text-transform:uppercase;letter-spacing:.04em}
.badge svg.i{width:12px;height:12px;stroke-width:2.5}
.badge.ok{background:var(--ok-soft);color:var(--ok)}
.badge.ac{background:var(--accent-soft);color:var(--accent)}
.cmd{display:flex;align-items:center;gap:8px;background:var(--text);color:var(--bg);border-radius:10px;padding:5px 5px 5px 14px;min-width:0}
.cmd code{flex:1;min-width:0;font:13px/1.5 var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmd .p{color:var(--accent-hover)}
.cmd .ib{color:var(--bg);opacity:.8}
.cmd .ib:hover{opacity:1;background:transparent}
.rd{display:inline-block;width:44px;height:9px;border-radius:2px;background:var(--text);flex-shrink:0}
.toastbox{position:fixed;left:16px;right:16px;bottom:24px;display:flex;justify-content:center;pointer-events:none;z-index:10}
.toast{display:inline-flex;align-items:center;gap:10px;background:var(--text);color:var(--bg);padding:11px 16px;border-radius:10px;font-size:14px;box-shadow:var(--shadow)}
.toast b{font:600 13.5px var(--mono)}
.toast svg{color:var(--ok)}
.foot{font:12px var(--mono);color:var(--faint);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:40px}
.foot a{color:var(--text)}
/* заглушки: значок, заголовок, одна-две строки, команда по желанию */
.stub{margin-top:72px}
.stub .ic{width:72px;height:72px;border-radius:20px;display:flex;align-items:center;justify-content:center}
.stub .ic svg.i{width:32px;height:32px;stroke-width:2}
.stub .ic.ok{background:var(--ok);color:var(--on-ok)}
.stub .ic.no{background:var(--danger-soft);color:var(--danger)}
.stub .ic.mu{background:var(--sunken);color:var(--muted)}
.stub .ic.ink{background:var(--text);color:var(--bg)}
.stub .t{margin-top:28px}
.stub .d{color:var(--muted);margin:12px 0 0;font-size:16px}
.stub .cmd{margin-top:24px}
.names{display:flex;flex-direction:column;gap:4px;margin-top:32px}
.names .r{display:flex;align-items:center;gap:14px;background:var(--surface);border-radius:10px;padding:14px 16px}
.names .kn{font:600 14px var(--mono);color:var(--text);flex:1}
@media (max-width:560px){
  body{padding:20px 16px 32px}
  .t{font-size:34px;margin-top:36px}
  .sec{font-size:11px;margin:32px 0 10px}
  .stub{margin-top:40px}
}
`

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Заглушка сервером, без скриптов: «ссылка неверна» и т. п. */
export function stubPage(o: { title: string; text: string; icon: keyof typeof ICON; kind: 'ok' | 'no' | 'mu' | 'ink'; cmd?: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<title>skey</title>${FAVICON}<style>${THEME_CSS}</style></head>
<body><main class="col">${LOGO}<div class="stub"><div class="ic ${o.kind}">${ICON[o.icon]}</div>
<h1 class="t">${esc(o.title)}</h1><p class="d">${esc(o.text)}</p>
${o.cmd ? `<div class="cmd"><code><span class="p">$ </span>${esc(o.cmd)}</code></div>` : ''}</div>
<div class="foot"><span>part of tscodex</span></div></main></body></html>`
}
