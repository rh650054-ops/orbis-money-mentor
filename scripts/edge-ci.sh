#!/usr/bin/env bash
# Steps of .github/workflows/edge-functions.yml. Always run from the workflow's own commit.
# Needs: SUPABASE_ACCESS_TOKEN, PROJETO_REF/NOME/ORG/REGIAO, SUPABASE_CLI, SEM_JWT, FUNCOES.
set -euo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
tmp="${RUNNER_TEMP:-/tmp}/edge"; mkdir -p "$tmp"
resumo="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

instalar_cli() {
  npm install --no-save --no-audit --no-fund --prefix "$tmp/cli" "supabase@${SUPABASE_CLI}" >/dev/null
  echo "$tmp/cli/node_modules/.bin" >> "$GITHUB_PATH"
  "$tmp/cli/node_modules/.bin/supabase" --version
}

# The token must see production, by ref + name + organization + region. Anything else stops here.
validar_projeto() {
  supabase projects list --output json > "$tmp/projetos.json"
  node "$aqui/edge-functions.mjs" projeto --lista "$tmp/projetos.json" | tee -a "$resumo"
}

# $1 = file to write. Version, JWT gate and bundle hash of each function as published now.
estado() {
  supabase functions list --project-ref "$PROJETO_REF" --output json > "$tmp/funcoes.json"
  node "$aqui/edge-functions.mjs" estado --lista "$tmp/funcoes.json" --funcoes "$FUNCOES" --json "$1"
}

# $1 = checkout to compare with. Downloads every function and compares both ways. 0 only if all equal.
baixar_e_comparar() {
  local contra="$1" pior=0
  rm -rf "$tmp/baixado" "$tmp/comparacao"; mkdir -p "$tmp/comparacao"
  for f in $FUNCOES; do
    local d="$tmp/baixado/$f"; mkdir -p "$d"
    if ! ( cd "$d" && supabase functions download "$f" --project-ref "$PROJETO_REF" ) > "$tmp/download-$f.log" 2>&1; then
      rm -rf "$d"; mkdir -p "$d"
      if ! ( cd "$d" && supabase functions download "$f" --project-ref "$PROJETO_REF" --use-api ) >> "$tmp/download-$f.log" 2>&1; then
        echo "DOWNLOAD FALHOU  $f"; tail -20 "$tmp/download-$f.log"; supabase functions download --help | head -30; pior=2; continue
      fi
    fi
    local rc=0
    node "$aqui/edge-functions.mjs" comparar --repo "$contra" --baixado "$d" --funcao "$f" --json "$tmp/comparacao/$f.json" | tee "$tmp/comparacao/$f.txt" || rc=$?
    [ "$rc" -eq 0 ] || { echo "  arquivos baixados:"; ( cd "$d" && find . -type f | sort | head -30 ); }
    [ "$rc" -gt "$pior" ] && pior=$rc
  done
  { echo; echo '```'; cat "$tmp"/comparacao/*.txt 2>/dev/null; echo '```'; } >> "$resumo"
  return "$pior"
}

"$@"
