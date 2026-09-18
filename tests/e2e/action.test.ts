/**
 * Action end-to-end tests.
 *
 * The action must be self-contained: everything it runs is committed as a
 * bundle, so a consumer's runner never installs a dependency.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const ACTION_PATH = join(PROJECT_ROOT, "action.yml");
const actionYml = readFileSync(ACTION_PATH, "utf8");

function pluginDirs(): string[] {
  const root = join(PROJECT_ROOT, "plugins");
  return readdirSync(root).filter((name) =>
    existsSync(join(root, name, "plugin.yaml")),
  );
}

describe("action.yml contract", () => {
  it("is a composite action exposing the documented inputs", () => {
    expect(actionYml).toContain("using: composite");
    for (const input of [
      "config:",
      "flow:",
      "plugins:",
      "log-level:",
      "python-version:",
    ]) {
      expect(actionYml).toContain(input);
    }
  });

  it("runs the committed bundle directly", () => {
    expect(actionYml).toContain(`"$BZ_ACTION_PATH/dist/index.js"`);
    expect(actionYml).toContain("github.action_path");
  });

  it("installs nothing to run the framework", () => {
    expect(actionYml).not.toContain("npm install");
    expect(actionYml).not.toContain("pnpm");
  });

  it("scans the bundled plugins before the caller's own", () => {
    expect(actionYml).toContain(`roots="$BZ_ACTION_PATH/plugins"`);
    expect(actionYml).toContain(`roots="$roots,$BZ_PLUGINS"`);
  });

  it("passes inputs through env instead of shell interpolation", () => {
    expect(actionYml).toContain("BZ_CONFIG: ${{ inputs.config }}");
    expect(actionYml).not.toContain('--config "${{ inputs.config }}"');
  });

  it("keeps Python setup opt-in", () => {
    expect(actionYml).toContain("actions/setup-python@v5");
    expect(actionYml).toContain("inputs.python-version != ''");
  });
});

describe("bundled artifacts", () => {
  it("ships an action entrypoint", () => {
    expect(existsSync(join(PROJECT_ROOT, "dist", "index.js"))).toBe(true);
  });

  it("ships the file every plugin.yaml points at", () => {
    const missing: string[] = [];
    for (const name of pluginDirs()) {
      const dir = join(PROJECT_ROOT, "plugins", name);
      const manifest = parseYaml(
        readFileSync(join(dir, "plugin.yaml"), "utf8"),
      ) as { entry?: string; runtime?: string };
      if (manifest.runtime !== "node") continue;
      if (manifest.entry === undefined) {
        missing.push(`${name}: no entry declared`);
      } else if (!existsSync(join(dir, manifest.entry))) {
        missing.push(`${name}: ${manifest.entry}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("ships plugin bundles that inline their dependencies", () => {
    const leaking: string[] = [];
    for (const name of pluginDirs()) {
      const bundle = join(PROJECT_ROOT, "plugins", name, "dist", "index.js");
      if (!existsSync(bundle)) continue;
      const source = readFileSync(bundle, "utf8");
      if (source.includes('from "zod"') || source.includes('from "@barezen/sdk"')) {
        leaking.push(name);
      }
    }
    expect(leaking).toEqual([]);
  });
});
