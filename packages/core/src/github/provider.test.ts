import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type GitHubEnvSource,
  createGitHubContextProvider,
  isActionsEnv,
  parseEventPayload,
} from "./provider.js";

function makeEnv(map: Readonly<Record<string, string | undefined>>): GitHubEnvSource {
  return {
    get: (name) => map[name],
  };
}

describe("isActionsEnv", () => {
  it("returns true when GITHUB_ACTIONS is 'true'", () => {
    expect(isActionsEnv({ GITHUB_ACTIONS: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("returns false when GITHUB_ACTIONS is unset", () => {
    expect(isActionsEnv({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("returns false when GITHUB_ACTIONS is not 'true'", () => {
    expect(isActionsEnv({ GITHUB_ACTIONS: "false" } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("parseEventPayload", () => {
  it("returns unknown when raw is null", () => {
    const p = parseEventPayload("push", null);
    expect(p.type).toBe("unknown");
  });

  it("parses push event", () => {
    const p = parseEventPayload("push", {
      ref: "refs/heads/main",
      commits: [{ id: "abc" }],
      head_commit: { id: "abc" },
    });
    expect(p.type).toBe("push");
    if (p.type === "push") {
      expect(p.ref).toBe("refs/heads/main");
      expect(p.commits).toHaveLength(1);
    }
  });

  it("parses pull_request event", () => {
    const p = parseEventPayload("pull_request", {
      action: "opened",
      number: 42,
      pull_request: { number: 42, title: "Add feature" },
    });
    expect(p.type).toBe("pull_request");
    if (p.type === "pull_request") {
      expect(p.action).toBe("opened");
      expect(p.number).toBe(42);
    }
  });

  it("parses issues event", () => {
    const p = parseEventPayload("issues", {
      action: "labeled",
      issue: { number: 7, title: "Bug" },
    });
    expect(p.type).toBe("issues");
    if (p.type === "issues") {
      expect(p.action).toBe("labeled");
    }
  });

  it("parses issue_comment event", () => {
    const p = parseEventPayload("issue_comment", {
      action: "created",
      comment: { id: 1, body: "hi" },
      issue: { number: 7 },
    });
    expect(p.type).toBe("issue_comment");
    if (p.type === "issue_comment") {
      expect(p.action).toBe("created");
    }
  });

  it("parses release event", () => {
    const p = parseEventPayload("release", {
      action: "published",
      release: { tag_name: "v1.0.0" },
    });
    expect(p.type).toBe("release");
    if (p.type === "release") {
      expect(p.action).toBe("published");
    }
  });

  it("parses schedule event", () => {
    const p = parseEventPayload("schedule", { schedule: "0 0 * * *" });
    expect(p.type).toBe("schedule");
    if (p.type === "schedule") {
      expect(p.schedule).toBe("0 0 * * *");
    }
  });

  it("parses workflow_dispatch event", () => {
    const p = parseEventPayload("workflow_dispatch", {
      inputs: { foo: "bar" },
    });
    expect(p.type).toBe("workflow_dispatch");
    if (p.type === "workflow_dispatch") {
      expect(p.inputs).toEqual({ foo: "bar" });
    }
  });

  it("parses repository_dispatch event", () => {
    const p = parseEventPayload("repository_dispatch", {
      action: "custom",
      client_payload: { x: 1 },
    });
    expect(p.type).toBe("repository_dispatch");
    if (p.type === "repository_dispatch") {
      expect(p.action).toBe("custom");
      expect(p.client_payload).toEqual({ x: 1 });
    }
  });

  it("falls back to unknown for unrecognized event names", () => {
    const p = parseEventPayload("custom_event", { foo: 1 });
    expect(p.type).toBe("unknown");
    if (p.type === "unknown") {
      expect(p.raw).toEqual({ foo: 1 });
    }
  });
});

describe("createGitHubContextProvider", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bz-github-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("isActionsEnv reflects GITHUB_ACTIONS env var", () => {
    const provider = createGitHubContextProvider(
      makeEnv({ GITHUB_ACTIONS: "true" }),
    );
    expect(provider.isActionsEnv()).toBe(true);

    const provider2 = createGitHubContextProvider(makeEnv({}));
    expect(provider2.isActionsEnv()).toBe(false);
  });

  it("provide() reads all GITHUB_* env vars", () => {
    const provider = createGitHubContextProvider(
      makeEnv({
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "push",
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_REF: "refs/heads/main",
        GITHUB_SHA: "abc123",
        GITHUB_ACTOR: "octocat",
        GITHUB_WORKSPACE: "/home/runner/work",
        GITHUB_TOKEN: "secret-token",
        GITHUB_SERVER_URL: "https://ghe.example.com",
        GITHUB_API_URL: "https://ghe.example.com/api/v3",
      }),
    );
    const ctx = provider.provide();
    expect(ctx.eventName).toBe("push");
    expect(ctx.repository).toBe("owner/repo");
    expect(ctx.ref).toBe("refs/heads/main");
    expect(ctx.sha).toBe("abc123");
    expect(ctx.actor).toBe("octocat");
    expect(ctx.workspace).toBe("/home/runner/work");
    expect(ctx.token).toBe("secret-token");
    expect(ctx.serverUrl).toBe("https://ghe.example.com");
    expect(ctx.apiBaseUrl).toBe("https://ghe.example.com/api/v3");
  });

  it("provide() reads event payload from GITHUB_EVENT_PATH", () => {
    const payloadFile = join(tmpDir, "event.json");
    writeFileSync(
      payloadFile,
      JSON.stringify({ action: "opened", number: 1, pull_request: { number: 1 } }),
    );
    const provider = createGitHubContextProvider(
      makeEnv({
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_EVENT_PATH: payloadFile,
      }),
    );
    const ctx = provider.provide();
    expect(ctx.payload.type).toBe("pull_request");
    if (ctx.payload.type === "pull_request") {
      expect(ctx.payload.action).toBe("opened");
      expect(ctx.payload.number).toBe(1);
    }
  });

  it("provide() defaults serverUrl and apiBaseUrl when unset", () => {
    const provider = createGitHubContextProvider(makeEnv({}));
    const ctx = provider.provide();
    expect(ctx.serverUrl).toBe("https://github.com");
    expect(ctx.apiBaseUrl).toBe("https://api.github.com");
  });

  it("provide() omits token when unset", () => {
    const provider = createGitHubContextProvider(makeEnv({}));
    const ctx = provider.provide();
    expect(ctx.token).toBeUndefined();
  });

  it("provide() omits token when empty string", () => {
    const provider = createGitHubContextProvider(
      makeEnv({ GITHUB_TOKEN: "" }),
    );
    const ctx = provider.provide();
    expect(ctx.token).toBeUndefined();
  });

  it("provide() returns unknown payload when event path is unset", () => {
    const provider = createGitHubContextProvider(
      makeEnv({ GITHUB_EVENT_NAME: "push" }),
    );
    const ctx = provider.provide();
    expect(ctx.payload.type).toBe("unknown");
  });

  it("provide() returns unknown payload when event file is unreadable", () => {
    const provider = createGitHubContextProvider(
      makeEnv({
        GITHUB_EVENT_NAME: "push",
        GITHUB_EVENT_PATH: "/nonexistent/path/event.json",
      }),
    );
    const ctx = provider.provide();
    expect(ctx.payload.type).toBe("unknown");
  });
});
