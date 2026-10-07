# Catalogs

A sandbox for sharing one set of dependency versions across separate projects with [Bun catalogs](https://bun.com/docs/install/catalogs).


NB: This proof-of-concept only works with Bun. The final version of this implementation will write the catalog where each package manager reads it: `catalogs` in `pnpm-workspace.yaml` for pnpm, and `workspaces.catalogs` in the root `package.json` for Bun.

## Why

A Bun workspace root can declare dependency versions once under `workspaces.catalogs`. Packages then ask for `catalog:<name>` instead of pinning their own versions. That works inside one monorepo. This solution doesn't work across multiple repositories, because Bun only reads catalogs from the workspace root's `package.json`.

This project tries a workaround: 
- The `catalog` package owns the Catalog. 
- A script copies that catalog into a destination project's `package.json`, so the destination can use `catalog:my-catalog` and get the central versions.

In the final implementation, the catalog injection script will likely be called in a post-install hook so that the catalog is updated whenever the consumer installs a new version of the catalog package. 

For this proof-of-concept, we run the injection script manually (see the Structure section for a breakdown of how the script works).

Bun skips dependency postinstall scripts by default, so each consuming project will need to list the catalog package in `trustedDependencies` or will have to run the injection script manually after install.

## Structure

```
.
├── catalog/                 # Source of truth for shared dependency versions
│   ├── package.json         # Defines workspaces.catalogs["my-catalog"]
│   └── inject-catalog.js    # Copies my-catalog into a destination package.json
└── consumer/                # Example project that receives the catalog
    └── package.json         # Target of the injection
```

### `catalog/`

Its `package.json` defines the canonical catalog under `workspaces.catalogs["my-catalog"]`. It also depends on `react` through `catalog:my-catalog`, which checks that the catalog resolves in its own install.

### `catalog/inject-catalog.js`

The script reads `my-catalog` from `catalog/package.json` and writes it to the destination's `workspaces.catalogs["my-catalog"]`.

- `--destinationPackagePath` takes a path to to `package.json`.
- It writes only `workspaces.catalogs["my-catalog"]` and keeps the rest of the destination's workspace config, other catalogs included.
- If the destination project does not define a workspace (i.e. is not a monorepo), it defines an empty workspace, and injects the catalog there.
- It doesn't add `catalog:` references to the destination's dependencies, and it doesn't run `bun install`. It is up to users of the destination project to point to the catalog versions they care about.

```sh
cd catalog
bun inject-catalog.js --destinationPackagePath ../consumer/package.json
```


### `consumer/`

A standalone Bun project that receives the injected `my-catalog` catalog.

## Alternatives to the postinstall script

A postinstall script runs after the package manager has resolved dependencies, so it is too late to supply a catalog:

- **A fresh project can't install.** Until the catalog is injected, `catalog:my-catalog` can't resolve, so the install fails before the catalog package and its script are downloaded.
- **A bump leaves the lockfile stale.** The install resolves against the old catalog, and the script rewrites `package.json` afterwards. The project needs a second install, and `--frozen-lockfile` fails until that lockfile is committed.

Two alternatives are prototyped side by side. Both get the BOM from a versioned package on a local registry:

```
.
├── bom/
│   ├── catalog.json                  # Single source of truth, exact versions
│   └── packages/
│       ├── pnpm-plugin-catalog/      # Option A: @poc/pnpm-plugin-catalog
│       └── catalog/                  # Option B: @poc/catalog, ships the catalog-sync command
├── option-a-pnpm-config-dependency/  # pnpm consumer, plus demo.sh
├── option-b-sync-command/            # Bun consumer, plus demo.sh
├── registry/                         # Verdaccio config for the local registry
└── scripts/                          # Registry control, publishing, demo helpers
```

| | Postinstall (above) | [A: pnpm config dependency](option-a-pnpm-config-dependency/README.md) | [B: sync command](option-b-sync-command/README.md) |
|---|---|---|---|
| Package managers | Bun | pnpm 10.8+ | Bun, pnpm (Yarn not yet) |
| Catalog copied into the consumer repo | Yes | No | Yes, committed |
| Fresh clone installs | Only if the catalog is already committed | Yes | Yes |
| Steps to bump the BOM | Bump, install, install again | Change the pin, install | Change the pin, `catalog:sync` |
| Needs dependency install scripts | Yes | No | No |
| CI catches drift | No | Yes, through `--frozen-lockfile` | Yes, through `catalog:check` and `--frozen-lockfile` |

Run a demo. Each demo resets the local registry, publishes BOM 1.0.0, installs a working copy of the consumer under `.demo/`, releases BOM 1.1.0, and bumps the consumer to it:

```sh
option-a-pnpm-config-dependency/demo.sh
option-b-sync-command/demo.sh
scripts/registry.sh stop   # When you're done
```

The demos need Node, `npx` (to run Verdaccio), and Bun or pnpm.
