/**
 * T-TEST-03: Plugin Loader + Runtime Manager integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginLoader } from "../../src/plugin/loader.js";
import { createPluginRegistry } from "../../src/plugin/registry.js";
import { createRuntimeManager } from "../../src/runtime/manager.js";

const TMP_DIR = join(tmpdir(), "barezen-test-plugin");

describe("Plugin Loader + Runtime Manager - Integration", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("loads and executes a shell plugin", async () => {
    const pluginDir = join(TMP_DIR, "echo-plugin");
    mkdirSync(pluginDir, { recursive: true });

    writeFileSync(
      join(pluginDir, "plugin.yaml"),
      `name: echo
runtime: shell
entry: entry.sh
description: Echo plugin
inputs:
  message:
    required: true
    type: string
outputs:
  echoed:
    type: string
`,
    );

    writeFileSync(
      join(pluginDir, "entry.sh"),
      `#!/bin/bash
input=$(cat)
message=$(echo "$input" | jq -r '.inputs.message // "default"')
echo "{\\"success\\": true, \\"data\\": {\\"echoed\\": \\"$message\\"}}"
`,
    );
    chmodSync(join(pluginDir, "entry.sh"), 0o755);

    const registry = createPluginRegistry();
    const loader = createPluginLoader(registry);
    loader.loadPlugin(pluginDir);

    expect(registry.has("echo")).toBe(true);
    const descriptor = registry.get("echo");
    expect(descriptor.runtime).toBe("shell");

    const manager = createRuntimeManager();
    const result = await manager.execute(descriptor, { message: "hello" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.echoed).toBe("hello");
    }
  });

  it("loads and executes a node plugin", async () => {
    const pluginDir = join(TMP_DIR, "node-plugin");
    mkdirSync(pluginDir, { recursive: true });

    writeFileSync(
      join(pluginDir, "plugin.yaml"),
      `name: greet
runtime: node
entry: entry.js
description: Greeting plugin
inputs:
  name:
    required: true
    type: string
outputs:
  greeting:
    type: string
`,
    );

    writeFileSync(
      join(pluginDir, "entry.js"),
      `const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const name = input.inputs.name || 'World';
console.log(JSON.stringify({ success: true, data: { greeting: 'Hello, ' + name + '!' } }));
`,
    );

    const registry = createPluginRegistry();
    const loader = createPluginLoader(registry);
    loader.loadPlugin(pluginDir);

    const descriptor = registry.get("greet");
    const manager = createRuntimeManager();
    const result = await manager.execute(descriptor, { name: "BareZen" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.greeting).toBe("Hello, BareZen!");
    }
  });

  it("handles plugin execution failure", async () => {
    const pluginDir = join(TMP_DIR, "fail-plugin");
    mkdirSync(pluginDir, { recursive: true });

    writeFileSync(
      join(pluginDir, "plugin.yaml"),
      `name: fail
runtime: shell
entry: entry.sh
description: Always fails
inputs: {}
outputs: {}
`,
    );

    writeFileSync(
      join(pluginDir, "entry.sh"),
      `#!/bin/bash
echo "Error: something went wrong" >&2
exit 1
`,
    );
    chmodSync(join(pluginDir, "entry.sh"), 0o755);

    const registry = createPluginRegistry();
    const loader = createPluginLoader(registry);
    loader.loadPlugin(pluginDir);

    const descriptor = registry.get("fail");
    const manager = createRuntimeManager();
    const result = await manager.execute(descriptor, {});

    expect(result.success).toBe(false);
  });

  it("loads multiple plugins from directory", () => {
    const pluginsDir = join(TMP_DIR, "plugins");
    for (const name of ["a", "b", "c"]) {
      const dir = join(pluginsDir, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "plugin.yaml"),
        `name: ${name}
runtime: shell
entry: entry.sh
description: Plugin ${name}
inputs: {}
outputs: {}
`,
      );
      writeFileSync(
        join(dir, "entry.sh"),
        `#!/bin/bash
echo '{"success": true, "data": {}}'
`,
      );
      chmodSync(join(dir, "entry.sh"), 0o755);
    }

    const registry = createPluginRegistry();
    const loader = createPluginLoader(registry);
    const loaded = loader.loadFromDir(pluginsDir);

    expect(loaded).toHaveLength(3);
    expect(registry.size).toBe(3);
  });
});
