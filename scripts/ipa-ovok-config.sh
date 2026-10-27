#!/usr/bin/env bash
set -euo pipefail

# Diagnose what live/Ovok config the current iOS app is actually shipping.
# Works on both the old 10/07 IPA and the new 10/27 export-local IPA.

IPA="${1:-build-artifacts/export-local/TaktHealth.ipa}"
TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

unzip -o -q "$IPA" -d "$TMPDIR" >/dev/null 2>&1 || { echo "FAIL: cannot unzip $IPA"; exit 1; }

BUNDLE="$TMPDIR/Payload/TaktHealth.app/main.jsbundle"
APPCONFIG="$TMPDIR/Payload/TaktHealth.app/EXConstants.bundle/app.config"

echo "=== IPA: $IPA ==="
echo "--- app.config (EAS metadata) ---"
if [ -f "$APPCONFIG" ]; then
  python3 - <<'PY' "$APPCONFIG"
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
eas = d.get("extra", {}).get("eas", {})
print("extra.eas:", eas)
print("runtimeVersion:", d.get("runtimeVersion"))
print("owner:", d.get("owner"))
PY
else
  echo "(no app.config found in IPA)"
fi

echo
echo "--- baked JS strings (grep main.jsbundle) ---"
if [ -f "$BUNDLE" ]; then
  grep -aoE 'api\.ovok\.com|practice-stdi|sandbox\.ovok\.com|EXPO_PUBLIC_OVOK_[A-Z_]+' "$BUNDLE" \
    | sort | uniq -c | sort -rn
else
  echo "(no main.jsbundle found in IPA)"
fi

echo
echo "--- env.ts-derived constants present in bundle ---"
for token in "https://api.ovok.com" "https://api.sandbox.ovok.com" "practice-stdi" "mock" "EXPO_PUBLIC_OVOK_MOCK"; do
  count=$(grep -aco "$token" "$BUNDLE" 2>/dev/null || true)
  printf '%-32s -> %s occurrence(s)\n' "$token" "${count:-0}"
done
