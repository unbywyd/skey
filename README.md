<p align="center">
  <a href="https://skey.tscodex.com"><img src="https://raw.githubusercontent.com/unbywyd/skey/main/docs/landing.png" alt="skey — your AI agent uses the key, never sees it" width="820"></a>
</p>

<h1 align="center">skey</h1>

<p align="center">
  <b>Your AI agent uses the key. Never sees it.</b><br>
  API keys live in your OS keychain. Claude Code runs commands with them by name —<br>
  the value never reaches the chat.
</p>

<p align="center">
  <a href="https://skey.tscodex.com"><b>skey.tscodex.com</b></a> ·
  <a href="https://skey.tscodex.com/tour"><b>Take the tour</b></a> ·
  <a href="https://www.npmjs.com/package/@tscodex/skey">npm</a> ·
  <a href="https://github.com/unbywyd/skey">GitHub</a> ·
  <a href="https://github.com/unbywyd/skey/tree/main/skill">Agent skill</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@tscodex/skey"><img src="https://img.shields.io/npm/v/@tscodex/skey?color=C93E12&label=npm" alt="npm version"></a>
  <img src="https://img.shields.io/badge/license-MIT-111110" alt="MIT">
  <img src="https://img.shields.io/badge/node-%E2%89%A518-111110" alt="Node 18+">
  <img src="https://img.shields.io/badge/macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-111110" alt="macOS, Windows, Linux">
</p>

---

```bash
npx @tscodex/skey ui
```

That opens a local page where you add your keys. From then on:

```bash
skey run --only STRIPE_SECRET_KEY -- npm run sync
# key=***MASKED*** · 200 OK
```

The agent writes `STRIPE_SECRET_KEY`. The process gets the value. The chat gets nothing.

## Why

Paste a token into a chat and it lives in the transcript forever. The model has
to treat it as compromised: it refuses to continue, asks you to rotate the key,
and the session turns into an argument. The token was never meant to be *read* —
only *used*.

| Where keys leak | What skey does |
| --- | --- |
| You paste a token into the chat | the agent runs `skey run --only NAME -- cmd` and never sees the value |
| The agent asks "paste your key here" | it sends you a request link instead — `skey request` |
| A tool prints the token back | output is masked: exact value, base64, URL- and JSON-escaped |
| The key has to go into `.env`, CI or hosting | `skey dotenv`, `skey run --stdin` — moved by name, never read |
| A colleague sends a key over Telegram | an end-to-end encrypted link that only your machine can open — `--share` |
| `.env` files and `.pem` keys in the repo | everything sits in the OS keychain, nothing on disk |
| Leftover keys after a one-off transfer | `skey clean` removes what a request created |

## The agent asks, you fill, it continues

```bash
skey request "SMTP_USER:Mailgun login" "SMTP_PASS:Mailgun password" \
  --note "Mailgun → Sending → Domain settings → SMTP credentials"
```

```
Request k7f2qa: SMTP_USER, SMTP_PASS

  Browser:  http://127.0.0.1:53121/?t=…
  Terminal: npx @tscodex/skey fill k7f2qa
```

You open the link and get a form with exactly those fields, or run the terminal
command and type them one by one with hidden input. Values go straight into the
keychain. The command exits as soon as everything is filled, and the agent
carries on by itself — no "tell me when you're done".

<p align="center">
  <img src="https://raw.githubusercontent.com/unbywyd/skey/main/docs/request-local-dark.png" alt="A local key request in dark mode" width="420">
</p>

Then the agent moves the values where they belong, without reading them:

```bash
skey dotenv .env --only SMTP_USER,SMTP_PASS                  # into a .env file
skey run --stdin SMTP_PASS -- gh secret set SMTP_PASS        # into a CLI that reads stdin
skey run --only MAIL_PASSWORD=SMTP_PASS -- npm run deploy    # under another name
skey clean k7f2qa                                            # one-off? remove them after
```

## The key is on someone else's computer

Add `--share`, and the request gets a link that works anywhere:

```bash
skey request "STRIPE_SECRET_KEY:Stripe secret key" "DATABASE_URL:Production database URL" \
  --share --from "Artyom"
```

Send the link to whoever has the keys. They open it in a browser — no account,
nothing to install — or answer from their terminal with
`npx @tscodex/skey fill "<link>"`. The reply arrives on your machine by itself.

<p align="center">
  <img src="https://raw.githubusercontent.com/unbywyd/skey/main/docs/request-remote.png" alt="A shared key request: only the requester's computer can read the reply" width="460">
</p>

- **The server reads nothing.** The secret sits after `#` in the link, and
  browsers never send that part. The request is encrypted with it, and the reply
  is encrypted for a key whose private half never leaves your keychain
  (ECDH P-256 + AES-256-GCM, Web Crypto, no libraries).
- **The link can answer, not read.** A link that passed through a chat or an
  assistant is fine: only your computer can open the reply.
- **One request, one answer.** The first reply closes it. Links expire after
  24 hours (`--ttl`, up to 7 days), and the ciphertext is deleted the moment you
  have it.
- **No server allowed?** `--offline` puts the whole request in the link. Instead
  of sending, they get an encrypted reply text (`skey1.…`) to paste back in any
  chat, and you take it with `skey import`.

The relay is a small open-source Cloudflare Worker in [`relay/`](relay/). Run
your own and point at it with `--relay https://…` or `SKEY_RELAY`.

## Set up Claude Code

Install the [agent skill](skill/SKILL.md) so Claude knows how to ask for keys,
move them and clean up:

```bash
mkdir -p ~/.claude/skills/skey
curl -o ~/.claude/skills/skey/SKILL.md https://raw.githubusercontent.com/unbywyd/skey/main/skill/SKILL.md
```

Then let it run skey without approval prompts — but never read or type values.
Merge into `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(skey run:*)", "Bash(skey list:*)", "Bash(skey request:*)", "Bash(skey wait:*)",
      "Bash(skey dotenv:*)", "Bash(skey clean:*)", "Bash(skey import:*)"
    ],
    "deny": ["Bash(skey export:*)", "Bash(skey set:*)", "Bash(skey fill:*)"]
  }
}
```

`export` and `fill` also refuse to run without a real terminal, so an assistant
cannot reach a value even if a rule is missing.

## Commands

| | |
| --- | --- |
| `skey ui [--no-open]` | manage keys in the browser |
| `skey set NAME` | store one — typed, never passed as an argument |
| `skey list` | names and dates, never values |
| `skey rm NAME...` | delete one or more |
| `skey run --only A,B -- cmd` | run a command with those secrets in its environment |
| `skey run --only VAR=NAME -- cmd` | same, under another variable name |
| `skey run --stdin NAME -- cmd` | pipe a value into the command's stdin |
| `skey dotenv FILE --only A,B` | write values into a .env file (updates or appends) |
| `skey request A "B:Label" "C?:Optional"` | ask the person; prints a link and an ID, waits until filled |
| `skey request ... --share` | same, plus a link for another computer |
| `skey fill [ID \| "<link>"]` | answer a request in the terminal, field by field |
| `skey import skey1.…` | take an encrypted reply someone sent back |
| `skey wait ID` | wait for a request created earlier |
| `skey clean ID` | close a request and delete the keys it created |
| `skey export NAME` | print a value — needs a real terminal |

## What it does not do

- **It does not sandbox the command.** `skey run` hands the secret to whatever
  you run. A malicious program gets it like any other program would.
- **Masking is best-effort.** It catches the value and its common encodings. A
  command that transforms the value first — reverses it, splits it — can still
  print it. Judge commands as carefully as you would without skey. Turning
  masking off (`--no-mask`) works only from a real terminal.
- **A file is a file.** A value written with `skey dotenv` sits in that file in
  the clear, and whoever can read the file — an assistant included — can read
  the value. Keep such files in `.gitignore`.
- **The shared page comes from the relay.** Encryption happens in the browser,
  but the page's code is served by the relay, so whoever runs the relay could
  change that code. If you do not trust the relay, answer from the terminal
  (`skey fill "<link>"`): the encryption then runs in the skey CLI on your own
  machine. Or run your own relay.
- **The local pages are local.** They listen on `127.0.0.1`, need a one-time
  token from the URL, and die with the terminal. They are no defence against
  malware already on the machine.

## Where things are stored

| | |
| --- | --- |
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | Secret Service (GNOME Keyring, KWallet) |

Names and dates go in `~/.tscodex/skey-index.json`, because system keychains
cannot be listed. Open requests live in `~/.tscodex/skey-requests/`: field
names, labels and the note, removed after a week. No values in either.

---

<p align="center">
  Part of <a href="https://tscodex.com"><b>tscodex</b></a> — free, useful software by <a href="https://unbywyd.com">unbywyd</a>. MIT.
</p>
