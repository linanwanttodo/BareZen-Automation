import { describe, expect, it } from "vitest";
import type { FlowStep } from "../config/schema.js";
import type { GitHubContext } from "../github/context.js";
import type { PluginDescriptor } from "../plugin/descriptor.js";
import { createPluginRegistry } from "../plugin/registry.js";
import type { RuntimeManager } from "../runtime/manager.js";
import { createFlowEngine } from "./engine.js";

function makeGitHubContext(eventName = "push"): GitHubContext {
  return {
    eventName,
    repository: "o/r",
    ref: "r",
    sha: "s",
    actor: "a",
    workspace: "/",
    payload: { type: "unknown", raw: {} },
    serverUrl: "https://github.com",
    apiBaseUrl: "https://api.github.com",
  };
}

function makeDescriptor(name: string): PluginDescriptor {
  return {
    name,
    runtime: "node",
    entry: "index.js",
    inputs: {},
    dirPath: `/p/${name}`,
  };
}

function makeSuccessManager(): RuntimeManager {
  return {
    async execute(_d, inputs) {
      return { success: true, data: { ok: true, inputs }, durationMs: 1 };
    },
  };
}

function makeFailingManager(message = "fail"): RuntimeManager {
  return {
    async execute() {
      return {
        success: false,
        error: { kind: "plugin-failed", message },
        durationMs: 1,
      };
    },
  };
}

function makeConditionalManager(
  fn: (inputs: Record<string, unknown>) => boolean,
): RuntimeManager {
  return {
    async execute(_d, inputs) {
      if (fn(inputs)) {
        return { success: true, data: {}, durationMs: 1 };
      }
      return {
        success: false,
        error: { kind: "plugin-failed", message: "cond" },
        durationMs: 1,
      };
    },
  };
}

describe("FlowEngine", () => {
  it("returns success when all steps succeed", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    reg.register(makeDescriptor("b"));
    const engine = createFlowEngine(makeSuccessManager());
    const steps: FlowStep[] = [
      { plugin: "a", output: "x" },
      { plugin: "b", input: "x" },
    ];
    const result = await engine.execute("flow", steps, reg, makeGitHubContext());
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.flowName).toBe("flow");
  });

  it("aborts on failure without continueOnError", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    reg.register(makeDescriptor("b"));
    const engine = createFlowEngine(makeFailingManager());
    const steps: FlowStep[] = [{ plugin: "a" }, { plugin: "b" }];
    const result = await engine.execute("flow", steps, reg, makeGitHubContext());
    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(1);
    expect(result.error?.stepIndex).toBe(0);
  });

  it("continues on failure with continueOnError", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    reg.register(makeDescriptor("b"));
    const engine = createFlowEngine(makeFailingManager());
    const steps: FlowStep[] = [
      { plugin: "a", continueOnError: true },
      { plugin: "b", continueOnError: true },
    ];
    const result = await engine.execute("flow", steps, reg, makeGitHubContext());
    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(2);
  });

  it("skips step when condition is false", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    let executed = false;
    const mgr: RuntimeManager = {
      async execute() {
        executed = true;
        return { success: true, data: {}, durationMs: 1 };
      },
    };
    const engine = createFlowEngine(mgr);
    const steps: FlowStep[] = [{ plugin: "a", if: 'github.eventName == "pull_request"' }];
    const result = await engine.execute(
      "flow",
      steps,
      reg,
      makeGitHubContext("push"),
    );
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(0);
    expect(executed).toBe(false);
  });

  it("executes step when condition is true", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    const engine = createFlowEngine(makeSuccessManager());
    const steps: FlowStep[] = [{ plugin: "a", if: 'github.eventName == "push"' }];
    const result = await engine.execute(
      "flow",
      steps,
      reg,
      makeGitHubContext("push"),
    );
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(1);
  });

  it("gates a step on an earlier step's output path", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    let secondRan = false;
    const mgr: RuntimeManager = {
      async execute(_descriptor, inputs) {
        if ((inputs as Record<string, unknown>).marker === "second") secondRan = true;
        return { success: true, data: { count: 7 }, durationMs: 1 };
      },
    };
    const engine = createFlowEngine(mgr);

    const satisfied = await engine.execute(
      "flow",
      [
        { plugin: "a", output: "news" },
        { plugin: "a", if: "news.count > 5", inputs: { marker: "second" } },
      ],
      reg,
      makeGitHubContext(),
    );
    expect(satisfied.success).toBe(true);
    expect(satisfied.steps).toHaveLength(2);
    expect(secondRan).toBe(true);

    secondRan = false;
    const unsatisfied = await engine.execute(
      "flow",
      [
        { plugin: "a", output: "news" },
        { plugin: "a", if: "news.count > 10", inputs: { marker: "second" } },
      ],
      reg,
      makeGitHubContext(),
    );
    expect(unsatisfied.success).toBe(true);
    expect(unsatisfied.steps).toHaveLength(1);
    expect(secondRan).toBe(false);
  });

  it("fails the flow when an if expression cannot be parsed", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    let executed = false;
    const mgr: RuntimeManager = {
      async execute() {
        executed = true;
        return { success: true, data: {}, durationMs: 1 };
      },
    };
    const engine = createFlowEngine(mgr);
    const result = await engine.execute(
      "flow",
      [{ plugin: "a", if: "github.eventName ==" }],
      reg,
      makeGitHubContext(),
    );
    expect(result.success).toBe(false);
    expect(executed).toBe(false);
    expect(result.error?.message).toContain("Invalid 'if' expression");
  });

  it("retries on failure according to retry config", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    let attempts = 0;
    const mgr: RuntimeManager = {
      async execute() {
        attempts += 1;
        if (attempts < 3) {
          return {
            success: false,
            error: { kind: "plugin-failed", message: "transient" },
            durationMs: 1,
          };
        }
        return { success: true, data: {}, durationMs: 1 };
      },
    };
    const engine = createFlowEngine(mgr);
    const steps: FlowStep[] = [
      { plugin: "a", retry: { maxAttempts: 3, delayMs: 0 } },
    ];
    const result = await engine.execute("flow", steps, reg, makeGitHubContext());
    expect(result.success).toBe(true);
    expect(attempts).toBe(3);
  });

  it("returns failure after exhausting retries", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("a"));
    const engine = createFlowEngine(makeFailingManager());
    const steps: FlowStep[] = [
      { plugin: "a", retry: { maxAttempts: 2, delayMs: 0 } },
    ];
    const result = await engine.execute("flow", steps, reg, makeGitHubContext());
    expect(result.success).toBe(false);
  });

  it("passes data between steps via context", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss"));
    reg.register(makeDescriptor("email"));
    const mgr: RuntimeManager = {
      async execute(_d, inputs) {
        if ("input" in inputs) {
          return {
            success: true,
            data: { sent: (inputs.input as { articles: unknown[] }).articles.length },
            durationMs: 1,
          };
        }
        return { success: true, data: { articles: [1, 2, 3] }, durationMs: 1 };
      },
    };
    const engine = createFlowEngine(mgr);
    const steps: FlowStep[] = [
      { plugin: "rss", output: "news" },
      { plugin: "email", input: "news", output: "result" },
    ];
    const result = await engine.execute("flow", steps, reg, makeGitHubContext());
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
  });

  it("handles empty steps array", async () => {
    const reg = createPluginRegistry();
    const engine = createFlowEngine(makeSuccessManager());
    const result = await engine.execute("flow", [], reg, makeGitHubContext());
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(0);
  });
});
