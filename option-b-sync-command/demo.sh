#!/usr/bin/env bash
# Option B end to end: a versioned package ships the BOM catalogs and a sync command.
# The consumer runs the command when it bumps the package and commits the result.
source "$(dirname "$0")/../scripts/demo-lib.sh"
setup "$ROOT/option-b-sync-command/consumer" "$ROOT/.demo/option-b"

step "Fresh clone: the synced catalog is committed, so install resolves right away"
run bun install
run bun run catalog:check

release_1_1_0

step "Bump the BOM: change the pin, sync, install"
# --no-cache: Bun caches the version list for a few minutes, and 1.1.0 is seconds old
run bun add --dev --exact --no-cache @poc/catalog@1.1.0
expect_fail bun run catalog:check
run bun run catalog:sync
run bun pm ls

step "The manifest now holds the 1.1.0 catalog"
run node -p 'JSON.stringify(require("./package.json").workspaces, null, 2)'

step "CI: a frozen install and the drift check pass on the bumped commit"
run bun install --frozen-lockfile
run bun run catalog:check

step "CI: a hand-edited catalog is rejected"
cp package.json ../option-b.package.json
sed -i '' 's/"react": "19.2.0"/"react": "19.0.0"/' package.json
expect_fail bun run catalog:check
mv ../option-b.package.json package.json

step "Done: option B works"
