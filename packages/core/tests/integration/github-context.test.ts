/**
 * T-TEST-01: GitHub Context Provider integration tests
 * Tests parsing of various GitHub event types.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitHubContextProvider } from "../../src/github/provider.js";
import type { GitHubEnvSource } from "../../src/github/provider.js";

const TMP_DIR = join(tmpdir(), "barezen-test-gh-ctx");

describe("GitHub Context Provider - Integration", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  function makeEnv(env: Record<string, string | undefined>): GitHubEnvSource {
    return {
      get(name: string): string | undefined {
        return env[name];
      },
    };
  }

  function writeEventPath(payload: unknown): string {
    const eventPath = join(TMP_DIR, "event.json");
    writeFileSync(eventPath, JSON.stringify(payload));
    return eventPath;
  }

  it("parses push event", () => {
    const eventPath = writeEventPath({
      ref: "refs/heads/main",
      before: "abc123",
      after: "def456",
      commits: [{ id: "def456", message: "fix: bug", timestamp: "2023-11-14T00:00:00Z" }],
      head_commit: null,
    });
    const provider = createGitHubContextProvider(
      makeEnv({
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "push",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_WORKSPACE: "/workspace",
        GITHUB_SHA: "def456",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_ACTOR: "dev",
      }),
    );
    expect(provider.isActionsEnv()).toBe(true);
    const ctx = provider.provide();
    expect(ctx.eventName).toBe("push");
    expect(ctx.payload.type).toBe("push");
    expect(ctx.sha).toBe("def456");
    expect(ctx.ref).toBe("refs/heads/main");
    expect(ctx.repository).toBe("owner/repo");
  });

  it("parses pull_request event", () => {
    const eventPath = writeEventPath({
      action: "opened",
      number: 42,
      pull_request: {
        number: 42,
        title: "Add feature",
        body: "Description",
        state: "open",
        user: { login: "dev" },
        head: { ref: "feature", sha: "abc", repo: { full_name: "owner/repo" } },
        base: { ref: "main", sha: "def", repo: { full_name: "owner/repo" } },
        html_url: "https://github.com/owner/repo/pull/42",
        merged: false,
        draft: false,
      },
    });
    const provider = createGitHubContextProvider(
      makeEnv({
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_SHA: "abc",
        GITHUB_REF: "refs/pull/42/merge",
        GITHUB_REPOSITORY: "owner/repo",
      }),
    );
    const ctx = provider.provide();
    expect(ctx.eventName).toBe("pull_request");
    expect(ctx.payload.type).toBe("pull_request");
  });

  it("parses issues event", () => {
    const eventPath = writeEventPath({
      action: "opened",
      issue: {
        number: 5,
        title: "Bug report",
        body: "Something is wrong",
        state: "open",
        user: { login: "user" },
        labels: [],
        assignees: [],
      },
    });
    const provider = createGitHubContextProvider(
      makeEnv({
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "issues",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "owner/repo",
      }),
    );
    const ctx = provider.provide();
    expect(ctx.eventName).toBe("issues");
    expect(ctx.payload.type).toBe("issues");
  });

  it("parses schedule event", () => {
    const eventPath = writeEventPath({});
    const provider = createGitHubContextProvider(
      makeEnv({
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "schedule",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "owner/repo",
      }),
    );
    const ctx = provider.provide();
    expect(ctx.eventName).toBe("schedule");
    expect(ctx.payload.type).toBe("schedule");
  });

  it("parses workflow_dispatch event", () => {
    const eventPath = writeEventPath({ inputs: { flow: "daily" } });
    const provider = createGitHubContextProvider(
      makeEnv({
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "owner/repo",
      }),
    );
    const ctx = provider.provide();
    expect(ctx.eventName).toBe("workflow_dispatch");
    expect(ctx.payload.type).toBe("workflow_dispatch");
  });

  it("identifies non-Actions environment", () => {
    const provider = createGitHubContextProvider(makeEnv({}));
    expect(provider.isActionsEnv()).toBe(false);
  });
});
