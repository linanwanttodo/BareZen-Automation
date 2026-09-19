import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginLoader, createPluginRegistry } from "@barezen/core";
import { describe, expect, it } from "vitest";
import {
  loadPluginsFromDirs,
  resolveLogLevel,
  resolvePluginDirs,
  splitPluginDirs,
} from "./run.js";

function writeEchoPlugin(root: string, name: string, value: string): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "plugin.yaml"),
    `name: ${name}
runtime: shell
entry: entry.sh
inputs: {}
outputs:
  result:
    type: string
`,
  );
  writeFileSync(
    join(dir, "entry.sh"),
    `#!/bin/bash
cat > /dev/null
echo '{"success": true, "data": {"result": "${value}"}}'
`,
  );
  chmodSync(join(dir, "entry.sh"), 0o755);
  return dir;
}

describe("splitPluginDirs", () => {
  it("splits comma-separated roots and trims whitespace", () => {
    expect(splitPluginDirs("  a , b ,, c ")).toEqual(["a", "b", "c"]);
  });

  it("returns a single root unchanged", () => {
    expect(splitPluginDirs("plugins")).toEqual(["plugins"]);
  });
});

describe("loadPluginsFromDirs", () => {
  it("lets later roots override earlier ones by plugin name", () => {
    const root = join(tmpdir(), `barezen-cli-prev-${Date.now()}`);
    const builtinRoot = join(root, "builtin");
    const localRoot = join(root, "local");
    writeEchoPlugin(builtinRoot, "rss", "builtin");
    writeEchoPlugin(localRoot, "rss", "local");

    const registry = createPluginRegistry();
    const loader = createPluginLoader(undefined, undefined);
    const count = loadPluginsFromDirs([builtinRoot, localRoot], registry, loader);

    expect(count).toBe(1);
    expect(registry.get("rss")?.dirPath).toBe(join(localRoot, "rss"));
  });

  it("unions plugins across roots", () => {
    const root = join(tmpdir(), `barezen-cli-union-${Date.now()}`);
    const builtinRoot = join(root, "builtin");
    const localRoot = join(root, "local");
    writeEchoPlugin(builtinRoot, "rss", "builtin");
    writeEchoPlugin(localRoot, "notify", "local");

    const registry = createPluginRegistry();
    const loader = createPluginLoader(undefined, undefined);
    const count = loadPluginsFromDirs([builtinRoot, localRoot], registry, loader);

    expect(count).toBe(2);
    expect(registry.has("rss")).toBe(true);
    expect(registry.has("notify")).toBe(true);
  });

  it("ignores roots that do not exist", () => {
    const root = join(tmpdir(), `barezen-cli-missing-${Date.now()}`);
    const builtinRoot = join(root, "builtin");
    writeEchoPlugin(builtinRoot, "rss", "builtin");

    const registry = createPluginRegistry();
    const loader = createPluginLoader(undefined, undefined);
    const count = loadPluginsFromDirs(
      [builtinRoot, join(root, "does-not-exist")],
      registry,
      loader,
    );

    expect(count).toBe(1);
  });
});

describe("resolveLogLevel", () => {
  it("prefers an explicit CLI level", () => {
    expect(resolveLogLevel("debug", "warn")).toBe("debug");
  });

  it("treats an empty CLI level as unset", () => {
    expect(resolveLogLevel("", "warn")).toBe("warn");
  });

  it("falls back to info", () => {
    expect(resolveLogLevel(undefined, undefined)).toBe("info");
  });
});

describe("resolvePluginDirs", () => {
  it("appends the config's pluginDir as the highest precedence root", () => {
    expect(resolvePluginDirs("a,b", "cfg")).toEqual(["a", "b", "cfg"]);
  });

  it("uses the default root when nothing is supplied", () => {
    expect(resolvePluginDirs(undefined, undefined)).toEqual(["plugins"]);
  });

  it("ignores an empty pluginDir", () => {
    expect(resolvePluginDirs("plugins", "")).toEqual(["plugins"]);
  });
});
