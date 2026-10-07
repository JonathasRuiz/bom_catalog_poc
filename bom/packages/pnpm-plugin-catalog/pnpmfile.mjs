// pnpm loads this file before resolving dependencies, because the package is a config
// dependency named `pnpm-plugin-*`. It adds the BOM catalogs to pnpm's config, so
// consumers can depend on `catalog:bom` without copying the catalog into their repo.
import { readFileSync } from "node:fs";

const catalogs = JSON.parse(readFileSync(new URL("./catalog.json", import.meta.url), "utf8"));

export const hooks = {
  updateConfig(config) {
    config.catalogs ??= {};
    for (const [name, entries] of Object.entries(catalogs)) {
      config.catalogs[name] = { ...entries };
    }
    return config;
  },
};
