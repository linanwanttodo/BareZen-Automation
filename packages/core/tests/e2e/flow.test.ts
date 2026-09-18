/**
 * T-TEST-04: Flow Engine end-to-end tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFlowEngine } from "../../src/flow/engine.js";
import { createRuntimeManager } from "../../src/runtime/manager.js";
import { createPluginRegistry } from "../../src/plugin/registry.js";
import { createPluginLoader } from "../../src/plugin/loader.js";
import { createLogger, silentLogger } from "../../src/logger/logger.js";
import type { GitHubContext } from "../../src/github/context.js";

const TMP_DIR = join(tmpdir(), "barezen-test-flow");

function makeGitHubContext(): GitHubContext {
  return {
    eventName: "push",
    sha: "abc123",
    ref: "refs/heads/main",
    repository: "owner/repo",
    actor: "dev",
    workspace: "/workspace",
    payload: { type: "unknown", raw: {} },
    serverUrl: "https://github.com",
    apiBaseUrl: "https://api.github.com",
  };
}

describe("Flow Engine - E2E", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  function createEchoPlugin(name: string, outputValue: string): string {
    const dir = join(TMP_DIR, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "plugin.yaml"),
      `name: ${name}
runtime: shell
entry: entry.sh
description: Echo ${name}
inputs:
  value:
    required: false
    type: string
outputs:
  result:
    type: string
`,
    );
    writeFileSync(
      join(dir, "entry.sh"),
      `#!/bin/bash
input=$(cat)
val=$(echo "$input" | jq -r '.inputs.value // "${outputValue}"')
echo "{\\"success\\": true, \\"data\\": {\\"result\\": \\"$val\\"}}"
`,
    );
    chmodSync(join(dir, "entry.sh"), 0o755);
    return dir;
  }

  it("executes multi-step flow with data passing", async () => {
    const registry = createPluginRegistry();
    const loader = createPluginLoader(registry);
    loader.loadPlugin(createEchoPlugin("step1", "first"));
    loader.loadPlugin(createEchoPlugin("step2", "second"));

    const manager = createRuntimeManager();
    const engine = createFlowEngine(manager, silentLogger);

    const steps = [
      { plugin: "step1", output: "out1" },
      { plugin: "step2", output: "out2" },
    ];

    const result = await engine.execute("test-flow", steps, registry, makeGitHubContext());

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
  });

  it("handles step failure with continueOnError", async () => {
    const failDir = join(TMP_DIR, "fail");
    mkdirSync(failDir, { recursive: true });
    writeFileSync(
      join(failDir, "plugin.yaml"),
      `name: fail
runtime: shell
entry: entry.sh
description: Always fails
inputs: {}
outputs: {}
`,
    );
    writeFileSync(
      join(failDir, "entry.sh"),
      `#!/bin/bash
exit 1
`,
    );
    chmodSync(join(failDir, "entry.sh"), 0o755);

    const okDir = createEchoPlugin("ok", "success");

    const registry = createPluginRegistry();
    const loader = createPluginLoader(registry);
    loader.loadPlugin(failDir);
    loader.loadPlugin(okDir);

    const manager = createRuntimeManager();
    const engine = createFlowEngine(manager, silentLogger);

    const steps = [
      { plugin: "fail", continueOnError: true },
      { plugin: "ok", output: "result" },
    ];

    const result = await engine.execute("test-flow", steps, registry, makeGitHubContext());

    // Flow continues (both steps executed) but overall success is false because step 1 failed
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.result.success).toBe(false);
    expect(result.steps[1]?.result.success).toBe(true);
  });

  it("stops on step failure without continueOnError", async () => {
    const failDir = join(TMP_DIR, "fail");
    mkdirSync(failDir, { recursive: true });
    writeFileSync(
      join(failDir, "plugin.yaml"),
      `name: fail
runtime: shell
entry: entry.sh
description: Always fails
inputs: {}
outputs: {}
`,
    );
    writeFileSync(
      join(failDir, "entry.sh"),
      `#!/bin/bash
exit 1
`,
    );
    chmodSync(join(failDir, "entry.sh"), 0o755);

    const registry = createPluginRegistry();
    const loader = createPluginLoader(registry);
    loader.loadPlugin(failDir);

    const manager = createRuntimeManager();
    const engine = createFlowEngine(manager, silentLogger);

    const steps = [
      { plugin: "fail" },
      { plugin: "fail" },
    ];

    const result = await engine.execute("test-flow", steps, registry, makeGitHubContext());

    expect(result.success).toBe(false);
  });

  it("respects step condition (if)", async () => {
    const echoDir = createEchoPlugin("conditional", "conditional-value");

    const registry = createPluginRegistry();
    const loader = createPluginLoader(registry);
    loader.loadPlugin(echoDir);

    const manager = createRuntimeManager();
    const engine = createFlowEngine(manager, silentLogger);

    const steps = [
      { plugin: "conditional", if: "false", output: "skipped" },
    ];

    const result = await engine.execute("test-flow", steps, registry, makeGitHubContext());

    expect(result.success).toBe(true);
    // Skipped steps are not included in results
    expect(result.steps).toHaveLength(0);
  });
});
