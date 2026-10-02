#!/bin/sh
# Run every check; prints each file's output. Usage: sh tests/run.sh
cd "$(dirname "$0")" || exit 1
status=0
for f in *.mjs; do
  case "$f" in qrdump*|*-lib.mjs) continue ;; esac
  echo "=== $f"; node "$f" || status=1
done
for f in *.py; do echo "=== $f"; python3 "$f" || status=1; done
exit $status
