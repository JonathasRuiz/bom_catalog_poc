# Option B: sync command

The BOM ships as `@poc/catalog`. The package contains the catalog and a [`catalog-sync`](../bom/packages/catalog/bin/catalog-sync.mjs) command. A consumer pins the package as an exact devDependency and adds two scripts:

```json
"scripts": {
  "catalog:sync": "catalog-sync && bun install",
  "catalog:check": "catalog-sync --check"
}
```

`catalog-sync` writes the `bom` catalog to wherever the project's package manager reads catalogs:

| Package manager | Where it writes |
|---|---|
| Bun | `workspaces.catalogs` in `package.json` |
| pnpm | `catalogs` in `pnpm-workspace.yaml` |
| Yarn | not supported yet |

It keeps the consumer's other catalogs, comments and indentation. The synced catalog is committed, so it changes together with the lockfile.

Nothing runs during install, so this works with `--ignore-scripts` and doesn't need `trustedDependencies`.

## What the demo shows

Run `./demo.sh` from this folder. It was tested with Bun 1.4.

- **A fresh clone installs on the first try,** because the catalog is committed.
- **A bump is three steps:**
  1. Pin the new version: `bun add --dev --exact @poc/catalog@1.1.0`.
  2. Run `bun run catalog:sync`.
  3. Commit `package.json` and `bun.lock`.
- **CI catches drift.** Run `bun install --frozen-lockfile` and `bun run catalog:check`. The check fails when the catalog doesn't match the pinned BOM version, whether from a skipped sync or a hand edit.

## Behaviour to know about

- **Each BOM release produces a diff in every consumer repo.** That makes each release reviewable, but you'll want automation to open those PRs. Below is an untested Renovate sketch. Self-hosted Renovate must allow these commands.

  ```json
  {
    "packageRules": [
      {
        "matchPackageNames": ["@poc/catalog"],
        "postUpgradeTasks": {
          "commands": ["bun install", "bun run catalog:sync"],
          "fileFilters": ["package.json", "bun.lock"]
        }
      }
    ]
  }
  ```

- **The sync overwrites the `bom` catalog wholesale.** To use a different version, a consumer pins that dependency directly instead of using `catalog:bom`.
- **Bun caches a package's version list for a few minutes.** Bumping to a version published seconds earlier needs `--no-cache`.
