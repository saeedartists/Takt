#!/usr/bin/env bash
set -euo pipefail
# Diagnose the server-side Ovok backend wiring for Takt's server bots/scripts.
# Reads values from server/.env WITHOUT printing secrets.

ENV="${1:-server/.env}"

if [ ! -f "$ENV" ]; then
  echo "FAIL: missing $ENV"
  exit 1
fi

echo "=== server-side Ovok config: $ENV ==="
echo "--- core ovok keys present in file (value shape only, no secrets) ---"
awk -F= '/^[A-Z_]/ && !/^#/ {
  v=$2
  if(v=="") v="<empty>";
  else if(length(v)>0) v="<set>";
  print $1" = "v
}' "$ENV" | sort -u

echo
echo "--- server-side auth readiness (what server scripts need) ---"
need() {
  v=$(awk -F= -v k="$1" '$1==k && !/^#/ {print $2}' "$ENV")
  if [ -z "$v" ]; then
    echo "$1 = MISSING"
  else
    echo "$1 = <set>"
  fi
}
need OVOK_CLIENT_ID
need OVOK_CLIENT_SECRET
need OVOK_TOKEN_URL
need OVOK_ACCESS_TOKEN
need OVOK_TENANT_CODE
need OVOK_API_URL

echo
echo "--- URL shape checks (no secrets printed) ---"
for k in OVOK_API_URL OVOK_TOKEN_URL; do
  v=$(awk -F= -v k="$k" '$1==k && !/^#/ {print $2}' "$ENV")
  if [ -z "$v" ]; then
    echo "$k = <empty>"
  else
    if echo "$v" | grep -qE '^https?://'; then
      echo "$k = <valid http(s) URL>"
    else
      echo "$k = <looks wrong: $v>"
    fi
  fi
done

echo
echo "--- tenant code value shape ---"
tenant=$(awk -F= '/^OVOK_TENANT_CODE/ && !/^#/ {print $2}' "$ENV")
if [ -z "$tenant" ]; then
  echo "OVOK_TENANT_CODE = <empty> (required by server config)"
else
  echo "OVOK_TENANT_CODE = <non-empty: $tenant>"
fi

echo
echo "--- next verification step ---"
echo "Run from server/:"
echo "  npx tsx scripts/verify-tenant.ts"
echo "It will fail until either OVOK_ACCESS_TOKEN is set, OR all three of"
echo "OVOK_CLIENT_ID + OVOK_CLIENT_SECRET + OVOK_TOKEN_URL are set."
