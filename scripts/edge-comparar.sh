#!/usr/bin/env bash
# Byte-by-byte comparison between the PUBLISHED edge functions and a checkout of this repo.
# Usage: edge-comparar.sh <checkout-dir> <function> [function...]
# Needs the Supabase CLI and SUPABASE_ACCESS_TOKEN. Read-only. Exit 1 on any difference.
set -euo pipefail
repo="$(cd "$1" && pwd)"; shift
projeto="${PROJETO:-qbcsjsdwjjpybvzbxszi}"
falhou=0
for f in "$@"; do
  tmp="$(mktemp -d)"
  ( cd "$tmp" && supabase functions download "$f" --project-ref "$projeto" >/dev/null )
  n=0; dif=0
  while IFS= read -r -d '' arq; do
    rel="${arq#"$tmp"/}"
    n=$((n + 1))
    if [ ! -f "$repo/$rel" ]; then echo "  SÓ EM PRODUÇÃO  $rel"; dif=$((dif + 1)); continue; fi
    if ! cmp -s "$arq" "$repo/$rel"; then
      echo "  DIFERENTE       $rel  (produção $(sha256sum < "$arq" | cut -c1-12) × repositório $(sha256sum < "$repo/$rel" | cut -c1-12))"
      diff -u "$repo/$rel" "$arq" | head -40 || true
      dif=$((dif + 1))
    fi
  done < <(find "$tmp" -type f -print0 | sort -z)
  [ -f "$tmp/supabase/functions/$f/index.ts" ] || { echo "  download de $f não trouxe index.ts (layout inesperado):"; (cd "$tmp" && find . -type f | head -20); dif=$((dif + 1)); }
  if [ "$dif" -eq 0 ]; then echo "IGUAL      $f  ($n arquivos, byte a byte)"; else echo "DIVERGENTE $f  ($dif de $n arquivos)"; falhou=1; fi
  rm -rf "$tmp"
done
exit $falhou
