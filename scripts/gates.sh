#!/bin/sh
# Usage: sh scripts/gates.sh source | dist
# The source rules need ripgrep (rg). The dist checks read web/dist after a build.
# Each g() call is one rule: a label, then rg arguments. A match fails the run,
# and so does an rg error such as a bad pattern.
set -u
cd "$(dirname "$0")/.."
fail=0

g() {
  label=$1
  shift
  out=$(rg -n "$@" 2>&1)
  case $? in
    0) printf 'gate: %s\n%s\n\n' "$label" "$out"; fail=1 ;;
    1) ;;
    *) printf 'gate error: %s\n%s\n\n' "$label" "$out"; fail=1 ;;
  esac
}

case ${1:-} in
  source)
    g 'href="#" placeholder' -P "href\\s*=\\s*['\"]#['\"]" web/src -g '!**/pages/styleguide.astro'
    # This rule and the next enforce the client script style rules in
    # docs/astroload/security.md. Both read one line at a time, so a call or a
    # template literal split over two lines passes.
    g 'style written at run time' -P \
      "\\.cssText\\s*\\+?=(?!=)|setAttribute\\s*\\(\\s*['\"]style['\"]|createElement\\s*\\(\\s*['\"]style['\"]" \
      web/src -g '*.{js,ts,tsx,astro}'
    g 'style in an HTML string' -P "['\"\`][^'\"\`]*(<style\\b|\\sstyle=)" web/src -g '*.{js,ts}'
    ;;
  dist)
    node scripts/locale-prefix.mjs web/dist || fail=1
    node scripts/links.mjs web/dist/client || fail=1
    ;;
  *)
    echo 'usage: sh scripts/gates.sh source | dist' >&2
    exit 2
    ;;
esac

exit $fail
