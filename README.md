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

## Commands

| | |
|---|---|
| `skey ui` | manage keys in the browser |
| `skey set NAME` | store one — typed, never passed as an argument |
| `skey list` | names and dates, never values |
| `skey rm NAME` | delete one |
| `skey run --only A,B -- cmd` | run a command with those secrets in its environment |
| `skey export NAME` | print a value — needs a real terminal |

---

## Keeping it that way

Add this to `~/.claude/settings.json` so the assistant can run commands but not
read or replace secrets:

```json
{
  "permissions": {
    "allow": ["Bash(skey run:*)", "Bash(skey list:*)"],
    "deny": ["Bash(skey export:*)", "Bash(skey set:*)"]
  }
}
```

`export` also refuses to run without a real terminal, so an assistant cannot
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
listed by service, so the index exists to make `list` possible. No values there.

---

## License

MIT
