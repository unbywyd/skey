#!/usr/bin/env bash
# Прогоняет три кейса ролика по-настоящему и складывает вывод skey и снимки
# страниц в out/capture/. Работает в отдельном демо-профиле (свой индекс и
# запросы), поэтому настоящие ключи в кадр не попадают. Демо-ключи удаляются.
set -u
cd "$(dirname "$0")"
OUT="$PWD/out/capture"; rm -rf "$OUT"; mkdir -p "$OUT"
DEMO="$(mktemp -d)"
# Демо-профиль — только для skey: Chrome с подменённой домашней папкой не стартует.
skey() { USERPROFILE="$DEMO" HOME="$DEMO" command skey "$@"; }
link() { grep -o "$1[^ ]*" "$2" | head -1; }
rid() { head -1 "$1" | awk '{print $2}' | tr -d :; }

# --- 1. Агент просит ключи, человек заполняет форму в браузере ----------------------
skey request "STRIPE_SECRET_KEY:Stripe secret key" "STRIPE_WEBHOOK_SECRET:Stripe webhook signing secret" \
  --note "Setting up payments for the shop.
Stripe → Developers → API keys → Secret key (test mode).
Webhook: Developers → Webhooks → your endpoint → Signing secret." \
  --no-open --timeout 10 > "$OUT/c1.out" 2>&1 &
P1=$!; sleep 3
node capture.mjs local "$(link 'http://127.0.0.1:' "$OUT/c1.out")" "$OUT/c1" \
  '{"STRIPE_SECRET_KEY":"demo-only-stripe-secret-not-a-real-key00","STRIPE_WEBHOOK_SECRET":"demo-only-webhook-secret-not-real"}' \
  || { echo 'capture 1 failed'; kill $P1; }
wait $P1

# Агент переносит ключи в .env и пользуется ими, не видя значений.
mkdir -p "$DEMO/shop" && cd "$DEMO/shop"
cat > package.json <<'JSON'
{ "name": "shop", "version": "1.0.0", "private": true, "scripts": { "stripe:check": "node check.js" } }
JSON
echo "console.log('Stripe: connected with key=' + process.env.STRIPE_SECRET_KEY + ' · 200 OK')" > check.js
skey dotenv .env --only STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET > "$OUT/c1.dotenv.out" 2>&1
skey run --only STRIPE_SECRET_KEY -- npm run stripe:check > "$OUT/c1.run.out" 2>&1
cd - > /dev/null

# --- 2. Тот же запрос, но заполнение из терминала -----------------------------------
# skey fill требует живую клавиатуру, поэтому здесь запрос закрывается через ту же
# форму, а на сцене показывается вывод skey fill — строки взяты из cli.ts.
skey request "RESEND_API_KEY:Resend API key" "RESEND_AUDIENCE_ID?:Audience ID" \
  --note "For the welcome emails.
Resend → API Keys → Create API key." \
  --no-open --timeout 10 > "$OUT/c2.out" 2>&1 &
P2=$!; sleep 3
L2=$(link 'http://127.0.0.1:' "$OUT/c2.out"); T2=${L2#*t=}; B2=${L2%%/?t=*}
curl -s -H "x-skey-token: $T2" -H 'Content-Type: application/json' \
  -d '{"values":{"RESEND_API_KEY":"demo-only-resend-key-not-real","RESEND_AUDIENCE_ID":""}}' "$B2/api/request" > /dev/null
wait $P2

# --- 3. Ключ у друга: ссылка на другой компьютер ------------------------------------
skey request "SUPABASE_DB_URL:Production database URL" --share --from Alex \
  --note "Need the prod database for tomorrow's migration.
Supabase → Project Settings → Database → Connection string (URI)." \
  --timeout 10 > "$OUT/c3.out" 2>&1 &
P3=$!; sleep 4
node capture.mjs remote "$(link 'https://skey.tscodex.com/r/' "$OUT/c3.out")" "$OUT/c3" \
  '{"SUPABASE_DB_URL":"demo-only-database-url-not-a-real-connection-string-0000000000000000000000000000000000"}' Nina \
  || { echo 'capture 3 failed'; kill $P3; }
wait $P3

# --- 4. Страница ключей: всё, что пришло, в одном месте ------------------------------
BG='{"GITHUB_TOKEN":12,"VERCEL_TOKEN":40,"CLOUDFLARE_API_TOKEN":3,"AWS_ACCESS_KEY_ID":8,"AWS_SECRET_ACCESS_KEY":8,"POSTHOG_API_KEY":21,"TWILIO_AUTH_TOKEN":65}'
skey ui 0 --no-open > "$OUT/c4.out" 2>&1 &
P4=$!; sleep 2
node capture.mjs keys "$(link 'http://127.0.0.1:' "$OUT/c4.out")" "$OUT/c4" "$BG" "$(cygpath -w "$DEMO/.tscodex/skey-index.json")"   || echo 'capture 4 failed'
kill $P4 2>/dev/null

# Галерея пакета VexelKit (сам пакет сгенерирован один раз, лежит в out/cafe).
[ -f out/cafe/index.html ] && node shot.mjs out/cafe/index.html "$OUT/c0-gallery.png"

# --- уборка: демо-ключи и запросы ---------------------------------------------------
for f in c1 c2 c3; do skey clean "$(rid "$OUT/$f.out")" > /dev/null; done
skey rm GITHUB_TOKEN VERCEL_TOKEN CLOUDFLARE_API_TOKEN AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY POSTHOG_API_KEY TWILIO_AUTH_TOKEN --force > /dev/null
rm -rf "$DEMO"
ls "$OUT"
