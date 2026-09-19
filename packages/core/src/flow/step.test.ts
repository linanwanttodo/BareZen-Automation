import { describe, expect, it } from "vitest";
import type { FlowStep } from "../config/schema.js";
import type { GitHubContext } from "../github/context.js";
import type { PluginDescriptor } from "../plugin/descriptor.js";
import { createPluginRegistry } from "../plugin/registry.js";
import type { PluginResult, RuntimeManager } from "../runtime/manager.js";
import { createFlowContext } from "./context.js";
import { createStepExecutor } from "./step.js";

function makeGitHubContext(): GitHubContext {
  return {
    eventName: "push",
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

function makeDescriptor(
  name: string,
  inputs: Record<string, { required?: boolean; default?: unknown }> = {},
): PluginDescriptor {
  return {
    name,
    runtime: "node",
    entry: "index.js",
    inputs,
    dirPath: `/plugins/${name}`,
  };
}

function makeRuntimeManager(
  fn: (inputs: Record<string, unknown>) => PluginResult,
): RuntimeManager {
  return {
    async execute(_descriptor, inputs) {
      return fn(inputs);
    },
  };
}

describe("StepExecutor", () => {
  it("resolves direct inputs and executes", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    const mgr = makeRuntimeManager((inputs) => ({
      success: true,
      data: { received: inputs },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "rss", inputs: { url: "https://example.com" } };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(true);
    if (result.result.success) {
      expect(result.result.data).toEqual({
        received: { url: "https://example.com" },
      });
    }
  });

  it("resolves string input reference from context", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("email"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("news", { articles: [1, 2, 3] });
    const mgr = makeRuntimeManager((inputs) => ({
      success: true,
      data: { count: (inputs.input as { articles: unknown[] }).articles.length },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "email", input: "news" };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(true);
    if (result.result.success) {
      expect(result.result.data).toEqual({ count: 3 });
    }
  });

  it("resolves record input references from context", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("ai-summary"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("news", { text: "hello" });
    const mgr = makeRuntimeManager((inputs) => ({
      success: true,
      data: { summary: (inputs.source as { text: string }).text.toUpperCase() },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "ai-summary", input: { source: "news" } };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(true);
    if (result.result.success) {
      expect(result.result.data).toEqual({ summary: "HELLO" });
    }
  });

  it("resolves a dotted field path in record input references", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("ai-summary"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("news", { digest: "3 items", articles: [{ title: "A" }, { title: "B" }] });
    const mgr = makeRuntimeManager((inputs) => ({
      success: true,
      data: { received: inputs.text },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "ai-summary", input: { text: "news.digest" } };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(true);
    if (result.result.success) {
      expect(result.result.data).toEqual({ received: "3 items" });
    }
  });

  it("resolves an indexed field path", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("email"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("news", { articles: [{ title: "A" }, { title: "B" }] });
    const mgr = makeRuntimeManager((inputs) => ({
      success: true,
      data: { received: inputs.body },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = {
      plugin: "email",
      input: { body: "news.articles[1].title" },
    };
    const result = await executor.execute(step, 0, ctx, reg);
    if (result.result.success) {
      expect(result.result.data).toEqual({ received: "B" });
    } else {
      expect.fail(result.result.error.message);
    }
  });

  it("resolves a field path in the string input form", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("email"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("news", { articles: [{ title: "A" }] });
    const mgr = makeRuntimeManager((inputs) => ({
      success: true,
      data: { received: inputs.input },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "email", input: "news.articles[0]" };
    const result = await executor.execute(step, 0, ctx, reg);
    if (result.result.success) {
      expect(result.result.data).toEqual({ received: { title: "A" } });
    } else {
      expect.fail(result.result.error.message);
    }
  });

  it("fails the step with the reference when a path does not resolve", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("email"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("news", { articles: [] });
    const mgr = makeRuntimeManager(() => ({
      success: true,
      data: {},
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "email", input: { body: "news.articles[3].title" } };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(false);
    if (!result.result.success) {
      expect(result.error ?? result.result.error.message).toContain("news.articles[3].title");
    }
  });

  it("fails the step when the root key is absent", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("email"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    const mgr = makeRuntimeManager(() => ({ success: true, data: {}, durationMs: 1 }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "email", input: { body: "missing.title" } };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(false);
  });

  it("stores output to context on success", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    const mgr = makeRuntimeManager(() => ({
      success: true,
      data: { articles: [] },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "rss", output: "news" };
    await executor.execute(step, 0, ctx, reg);
    expect(ctx.has("news")).toBe(true);
    expect(ctx.getInput("news")).toEqual({ articles: [] });
  });

  it("does not store output on failure", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    const mgr = makeRuntimeManager(() => ({
      success: false,
      error: { kind: "plugin-failed", message: "x" },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "rss", output: "news" };
    await executor.execute(step, 0, ctx, reg);
    expect(ctx.has("news")).toBe(false);
  });

  it("returns failure when plugin not found", async () => {
    const reg = createPluginRegistry();
    const ctx = createFlowContext("flow", makeGitHubContext());
    const mgr = makeRuntimeManager(() => ({
      success: true,
      data: {},
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "missing" };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(false);
  });

  it("returns failure when required input is missing", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss", { url: { required: true } }));
    const ctx = createFlowContext("flow", makeGitHubContext());
    const mgr = makeRuntimeManager(() => ({
      success: true,
      data: {},
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "rss" };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(false);
    if (!result.result.success && result.result.error.kind === "plugin-failed") {
      expect(result.result.error.message).toContain("url");
    }
  });

  it("fills default values for optional inputs", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss", { retry: { default: 3 } }));
    const ctx = createFlowContext("flow", makeGitHubContext());
    const mgr = makeRuntimeManager((inputs) => ({
      success: true,
      data: { retry: inputs.retry },
      durationMs: 1,
    }));
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "rss" };
    const result = await executor.execute(step, 0, ctx, reg);
    expect(result.result.success).toBe(true);
    if (result.result.success) {
      expect(result.result.data).toEqual({ retry: 3 });
    }
  });

  it("passes timeout option to runtime manager", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    let receivedTimeout: number | undefined;
    const mgr: RuntimeManager = {
      async execute(_d, _i, options) {
        receivedTimeout = options?.timeoutMs;
        return { success: true, data: {}, durationMs: 1 };
      },
    };
    const executor = createStepExecutor(mgr);
    const step: FlowStep = { plugin: "rss", timeout: 5000 };
    await executor.execute(step, 0, ctx, reg);
    expect(receivedTimeout).toBe(5000);
  });

  it("applies the executor default timeout to a step without one", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    let receivedTimeout: number | undefined;
    const mgr: RuntimeManager = {
      async execute(_d, _i, options) {
        receivedTimeout = options?.timeoutMs;
        return { success: true, data: {}, durationMs: 1 };
      },
    };
    const executor = createStepExecutor(mgr, { defaultTimeoutMs: 30000 });
    await executor.execute({ plugin: "rss" }, 0, ctx, reg);
    expect(receivedTimeout).toBe(30000);
  });

  it("lets a step's own timeout override the default", async () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss"));
    const ctx = createFlowContext("flow", makeGitHubContext());
    let receivedTimeout: number | undefined;
    const mgr: RuntimeManager = {
      async execute(_d, _i, options) {
        receivedTimeout = options?.timeoutMs;
        return { success: true, data: {}, durationMs: 1 };
      },
    };
    const executor = createStepExecutor(mgr, { defaultTimeoutMs: 30000 });
    await executor.execute({ plugin: "rss", timeout: 1000 }, 0, ctx, reg);
    expect(receivedTimeout).toBe(1000);
  });
});
