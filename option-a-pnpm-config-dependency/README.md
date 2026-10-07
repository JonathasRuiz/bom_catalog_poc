# Option A: pnpm config dependency

The BOM ships as `@poc/pnpm-plugin-catalog`. A consumer pins it under `configDependencies` in `pnpm-workspace.yaml`:

```yaml
configDependencies:
  "@poc/pnpm-plugin-catalog": 1.0.0
```

pnpm installs config dependencies before it resolves anything else. Because the package name matches `pnpm-plugin-*`, pnpm also loads its [`pnpmfile.mjs`](../bom/packages/pnpm-plugin-catalog/pnpmfile.mjs). That file's `updateConfig` hook adds the `bom` catalog to pnpm's config. The consumer then depends on `catalog:bom`, and its repo never holds a copy of the catalog.

## What the demo shows

Run `./demo.sh` from this folder. It needs pnpm 10.8 or later, and was tested with pnpm 11.21.

- **A fresh clone installs on the first try.** It has no catalog entries, only the pinned plugin.
- **A bump is one pin change and one install.** Run `pnpm add --config @poc/pnpm-plugin-catalog@1.1.0`, then `pnpm install`.
- **The lockfile records everything an install depends on:** the plugin's integrity hash, the catalog it supplied, and a `pnpmfileChecksum`.
- **CI rejects a half-done bump.** If the pin is edited but the lockfile isn't updated, `pnpm install --frozen-lockfile` fails.

## Behaviour to know about

- **The plugin's catalog always wins.** If a consumer also defines `catalogs.bom` in `pnpm-workspace.yaml`, pnpm ignores it. To use a different version, a consumer pins that dependency directly instead of using `catalog:bom`.
- **A config dependency can't have dependencies.** The plugin has to ship its catalog inside its own tarball.
- **Some pnpm commands don't load the plugin.**
  - `pnpm pack` and `pnpm publish` ignore `updateConfig` catalogs before pnpm 12.3 ([pnpm#14377](https://github.com/pnpm/pnpm/issues/14377)).
  - `pnpm peers check` ignores them ([pnpm#15047](https://github.com/pnpm/pnpm/issues/15047)).

  This matters for consumers that publish libraries.
- **Pinning pnpm 12 through `packageManager` failed here.** pnpm 11.21 fetched a pnpm 12.9.1 build that Node couldn't run, so this consumer doesn't pin a pnpm version.
- **Renovate support is untested.** It's unclear whether Renovate bumps `configDependencies`.
