#!/usr/bin/env bash
# Verificação de segurança do IG Video Controller.
#
# Uso:
#   scripts/check-security.sh            # verifica a pasta (e o zip, se existir)
#   scripts/check-security.sh <arq.zip>  # verifica a pasta e o zip indicado
#
# Sai com código != 0 se qualquer regra for violada.
# Dependências: bash, grep e Python 3 (somente biblioteca padrão).

set -u
export PYTHONIOENCODING=utf-8

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP="${1:-$ROOT/ig-video-controller.zip}"
FAIL=0

fail() { echo "FALHA: $*"; FAIL=1; }
ok()   { echo "ok:    $*"; }

# --- Python 3 (stdlib) -------------------------------------------------------
PY=""
for cand in python3 python; do
  if command -v "$cand" >/dev/null 2>&1 &&
     "$cand" -I -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    PY="$cand"; break
  fi
done
if [ -z "$PY" ]; then
  echo "ERRO: Python 3 não encontrado (necessário para validar JSON e zip)."
  exit 2
fi

# --- Termos proibidos em content.js ------------------------------------------
FORBIDDEN_JS=(
  "fetch" "XMLHttpRequest" "WebSocket" "EventSource" "sendBeacon"
  "import(" "eval(" "new Function" "innerHTML" "outerHTML"
  "insertAdjacentHTML" "document.write" "document.cookie" "localStorage"
  "sessionStorage" "indexedDB" "chrome.runtime" "chrome.storage"
  "postMessage" "console."
)

# Padrões adicionais (regex estendida) da seção 2.2.
FORBIDDEN_JS_RE=(
  'set(Timeout|Interval)[[:space:]]*\([[:space:]]*["'"'"'`]'   # timer com string
  'createElement[[:space:]]*\([[:space:]]*["'"'"'`](script|img|iframe|link|object|embed|frame|source|audio|video)["'"'"'`]'
  '\.(src|href|srcdoc)[[:space:]]*='                          # atribuição de src/href
  'setAttribute[[:space:]]*\([[:space:]]*["'"'"'`](src|href|srcdoc)'
  '(^|[^A-Za-z0-9_.])Function[[:space:]]*\('                  # Function(...)
  'importScripts'
  '\bworld\b'
  'chrome\.'                                                  # nenhuma API chrome.*
)

check_js() {
  local file="$1" label="$2" term
  if [ ! -f "$file" ]; then fail "$label: arquivo ausente"; return; fi
  for term in "${FORBIDDEN_JS[@]}"; do
    if grep -nF -- "$term" "$file" >/dev/null; then
      fail "$label contém termo proibido: '$term'"
      grep -nF -- "$term" "$file" | sed 's/^/         /'
    fi
  done
  for term in "${FORBIDDEN_JS_RE[@]}"; do
    if grep -nE -- "$term" "$file" >/dev/null; then
      fail "$label contém padrão proibido: /$term/"
      grep -nE -- "$term" "$file" | sed 's/^/         /'
    fi
  done
}

# --- Manifest ----------------------------------------------------------------
FORBIDDEN_MANIFEST=(
  "permissions" "optional_permissions" "host_permissions" "background"
  "action" "web_accessible_resources" "externally_connectable"
  "options_page" '"MAIN"'
)

check_manifest() {
  local file="$1" label="$2" term
  if [ ! -f "$file" ]; then fail "$label: arquivo ausente"; return; fi
  for term in "${FORBIDDEN_MANIFEST[@]}"; do
    if grep -nF -- "$term" "$file" >/dev/null; then
      fail "$label contém termo proibido: $term"
    fi
  done
  # Validação estrutural.
  local out
  if ! out="$("$PY" -I - "$file" <<'PYEOF'
import json, sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    m = json.load(f)

errors = []
FORBIDDEN_KEYS = {
    "permissions", "optional_permissions", "host_permissions", "background",
    "action", "browser_action", "page_action", "options_page", "options_ui",
    "web_accessible_resources", "externally_connectable", "devtools_page",
    "chrome_url_overrides", "side_panel", "sandbox", "declarative_net_request",
    "oauth2", "key", "update_url", "world",
}

def walk(node, where):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in FORBIDDEN_KEYS:
                errors.append(f"chave proibida '{k}' em {where}")
            walk(v, f"{where}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, f"{where}[{i}]")
    elif node == "MAIN":
        errors.append(f"valor 'MAIN' em {where}")

walk(m, "manifest")

if m.get("manifest_version") != 3:
    errors.append("manifest_version deve ser 3")

cs = m.get("content_scripts")
if not isinstance(cs, list) or len(cs) != 1:
    errors.append("deve haver exatamente um content_script")
else:
    s = cs[0]
    if s.get("matches") != ["https://www.instagram.com/*"]:
        errors.append(f"matches inválido: {s.get('matches')!r}")
    if s.get("js") != ["content.js"]:
        errors.append(f"js inválido: {s.get('js')!r}")
    if s.get("all_frames") is not False:
        errors.append("all_frames deve ser false")
    if s.get("run_at") != "document_idle":
        errors.append("run_at deve ser document_idle")
    extra = set(s) - {"matches", "js", "run_at", "all_frames"}
    if extra:
        errors.append(f"chaves inesperadas em content_scripts: {sorted(extra)}")

allowed_top = {
    "manifest_version", "name", "version", "description",
    "content_scripts", "content_security_policy", "icons",
}
extra_top = set(m) - allowed_top
if extra_top:
    errors.append(f"chaves de topo inesperadas: {sorted(extra_top)}")

csp = (m.get("content_security_policy") or {}).get("extension_pages", "")
for directive in ("script-src 'self'", "object-src 'none'", "connect-src 'none'"):
    if directive not in csp:
        errors.append(f"CSP sem '{directive}'")

for e in errors:
    print(e)
sys.exit(1 if errors else 0)
PYEOF
)"; then
    fail "$label: validação estrutural"
    echo "$out" | sed 's/^/         /'
  fi
}

check_tree() {
  local dir="$1" label="$2"
  local before=$FAIL
  FAIL=0
  check_manifest "$dir/manifest.json" "$label/manifest.json"
  check_js "$dir/content.js" "$label/content.js"
  for s in 16 48 128; do
    [ -f "$dir/icons/$s.png" ] || fail "$label/icons/$s.png ausente"
  done
  [ $FAIL -eq 0 ] && ok "$label: manifest, content.js e ícones aprovados"
  FAIL=$(( before | FAIL ))
}

# --- Pasta -------------------------------------------------------------------
echo "== Verificando pasta: $ROOT"
check_tree "$ROOT" "pasta"

# --- Zip ---------------------------------------------------------------------
if [ -f "$ZIP" ]; then
  echo "== Verificando zip: $ZIP"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  if out="$("$PY" -I - "$ZIP" "$TMP" <<'PYEOF'
import re, sys, zipfile

zpath, dest = sys.argv[1], sys.argv[2]
allowed = re.compile(r"^(manifest\.json|content\.js|icons/|icons/[A-Za-z0-9_-]+\.png)$")
errors = []
with zipfile.ZipFile(zpath) as z:
    names = z.namelist()
    for n in names:
        if not allowed.match(n):
            errors.append(f"arquivo não permitido no zip: {n}")
    for required in ("manifest.json", "content.js"):
        if required not in names:
            errors.append(f"zip sem {required}")
    if not errors:
        z.extractall(dest)  # nomes já validados pela whitelist acima
for e in errors:
    print(e)
sys.exit(1 if errors else 0)
PYEOF
)"; then
    ok "zip: contém somente manifest.json, content.js e icons/*"
    check_tree "$TMP" "zip"
  else
    fail "zip: conteúdo inválido"
    echo "$out" | sed 's/^/         /'
  fi
else
  echo "== Zip não encontrado ($ZIP) — verificação do zip ignorada."
fi

echo
if [ $FAIL -ne 0 ]; then
  echo "RESULTADO: REPROVADO"
  exit 1
fi
echo "RESULTADO: APROVADO"
exit 0
