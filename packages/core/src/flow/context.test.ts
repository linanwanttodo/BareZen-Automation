import { describe, expect, it } from "vitest";
import { FlowContextKeyNotFoundError } from "../errors/index.js";
import type { GitHubContext } from "../github/context.js";
import { createFlowContext } from "./context.js";

function makeGitHubContext(): GitHubContext {
  return {
    eventName: "push",
    repository: "owner/repo",
    ref: "refs/heads/main",
    sha: "abc",
    actor: "octocat",
    workspace: "/tmp",
    payload: { type: "unknown", raw: {} },
    serverUrl: "https://github.com",
    apiBaseUrl: "https://api.github.com",
  };
}

describe("FlowContext", () => {
  it("stores and retrieves output by key", () => {
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("news", { articles: [] });
    expect(ctx.has("news")).toBe(true);
    expect(ctx.getInput("news")).toEqual({ articles: [] });
  });

  it("throws FlowContextKeyNotFoundError for missing key", () => {
    const ctx = createFlowContext("flow", makeGitHubContext());
    expect(() => ctx.getInput("missing")).toThrow(FlowContextKeyNotFoundError);
  });

  it("returns all keys", () => {
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("a", 1);
    ctx.setOutput("b", 2);
    expect(ctx.keys().sort()).toEqual(["a", "b"]);
  });

  it("returns false for has() on missing key", () => {
    const ctx = createFlowContext("flow", makeGitHubContext());
    expect(ctx.has("x")).toBe(false);
  });

  it("returns the injected GitHub context", () => {
    const gh = makeGitHubContext();
    const ctx = createFlowContext("flow", gh);
    expect(ctx.getGitHub()).toBe(gh);
  });

  it("exposes flowName", () => {
    const ctx = createFlowContext("daily-report", makeGitHubContext());
    expect(ctx.flowName).toBe("daily-report");
  });

  it("overwrites existing key on setOutput", () => {
    const ctx = createFlowContext("flow", makeGitHubContext());
    ctx.setOutput("x", 1);
    ctx.setOutput("x", 2);
    expect(ctx.getInput("x")).toBe(2);
  });
});
