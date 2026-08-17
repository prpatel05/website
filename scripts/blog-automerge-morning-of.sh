#!/usr/bin/env bash
# Wrapper: treat due as dateISO <= today (UTC), not tomorrow.
# Patches the comparison in-memory so the committed script can stay until the morning-of change lands.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp)"
sed 's/date_iso" > "\$TOMORROW"/date_iso" > "\$TODAY"/' "$ROOT/scripts/blog-automerge.sh" > "$TMP"
bash "$TMP"
