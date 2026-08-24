---
name: skey
description: Run commands that need API tokens without the tokens entering the conversation. Use whenever a task involves a Cloudflare, Heroku, Vercel, AWS or any other API key — including when the person offers to paste one, when a command needs an Authorization header, or when a tool reports it is missing a credential. Also use to set skey up the first time.
---

# skey

A token pasted into a chat is in the transcript, and a model that sees one has
to treat it as compromised — which is where the refusals and the rotation
warnings come from. skey keeps the value in the machine's keychain and hands it
only to the process that needs it.

## The rule

Any command that needs a secret runs through `skey run`:

```
skey run --only CF_API_TOKEN -- curl -H "Authorization: Bearer $CF_API_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify
```

The variable is expanded by the child process, not by you. You never see the
value, and you do not need it.

**Never ask the person to paste a token.** If one is missing, ask them to store
it: `skey set NAME`, or `skey ui` for the browser page. If they paste one
anyway, say plainly that it is now in the transcript and should be rotated.

**Never read a value.** `skey export` refuses to run without a real terminal, so
attempting it wastes a turn. If you genuinely need to know whether a key exists,
`skey list` shows names.

## Setup

Check first: `skey list`. If the command is missing, install and store the keys.

```bash
npx -y @tscodex/skey list
```

Storing a key is the person's job, not yours — the value has to be typed. Point
them at `npx @tscodex/skey ui` for a browser page, or `skey set NAME` in their
own terminal.

Then add to `~/.claude/settings.json`, merging rather than replacing:

```json
{
  "permissions": {
    "allow": ["Bash(skey run:*)", "Bash(skey list:*)"],
    "deny": ["Bash(skey export:*)", "Bash(skey set:*)"]
  }
}
```

The allow rules matter in practice: without them every diagnostic call stops for
approval, and a session with a dozen API calls becomes unusable.

## Naming

Use the name the tool expects — `CF_API_TOKEN`, `HEROKU_API_KEY`,
`AWS_SECRET_ACCESS_KEY`. The command reads it from the environment, so the name
has to match what that command looks for.

## What it does not do

`skey run` hands the secret to whatever you run. It is not a sandbox: a command
that misuses the token gets it just the same. Judge the command as carefully as
you would without skey.

Masking covers exact matches plus base64, URL-encoded and JSON-escaped forms. A
value that comes back split or encoded differently can still appear in output —
if you ever see something that looks like a live token in a result, say so
rather than passing it along.
