---
name: skey
description: Get API keys, passwords and other secrets from the person, and use them, without the values entering the conversation. Use whenever a task needs a credential — a Cloudflare, Heroku, Vercel, AWS, Stripe, SMTP, database or any other key, token or password; when you are about to ask the person for one; when they offer to paste one; when a value has to end up in a .env file, a CI secret or a CLI's config; when a command needs an Authorization header; when the key is with a colleague, a client or on another computer; or when a tool reports a missing credential. Also use to set skey up the first time. Triggers include "дай ключ", "нужен токен", "пароль от", "вставь в .env", "положи ключ", "ключ у коллеги", "попроси у клиента", "передать ключ", skey1., API key, token, password, secret, credentials, .env.
---

# skey

A token pasted into a chat is in the transcript, and a model that sees one has
to treat it as compromised — which is where the refusals and the rotation
warnings come from. skey keeps the value in the machine's keychain and hands it
only to the process that needs it.

You never see a value. You see names, you ask for names, and you move values by
name.

## The three steps

Every time a task needs a secret:

1. **Ask** — create a request. The person fills it in a browser form or in
   their terminal, field by field.
2. **Move** — put the values where they belong (`.env`, a CI secret, a CLI's
   environment) with a command that never prints them.
3. **Clean up** — if the keychain was only a stopover, delete what the request
   created.

Commands below use `skey`; if it is not on the PATH, it is
`npx -y @tscodex/skey@latest` (`request`, `fill`, `dotenv` and `clean` need version 0.2 or newer;
`--share`, `--offline` and `import` need 0.3).

## 1. Ask

First check what is already there — maybe nothing needs asking:

```bash
skey list
```

If something is missing, **create a request. Never ask the person to paste a
value into the chat.**

```bash
skey request "SMTP_USER:Mailgun login" "SMTP_PASS:Mailgun password" "SMTP_HOST?:Server, if not smtp.mailgun.org" \
  --note "For sending mail from the app. Mailgun → Sending → Domain settings → SMTP credentials."
```

- Each field is `NAME`, `NAME:Label` or `NAME?:Label` — `?` makes it optional.
  Labels and the note are what the person reads: write them in the person's
  language, and say where to find the key.
- Name fields the way the destination expects (`CLOUDFLARE_API_TOKEN`,
  `DATABASE_URL`). If they differ, you can rename while moving (see below).
- A field whose name already exists becomes "leave empty to keep the current
  one".

**Run it in the background** (in Claude Code: Bash with `run_in_background:
true`). It prints within a second, then waits:

```
Request k7f2qa: SMTP_USER, SMTP_PASS, SMTP_HOST

  Browser:  http://127.0.0.1:53121/?t=…
  Terminal: npx @tscodex/skey fill k7f2qa
```

Read the output and give the person **both** lines — the link opens a form with
exactly these fields (it also opens in their browser by itself); the terminal
command asks for each field in turn with hidden input. Example message:

> I need your Mailgun SMTP login and password. Don't paste them here — fill
> them in here: <link>
> or in a terminal: `npx @tscodex/skey fill k7f2qa`

The request exits by itself the moment every field is filled — exit code 0 and
a line like `Done: stored: SMTP_USER, SMTP_PASS; skipped (left as is):
SMTP_HOST`. You are notified; there is no need to wait for "done" from the
person. Exit code 3 means it timed out (30 min; `--timeout <min>` to change):
`skey wait <ID>` resumes waiting, the terminal command keeps working.

No background execution available? `skey request ... --no-wait` prints the ID
and the terminal command without blocking; give the person the command, then
`skey wait <ID>`.

Do not run `skey fill` yourself — it is the person's command, and it refuses
without a real keyboard anyway.

### The key is with someone else

When the person says the key is with a colleague, a client or on another
machine, add `--share`. Everything else stays the same:

```bash
skey request "DB_URL:Production database URL" "STRIPE_KEY:Stripe secret key" --share \
  --from "Artyom" --note "For the payments deploy. Stripe → Developers → API keys."
```

The output gains a `Share:` link. Give it to the person to forward to whoever
has the key. That person opens it on any computer — nothing to install — or
runs `npx @tscodex/skey fill "<link>"`. Their browser encrypts the values for
this computer only. The relay sees only ciphertext, and the link lets them
answer but never read an answer. So it is fine that you, the chat and the
messenger all see the link.

- One request takes exactly one answer. The first reply closes it.
- The link works for 24 hours (`--ttl <hours>`, up to 168). The waiting
  command still stops after 30 minutes; after that, `skey wait <ID>` picks
  the reply up whenever it has arrived. The keys to decrypt it stay in this
  machine's keychain until then.
- `--from` is the name the other person sees ("Artyom asks for 2 keys").
  It defaults to `git config user.name`. Set it whenever you know it — people
  answer requests from someone they recognise.
- **No server allowed?** Use `--offline`. The link then carries the request
  itself, and the other person gets an encrypted reply text (`skey1.…`) to send
  back in any chat. When the person pastes it to you, run
  `skey import "skey1.…"`. The text is encrypted for this computer only, so
  it is safe for you to see and pass on.
- The page also offers that reply text when the server cannot be reached. The
  way back is the same: `skey import`.

**Plain values that are not secrets** (a hostname, a region, a username the
person already wrote in chat) do not need a request. Put them in the request
only when it is easier for the person to fill everything in one place.

## 2. Move

Pick by destination. None of these print the value, and anything a program
echoes back is masked.

**A `.env` file** — updates existing lines, appends missing ones, keeps CRLF and
`export`, quotes safely:

```bash
skey dotenv .env --only SMTP_USER,SMTP_PASS
skey dotenv apps/api/.env --only MAIL_PASSWORD=SMTP_PASS     # write as MAIL_PASSWORD
```

**A command that reads the secret from the environment:**

```bash
skey run --only CLOUDFLARE_API_TOKEN -- npx wrangler deploy
skey run --only CLOUDFLARE_API_TOKEN=CF_PROD_TOKEN -- npx wrangler deploy   # rename
skey run --only CF_API_TOKEN -- curl -H "Authorization: Bearer $CF_API_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify
```

The `$VAR` is expanded by the child process, not by you. Put single quotes
around a whole `sh -c '…'` so your own shell does not expand it first.

**A CLI that reads the secret from stdin** — the value goes in without a newline:

```bash
skey run --stdin GH_DEPLOY_KEY -- gh secret set DEPLOY_KEY --repo owner/repo
skey run --stdin CF_API_TOKEN  -- npx wrangler secret put CF_API_TOKEN
skey run --stdin DB_URL        -- npx vercel env add DATABASE_URL production
skey run --stdin REGISTRY_PASS -- docker login ghcr.io -u me --password-stdin
```

**A CLI that only takes it as an argument** (heroku, fly): pass it through the
environment inside a shell so the value never appears in your command line:

```bash
skey run --only SMTP_PASS -- sh -c 'heroku config:set SMTP_PASS="$SMTP_PASS" -a myapp'
```

**Any other file** (JSON, YAML, a config): a small script that reads the
environment and writes the file:

```bash
skey run --only API_KEY -- node -e "const f='config.json',c=JSON.parse(require('fs').readFileSync(f));c.apiKey=process.env.API_KEY;require('fs').writeFileSync(f,JSON.stringify(c,null,2))"
```

**After moving, do not read the destination.** Opening `.env` or the config you
just wrote puts the values in the transcript — exactly what this avoided. To
check what is there, look at names only:

```bash
grep -oE '^(export )?[A-Za-z_][A-Za-z0-9_]*=' .env
```

When writing a `.env`, make sure it is in `.gitignore`; say so if it is not.

## 3. Clean up

Decide whether the keychain was the destination or only a stopover.

- **Stopover** — the value now lives in `.env`, a CI secret, a hosting config,
  and nothing will call `skey run` with it later:
  ```bash
  skey clean k7f2qa
  ```
  Deletes the keys this request created and closes the request. Keys that
  existed before the request are kept (it says which) — `skey rm NAME --force`
  removes them if the person wants that.
- **Destination** — you will keep calling `skey run --only NAME` with it: keep
  it, and tell the person it stays in the keychain under that name.

Not sure which? Ask in one line. Stale requests: `skey clean --requests`
closes all of them without touching keys.

## Rules

- **Never ask the person to paste a secret into the chat.** Create a request.
  If they paste one anyway, say plainly that it is now in the transcript and
  should be rotated, then still store it through a request rather than using
  the pasted value.
- **Never read a value**, and never read a file you just wrote values into.
  `skey export` refuses to run without a real terminal, so trying wastes a turn.
- **Don't echo** a variable to "check it worked" (`echo $TOKEN`, `env`,
  `printenv`). Masking will likely hide it, but do not rely on that. To verify,
  call the API's own check endpoint, or check the name with `skey list`.

## Setting it up

```bash
npx -y @tscodex/skey@latest list
```

Lists keys, or prints "Nothing stored yet" — either way it works. Nothing else
to install; it is a command, not a server, so no restart.

Then add the permission rules to `~/.claude/settings.json`. Merge them — that
file holds the person's own rules, often hundreds:

```json
{
  "permissions": {
    "allow": [
      "Bash(skey list:*)", "Bash(skey run:*)", "Bash(skey request:*)", "Bash(skey wait:*)",
      "Bash(skey dotenv:*)", "Bash(skey clean:*)", "Bash(skey import:*)",
      "Bash(npx -y @tscodex/skey@latest import:*)",
      "Bash(npx -y @tscodex/skey@latest list:*)", "Bash(npx -y @tscodex/skey@latest run:*)",
      "Bash(npx -y @tscodex/skey@latest request:*)", "Bash(npx -y @tscodex/skey@latest wait:*)",
      "Bash(npx -y @tscodex/skey@latest dotenv:*)", "Bash(npx -y @tscodex/skey@latest clean:*)"
    ],
    "deny": [
      "Bash(skey export:*)", "Bash(skey set:*)", "Bash(skey fill:*)",
      "Bash(npx -y @tscodex/skey@latest export:*)", "Bash(npx -y @tscodex/skey@latest set:*)",
      "Bash(npx -y @tscodex/skey@latest fill:*)"
    ]
  }
}
```

The allow rules are not cosmetic: without them every step stops for approval.
The deny rules say out loud what the tool already enforces — typing values is
the person's job.

## What it does not do

`skey run` hands the secret to whatever you run. It is not a sandbox: a command
that misuses the token gets it just the same. Judge the command as carefully as
you would without skey.

Masking covers exact matches plus base64, URL-encoded and JSON-escaped forms,
for values of 6+ characters. A value that comes back split or encoded
differently can still appear in output — if you ever see something that looks
like a live token in a result, say so rather than passing it along.

The local request link carries a one-time token and works only while the
request is waiting. It can only write the fields of that request and never
returns values. A `--share` link holds a secret after `#` that browsers never
send to the server. With it, someone can encrypt an answer for this computer,
but nobody can decrypt one, the relay included.
