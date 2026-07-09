#!/usr/bin/env bash
# pa.tel instrument liveness check — PRA-503 / PRA-513.
#
#   usage: scripts/instrument-liveness.sh
#   deps : curl only.
#   exit : 0 = exactly one instrument live   1 = none live (or both)
#          2 = page unfetchable              3 = UNKNOWN, absence not provable
#
# Run this INSTEAD OF grepping production HTML. PRA-513's Path B branch says to
# "verify in production HTML"; that check cannot detect Path B and reports a live
# pixel as missing. The two comment blocks below explain why.
#
# Answers exactly one question: which traffic instrument is COMPILED LIVE in
# production right now — Path A (Cloudflare beacon) or Path B (Bounded pixel)?
#
# Why not grep the HTML: initTrafficPixel() fires a runtime fetch() and appends
# nothing to the DOM, and early-returns unless hostname == pratik.pa.tel. The
# prerenderer renders against 127.0.0.1, so Path B can NEVER appear in the HTML.
# The only HTML artifact PR #35 adds is a static <link rel=preconnect>, which is
# unconditional and therefore matches forever. That link is a DECOY, not proof.
#
# Why the JS bundle IS a real signal: both instruments branch on
# import.meta.env.VITE_CF_BEACON_TOKEN, which Vite inlines at build time. The
# minifier dead-code-eliminates the dormant instrument ALONG WITH its collector
# URL. So the collector host surviving into a chunk means that instrument is live.
#
# Needle must be the FULL host: bare "bounded" already appears 4x in the index
# chunk as blog prose (measured 2026-07-09).

set -uo pipefail

ORIGIN="${ORIGIN:-https://pratik.pa.tel}"
PAGE="${PAGE:-/blog/agents-fail-quietly/}"
CF_HOST='static\.cloudflareinsights\.com'
BD_HOST='patel-links\.bounded\.page'

# Indirection so the test harness can drive this against fixtures.
FETCH="${FETCH:-curl -sL --fail}"

html=$($FETCH "$ORIGIN$PAGE") || { echo "FATAL: cannot fetch $ORIGIN$PAGE"; exit 2; }

# Control marker: proves we got a real article, not a 301 stub or error page.
# Without -L and the trailing slash this URL returns a 162-byte 301.
if ! grep -q 'twitter:card' <<<"$html"; then
  echo "FATAL: control marker 'twitter:card' absent -- this is not the article."
  echo "       Refusing to report on a page we cannot identify."
  exit 2
fi

chunks=$(grep -o '/assets/[A-Za-z0-9._-]*\.js' <<<"$html" | sort -u)
[ -n "$chunks" ] || { echo "FATAL: no JS chunks referenced by $PAGE"; exit 2; }

n=0; unreadable=0; cf=0; bd=0
while read -r a; do
  [ -n "$a" ] || continue
  n=$((n+1))
  js=$($FETCH "$ORIGIN$a") || { unreadable=$((unreadable+1)); continue; }
  grep -q "$CF_HOST" <<<"$js" && cf=$((cf+1))
  grep -q "$BD_HOST" <<<"$js" && bd=$((bd+1))
done <<<"$chunks"

readable=$((n-unreadable))

echo "page      : $ORIGIN$PAGE (control marker OK)"
echo "chunks    : $n referenced, $readable readable, $unreadable unreadable"
echo

# Unreadable chunks mean absence is not provable. Never report a bare "absent".
if [ "$unreadable" -gt 0 ] && [ "$cf" -eq 0 -o "$bd" -eq 0 ]; then
  echo "Path A (cf beacon)   : $( [ $cf -gt 0 ] && echo PRESENT || echo UNKNOWN )"
  echo "Path B (bounded pixel): $( [ $bd -gt 0 ] && echo PRESENT || echo UNKNOWN )"
  echo
  echo "UNKNOWN -- this is NOT 'instrument absent'. $unreadable chunk(s) unreadable."
  exit 3
fi

pa=$( [ $cf -gt 0 ] && echo "PRESENT ($cf/$readable chunks)" || echo "absent (0/$readable chunks)" )
pb=$( [ $bd -gt 0 ] && echo "PRESENT ($bd/$readable chunks)" || echo "absent (0/$readable chunks)" )
echo "Path A (cf beacon)    : $pa"
echo "Path B (bounded pixel): $pb"

# Reported separately and explicitly as NOT liveness.
if grep -q "$BD_HOST" <<<"$html"; then
  echo "preconnect <link>     : present  (means only 'PR #35 landed' -- NOT that the pixel runs)"
else
  echo "preconnect <link>     : absent   (PR #35 not merged)"
fi

echo
if [ $cf -gt 0 ] && [ $bd -gt 0 ]; then
  echo "!! BOTH LIVE -- double-count risk; PRA-503 says ship exactly one."; exit 1
elif [ $cf -eq 0 ] && [ $bd -eq 0 ]; then
  echo "NO INSTRUMENT. pa.tel is uninstrumented. The read-out cannot produce a number."; exit 1
else
  echo "Exactly one instrument is live. Good."; exit 0
fi
