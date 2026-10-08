# @tscodex/skey

Keep API tokens out of your assistant's context.

Secrets live in your machine's keychain. Claude sees the names, runs commands
with them, and never reads the values.

Part of [**tscodex**](https://tscodex.com) — a project by
[unbywyd](https://unbywyd.com) building free, useful software.

---

## The problem

Paste a Cloudflare token into a chat and it is in the transcript. From then on
the model treats it as compromised, and rightly so — it starts refusing work,
asking you to rotate the key, warning about exposure. You spend the session
arguing instead of working.

The token was never meant to be read. It was meant to be *used*.

---

## Install

```bash
npx @tscodex/skey ui
```

Node 18 or newer. Nothing else.

---

## Use

**Store a key** — in the browser, or from the terminal:

```bash
npx @tscodex/skey ui          # opens a local page
skey set CF_API_TOKEN         # or type it here, hidden
```

**Let Claude use it:**

```bash
skey run --only CF_API_TOKEN -- curl -H "Authorization: Bearer $CF_API_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify
```

The command gets the value in its environment. Claude sees the variable name.
If the API echoes the token back, the output is masked before it reaches the
transcript.

---

## When the assistant needs a key from you

Instead of "paste your token here", the assistant creates a request:

```bash
skey request "SMTP_USER:Mailgun login" "SMTP_PASS:Mailgun password" --note "Mailgun → Domain settings → SMTP"
```

```
Request k7f2qa: SMTP_USER, SMTP_PASS

  Browser:  http://127.0.0.1:53121/?t=…
  Terminal: npx @tscodex/skey fill k7f2qa
```

You open the link and get a form with exactly those fields — or run the
terminal command and it asks for each one in turn, input hidden. The request
exits as soon as everything is filled, and the assistant carries on: it moves
the values where they belong without seeing them —

```bash
skey dotenv .env --only SMTP_USER,SMTP_PASS                    # into a .env file
skey run --stdin SMTP_PASS -- gh secret set SMTP_PASS          # into a CLI that reads stdin
skey run --only MAIL_PASSWORD=SMTP_PASS -- npm run deploy      # under another variable name
```

— and, if the keychain was only a stopover, removes them:

```bash
skey clean k7f2qa      # deletes the keys this request created
```

---

## When the key is on someone else's computer

Add `--share` and the request gets a link that works anywhere:

```bash
skey request "DB_URL:Production database" "STRIPE_KEY:Stripe secret key" --share --from "Artyom"
```

```
  Share:    https://skey.tscodex.com/r/k7f2qa#Xp3…
            works on any computer, end-to-end encrypted; the reply arrives here by itself
```

Send it to whoever has the keys. They open it in a browser (nothing to install),
or answer from their terminal with `npx @tscodex/skey fill "<link>"`. The values
are encrypted on their side, for your computer only. The reply arrives here by
itself and goes into your keychain, just like a local one.

- **The server cannot read anything.** The secret lives after `#` in the link,
  and browsers never send that part. The request description is encrypted with
  it. The reply is encrypted with a key whose private half never leaves your
  keychain (ECDH P-256 + AES-256-GCM, Web Crypto).
- **The link can answer, not read.** Whoever sees it can reply. Only your
  computer can open the reply, so a link that passed through a chat or an
  assistant is fine.
- **One request, one answer.** The first reply closes it. The link expires
  after 24 hours (`--ttl`, up to 7 days), and the server deletes the ciphertext
  as soon as you have it.
- **No server?** `--offline` puts the whole request in the link. Instead of
  sending, the page gives them an encrypted reply text (`skey1.…`) to send
  back any way they like. You take it with `skey import`.

The relay is a small Cloudflare Worker in [`relay/`](relay/). Run your own and
point at it with `--relay https://…` or `SKEY_RELAY`.

---

## Commands

| | |
|---|---|
| `skey ui` | manage keys in the browser |
| `skey set NAME` | store one — typed, never passed as an argument |
| `skey list` | names and dates, never values |
| `skey rm NAME...` | delete one or more |
| `skey run --only A,B -- cmd` | run a command with those secrets in its environment |
| `skey run --only VAR=NAME -- cmd` | same, under another variable name |
| `skey run --stdin NAME -- cmd` | pipe a value into the command's stdin |
| `skey dotenv FILE --only A,B` | write values into a .env file (updates or appends) |
| `skey request A "B:Label" "C?:Optional"` | ask the person; prints a link and an ID, waits until filled |
| `skey fill [ID]` | fill a request in the terminal, field by field — needs a real terminal |
| `skey request ... --share` | same, plus a link for another computer (end-to-end encrypted) |
| `skey fill "<link>"` | answer someone's link from the terminal |
| `skey import skey1.…` | take an encrypted reply someone sent back |
| `skey wait ID` | wait for a request created earlier |
| `skey clean ID` | close a request and delete the keys it created |
| `skey export NAME` | print a value — needs a real terminal |

---

## Keeping it that way

Add this to `~/.claude/settings.json` so the assistant can run commands but not
read or replace secrets:

```json
{
  "permissions": {
    "allow": [
      "Bash(skey run:*)", "Bash(skey list:*)", "Bash(skey request:*)",
      "Bash(skey wait:*)", "Bash(skey dotenv:*)", "Bash(skey clean:*)"
    ],
    "deny": ["Bash(skey export:*)", "Bash(skey set:*)", "Bash(skey fill:*)"]
  }
}
```

`export` and `fill` also refuse to run without a real terminal, so an assistant cannot
reach a value even if the rule is missing.

---

## What this does and does not protect against

**It keeps tokens out of the transcript.** That is the whole point, and it works:
the value is read from the keychain and handed to one child process.

**Masking is best-effort.** Exact matches are caught, along with base64,
URL-encoded and JSON-escaped forms. A value split across a boundary or encoded
some other way can slip through.

**It does not sandbox the command you run.** `skey run` hands the secret to
whatever you told it to run. A malicious program gets the token like any other
program would.

**The browser page is local.** It listens on `127.0.0.1`, needs a one-time token
from the URL, and dies with the terminal. It is not a defence against malware
already on the machine — that could call `skey run` directly.

---

## Where things are stored

| | |
|---|---|
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | Secret Service (GNOME Keyring, KWallet) |

Names and dates go in `~/.tscodex/skey-index.json` — system keychains cannot be
listed by service, so the index exists to make `list` possible. Open requests
live in `~/.tscodex/skey-requests/` — field names, labels and the note, removed
after a week. No values in either.

---

## License

MIT
