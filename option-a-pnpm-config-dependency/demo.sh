#!/usr/bin/env bash
# Option A end to end: pnpm loads the BOM catalogs from a config dependency
# before resolving, so the consumer's repo never holds a copy of the catalog.
source "$(dirname "$0")/../scripts/demo-lib.sh"
setup "$ROOT/option-a-pnpm-config-dependency/consumer" "$ROOT/.demo/option-a"
export npm_config_update_notifier=false

step "Fresh clone: the repo pins the plugin version, and has no catalog entries"
run cat pnpm-workspace.yaml
run pnpm install
run pnpm list --depth 0

release_1_1_0

step "Bump the BOM: change the pin, then install once"
run pnpm add --config @poc/pnpm-plugin-catalog@1.1.0
run pnpm install
run pnpm list --depth 0

step "The lockfile records the catalog the plugin supplied"
run sed -n '/^catalogs:/,/^$/p' pnpm-lock.yaml

step "CI: a frozen install passes on the bumped commit"
run pnpm install --frozen-lockfile

step "CI: a half-done bump (pin edited, lockfile not updated) is rejected"
cp pnpm-lock.yaml ../option-a.lock
sed -i.bak 's/1.1.0/1.0.0/' pnpm-workspace.yaml
expect_fail pnpm install --frozen-lockfile
mv pnpm-workspace.yaml.bak pnpm-workspace.yaml
mv ../option-a.lock pnpm-lock.yaml

step "Done: option A works"
