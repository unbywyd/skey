// Лендинг skey.tscodex.com из макета (artboard Main на холсте «skey — UI и лендинг»,
// https://claude.ai/artifact/QWVg8FMnAcB5pNL8KPzanQ). Правки дизайна — сначала в макет.
//
//   node build-landing.mjs <путь к Main.dc.html>
//
// Пишет src/landing.ts. Промпт «спроси свою LLM» берётся из public/llms.txt — тот же
// текст отдаётся по /llms.txt, так что у кнопки и у адреса одна правда.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const design = readFileSync(process.argv[2], 'utf8')
const prompt = readFileSync(join(here, 'public', 'llms.txt'), 'utf8').replace(/\r\n/g, '\n')

let style = design.match(/<helmet>[\s\S]*?<style>([\s\S]*?)<\/style>/)[1]
let body = design.match(/<\/helmet>\s*([\s\S]*?)\s*<\/x-dc>/)[1]

// На холсте обёртка обрезала переполнение и фиксировала ширину; настоящая страница прокручивается.
style = style.replace('-webkit-font-smoothing:antialiased;overflow:hidden}', '-webkit-font-smoothing:antialiased;overflow-x:hidden}')
body = body.replace('<div class="L" style="width: 100%; min-height: 100vh">', '<div class="L">')

const FAVICON = 'data:image/svg+xml,' +
  '%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22%3E' +
  '%3Ccircle cx=%226.5%22 cy=%2212%22 r=%223.75%22 stroke=%22%23111110%22 stroke-width=%222.2%22/%3E' +
  '%3Cpath d=%22M10.25 12H22%22 stroke=%22%23111110%22 stroke-width=%222.2%22 stroke-linecap=%22round%22/%3E' +
  '%3Crect x=%2214%22 y=%2214%22 width=%228%22 height=%224.5%22 rx=%221%22 fill=%22%23C93E12%22/%3E%3C/svg%3E'

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>skey — API key manager for Claude Code and AI agents</title>
<meta name="description" content="Open-source CLI that keeps API keys in your OS keychain. Claude Code and other AI agents run commands with secrets by name and never see the values.">
<meta property="og:title" content="skey — your AI agent uses the key, never sees it">
<meta property="og:description" content="Open-source CLI that keeps API keys in your OS keychain. Request keys from people end-to-end encrypted.">
<meta property="og:url" content="https://skey.tscodex.com/">
<meta name="theme-color" content="#F4F2EC">
<link rel="icon" href="${FAVICON}">
<link rel="alternate" type="text/plain" href="/llms.txt" title="skey for LLMs">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
<style>${style}
.cbtn,.askbtn{cursor:pointer}
.cbtn:focus-visible,.askbtn:focus-visible,.tag:focus-visible,.biglink:focus-visible,a:focus-visible{outline:2px solid var(--ver);outline-offset:3px}
</style>
</head>
<body>
${body}
<script>
// Единственные скрипты страницы: две кнопки копирования.
const PROMPT = ${JSON.stringify(prompt)}
async function copy(button, text, label, done) {
  await navigator.clipboard.writeText(text)
  const span = button.querySelector('span')
  if (span) span.textContent = done
  button.setAttribute('aria-label', done)
  button.style.background = '#C93E12'
  setTimeout(() => { if (span) span.textContent = label; button.setAttribute('aria-label', label); button.style.background = '' }, 2500)
}
document.querySelector('.cbtn').addEventListener('click', (e) => copy(e.currentTarget, 'npx @tscodex/skey ui', 'Copy install command', 'Copied'))
const ask = document.querySelector('.askbtn')
if (ask) ask.addEventListener('click', (e) => copy(e.currentTarget, PROMPT, 'Copy prompt for your AI', 'Copied — paste it into Claude, ChatGPT…'))
</script>
</body>
</html>
`

const module = `/**
 * Лендинг skey.tscodex.com — собран из макета canvas «skey — UI и лендинг» (artboard Main)
 * скриптом build-landing.mjs. Правки дизайна — сначала в макет, потом пересборка.
 */

export const LANDING = ${JSON.stringify(page)}
`
writeFileSync(join(here, 'src', 'landing.ts'), module)
console.log('landing bytes', Buffer.byteLength(page))
