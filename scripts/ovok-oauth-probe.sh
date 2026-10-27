#!/usr/bin/env bash
set -euo pipefail

API_URL="${OVOK_API_URL:-https://api.sandbox.ovok.com}"
TENANT_CODE="${OVOK_TENANT_CODE:-practice-stdi}"
CLIENT_ID="${OVOK_CLIENT_ID:-}"
CLIENT_SECRET="${OVOK_CLIENT_SECRET:-}"
TOKEN_URL="${OVOK_TOKEN_URL:-}"
SCOPE="${OVOK_SCOPE:-}"

if [ -z "$TOKEN_URL" ]; then
  echo "TOKEN_URL env is empty."
  if [ "$API_URL" = "https://api.sandbox.ovok.com" ]; then
    echo "Guessing auth host for sandbox API host..."
    TOKEN_URL="https://auth.ovok.com/oauth/token"
    echo "<- using ${TOKEN_URL}"
  fi
fi

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] || [ -z "$TOKEN_URL" ]; then
  echo "Missing auth material: need OVOK_CLIENT_ID, OVOK_CLIENT_SECRET, OVOK_TOKEN_URL"
  exit 2
fi

echo "Probe Ovok token endpoint for tenant ${TENANT_CODE}"
echo "  API_URL   = ${API_URL}"
echo "  TOKEN_URL = ${TOKEN_URL}"
echo "  CLIENT_ID = ${CLIENT_ID:0:8}…"
echo "  SCOPE     = ${SCOPE:-<not set>}"
echo

if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found on PATH"
  exit 3
fi

# Build form body carefully. Some shells/curl builds behave badly with
# --data-urlencode when SCOPE is empty, so we only add scope when nonempty.
FORM_ARGS=(
  --data-urlencode "grant_type=client_credentials"
  --data-urlencode "client_id=${CLIENT_ID}"
  --data-urlencode "client_secret=${CLIENT_SECRET}"
  --data-urlencode "tenant_code=${TENANT_CODE}"
)
if [ -n "$SCOPE" ]; then
  FORM_ARGS+=(--data-urlencode "scope=${SCOPE}")
fi

RAW=$(curl -sS --max-time 25 -w "\n__STATUS__:%{http_code}" \
  -X POST "$TOKEN_URL" \
  -H "Accept: application/json" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  "${FORM_ARGS[@]}" \
  || true)

if [ -z "$RAW" ]; then
  echo "No HTTP response body at all (network/DNS/timeout)."
  exit 1
fi

STATUS_LINE=$(printf '%s\n' "$RAW" | grep -F "__STATUS__:" || true)
if [ -z "$STATUS_LINE" ]; then
  echo "Unexpected curl output shape:"
  printf '%s\n' "$RAW"
  exit 1
fi

BODY=$(printf '%s\n' "$RAW" | sed -e '/__STATUS__:/,$d')
STATUS=$(printf '%s\n' "$STATUS_LINE" | sed 's/.*__STATUS__://')

echo "HTTP status: ${STATUS}"
echo "Response body (first 1200 chars):"
printf '%s\n' "$BODY" | head -c 1200
echo
echo "----"

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  echo "Token endpoint answered OK."
  echo "access_token present:"
  printf '%s\n' "$BODY" | grep -o '"access_token"' || echo "  no"
  echo "token_type present:"
  printf '%s\n' "$BODY" | grep -o '"token_type"' || echo "  no"
  exit 0
fi

echo "Token endpoint did not return 200/201. Inspect the body above."
exit 1
