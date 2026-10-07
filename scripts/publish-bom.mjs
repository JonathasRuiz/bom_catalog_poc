#!/usr/bin/env node
// Publishes both BOM packages to the local registry, built from bom/catalog.json.
// Usage: node scripts/publish-bom.mjs <version> [name@version ...]
// Extra arguments override catalog entries for this release only, e.g. react@19.2.0,
// so the demos can ship a newer BOM without editing bom/catalog.json.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const ROOT = new URL("..", import.meta.url).pathname;
const REGISTRY = process.env.REGISTRY ?? "http://localhost:4873/";
const PACKAGES = ["catalog", "pnpm-plugin-catalog"];

const {
  positionals: [version, ...overrides],
} = parseArgs({ allowPositionals: true });
if (!version) {
  console.error("Usage: node scripts/publish-bom.mjs <version> [name@version ...]");
  process.exit(1);
}

const catalogs = JSON.parse(readFileSync(join(ROOT, "bom/catalog.json"), "utf8"));
for (const override of overrides) {
  const at = override.lastIndexOf("@");
  const [dependency, range] = [override.slice(0, at), override.slice(at + 1)];
  const owners = Object.values(catalogs).filter((entries) => dependency in entries);
  if (at <= 0 || owners.length === 0) throw new Error(`"${override}" doesn't match a catalog entry.`);
  for (const entries of owners) entries[dependency] = range;
}

const npmrc = join(ROOT, ".demo/npmrc");
mkdirSync(join(ROOT, ".demo"), { recursive: true });
writeFileSync(npmrc, `//${new URL(REGISTRY).host}/:_authToken=${await login()}\n`);

for (const pkg of PACKAGES) {
  const stage = join(ROOT, ".demo/stage", pkg);
  rmSync(stage, { recursive: true, force: true });
  cpSync(join(ROOT, "bom/packages", pkg), stage, { recursive: true });

  const manifestPath = join(stage, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(join(stage, "catalog.json"), JSON.stringify(catalogs, null, 2) + "\n");

  execFileSync("npm", ["publish", "--registry", REGISTRY, "--userconfig", npmrc, "--loglevel", "error"], {
    cwd: stage,
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log(`Published ${manifest.name}@${version}`);
}

// Verdaccio creates the user on first login and returns a token either way.
async function login() {
  const response = await fetch(new URL("-/user/org.couchdb.user:poc", REGISTRY), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from("poc:poc").toString("base64")}`,
    },
    body: JSON.stringify({ name: "poc", password: "poc" }),
  });
  const { token } = await response.json();
  if (!token) throw new Error(`Couldn't log in to ${REGISTRY} (HTTP ${response.status}).`);
  return token;
}
