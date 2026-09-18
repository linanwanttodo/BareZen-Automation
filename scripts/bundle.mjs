/**
 * Bundle everything the GitHub Action needs at runtime into self-contained
 * files, so a runner never has to install dependencies:
 *
 *   dist/index.js            — the action entrypoint (CLI + core)
 *   plugins/<name>/dist/index.js — one self-contained file per plugin
 *
 * Plugin entry paths match the `entry:` field each plugin.yaml already declares.
 */

import { readdirSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const ROOT = new URL("..", import.meta.url).pathname;
const TARGET = "node20";

/** @param {string} rel */
const abs = (rel) => join(ROOT, rel);

/** @returns {string[]} plugin directory names that have a TypeScript source */
function listPlugins() {
  const pluginsRoot = abs("plugins");
  return readdirSync(pluginsRoot)
    .map((name) => join(pluginsRoot, name))
    .filter((dir) => statSync(dir).isDirectory())
    .filter((dir) => existsSync(join(dir, "plugin.yaml")))
    .filter((dir) => existsSync(join(dir, "src", "index.ts")))
    .map((dir) => dir.replace(`${pluginsRoot}/`, ""));
}

/**
 * @param {{ entryPoints: string[], outfile: string, label: string }} opts
 */
async function bundle({ entryPoints, outfile, label }) {
  rmSync(dirname(abs(outfile)), { recursive: true, force: true });
  await build({
    entryPoints: entryPoints.map(abs),
    outfile: abs(outfile),
    bundle: true,
    platform: "node",
    target: TARGET,
    format: "esm",
    minify: true,
    legalComments: "none",
    logLevel: "warning",
    // CJS deps inlined into ESM output call require() for node builtins.
    banner: {
      js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
    },
  });
  console.log(`bundled ${label} -> ${outfile}`);
}

const plugins = listPlugins();

await bundle({
  entryPoints: ["packages/cli/src/bin.ts"],
  outfile: "dist/index.js",
  label: "action entrypoint",
});

for (const name of plugins) {
  await bundle({
    entryPoints: [`plugins/${name}/src/index.ts`],
    outfile: `plugins/${name}/dist/index.js`,
    label: `plugin ${name}`,
  });
}

console.log(`\n${plugins.length} plugins + 1 entrypoint bundled (target ${TARGET})`);
