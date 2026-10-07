# Shared helpers for the option demos. Source it; don't run it.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The demo republishes the same versions after each registry reset, so keep Bun's cache
# private to the demo; otherwise Bun reuses a stale tarball for @poc/catalog@1.0.0.
export BUN_INSTALL_CACHE_DIR="$ROOT/.demo/bun-cache"

step() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
run() { printf '\033[2m$ %s\033[0m\n' "$*"; "$@"; }

# Runs a command that must fail, and stops the demo if it succeeds.
expect_fail() {
  printf '\033[2m$ %s   (expected to fail)\033[0m\n' "$*"
  if "$@"; then echo "Expected failure, but it succeeded." >&2; exit 1; fi
}

# Starts a clean registry with BOM 1.0.0, and copies the consumer template into a
# throwaway working copy under .demo/ that stands in for a consumer's repo.
setup() {
  local template="$1" work="$2"
  step "Start a clean local registry and publish BOM 1.0.0 (react 19.1.0)"
  "$ROOT/scripts/registry.sh" reset
  node "$ROOT/scripts/publish-bom.mjs" 1.0.0
  rm -rf "$work" "$BUN_INSTALL_CACHE_DIR"
  mkdir -p "$(dirname "$work")"
  cp -R "$template" "$work"
  cd "$work"
}

release_1_1_0() {
  step "The platform team releases BOM 1.1.0 (react 19.2.0)"
  node "$ROOT/scripts/publish-bom.mjs" 1.1.0 react@19.2.0 react-dom@19.2.0
}
