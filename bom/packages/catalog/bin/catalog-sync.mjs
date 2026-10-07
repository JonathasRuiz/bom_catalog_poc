#!/usr/bin/env node
// Copies the catalogs shipped in this package into the consuming project, where its
// package manager reads them. Run it on purpose after bumping this package, then
// install, so the manifest and the lockfile change in the same commit.
// `--check` changes nothing and exits 1 if the project's catalogs have drifted.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { parseDocument } from "yaml";

const { values } = parseArgs({
  options: {
    check: { type: "boolean", default: false },
    cwd: { type: "string", default: process.cwd() },
  },
});

const readJson = (url) => JSON.parse(readFileSync(url, "utf8"));
const catalogs = readJson(new URL("../catalog.json", import.meta.url));
const { name, version } = readJson(new URL("../package.json", import.meta.url));
const source = `${name}@${version}`;

const target = detectTarget(values.cwd);
const file = relative(process.cwd(), target.file) || target.file;
const stale = Object.keys(catalogs).filter(
  (catalog) => !isDeepStrictEqual(target.current[catalog], catalogs[catalog]),
);

if (stale.length === 0) {
  console.log(`Catalogs in ${file} match ${source}.`);
} else if (values.check) {
  console.error(
    `Catalogs ${stale.join(", ")} in ${file} don't match ${source}. ` +
      `Run catalog-sync, then install.`,
  );
  process.exit(1);
} else {
  writeFileSync(target.file, target.render(stale));
  console.log(`Synced ${stale.join(", ")} from ${source} into ${file}. Install next to update the lockfile.`);
}

function detectTarget(cwd) {
  if (existsSync(join(cwd, "pnpm-workspace.yaml")) || existsSync(join(cwd, "pnpm-lock.yaml"))) {
    return pnpmTarget(join(cwd, "pnpm-workspace.yaml"));
  }
  if (existsSync(join(cwd, ".yarnrc.yml"))) {
    throw new Error("Yarn isn't supported yet. Its catalogs live in .yarnrc.yml.");
  }
  return bunTarget(join(cwd, "package.json"));
}

// pnpm reads catalogs from pnpm-workspace.yaml. Edit the YAML document in place so
// comments and the consumer's own catalogs survive.
function pnpmTarget(file) {
  const doc = parseDocument(existsSync(file) ? readFileSync(file, "utf8") : "");
  return {
    file,
    current: doc.toJS()?.catalogs ?? {},
    render(names) {
      for (const catalog of names) doc.setIn(["catalogs", catalog], doc.createNode(catalogs[catalog]));
      return doc.toString();
    },
  };
}

// Bun reads catalogs from `workspaces.catalogs` in the root package.json.
function bunTarget(file) {
  const text = readFileSync(file, "utf8");
  const manifest = JSON.parse(text);
  // Workspaces may be absent, an array of globs, or an object; normalise to object form
  const workspaces = Array.isArray(manifest.workspaces)
    ? { packages: manifest.workspaces }
    : { ...manifest.workspaces };
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? 2;
  return {
    file,
    current: workspaces.catalogs ?? {},
    render(names) {
      workspaces.catalogs = { ...workspaces.catalogs };
      for (const catalog of names) workspaces.catalogs[catalog] = catalogs[catalog];
      manifest.workspaces = workspaces;
      return JSON.stringify(manifest, null, indent) + "\n";
    },
  };
}
