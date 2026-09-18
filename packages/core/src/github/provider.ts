/**
 * GitHub Actions context provider.
 *
 * Reads `GITHUB_*` environment variables and the event payload file,
 * building a typed {@link GitHubContext} for injection into flows and plugins.
 *
 * @packageDocumentation
 */

import { readFileSync } from "node:fs";
import type {
  Comment,
  GitHubContext,
  GitHubContextProvider,
  GitHubEventPayload,
  Issue,
  PullRequest,
  PushCommit,
  Release,
} from "./context.js";

/** Detect whether we are running inside GitHub Actions. */
export function isActionsEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GITHUB_ACTIONS === "true";
}

/** Read and parse the event payload file. Returns null if path is unset or unreadable. */
function readEventPayload(
  eventPath: string | undefined,
): Readonly<Record<string, unknown>> | null {
  if (eventPath === undefined || eventPath === "") return null;
  try {
    const raw = readFileSync(eventPath, "utf8");
    return JSON.parse(raw) as Readonly<Record<string, unknown>>;
  } catch {
    return null;
  }
}

/** Narrow the raw payload to a typed {@link GitHubEventPayload} based on event name. */
export function parseEventPayload(
  eventName: string,
  raw: Readonly<Record<string, unknown>> | null,
): GitHubEventPayload {
  if (raw === null) {
    return { type: "unknown", raw: {} };
  }

  switch (eventName) {
    case "push":
      return {
        type: "push",
        ref: typeof raw.ref === "string" ? raw.ref : "",
        commits: (Array.isArray(raw.commits) ? raw.commits : []) as readonly PushCommit[],
        head_commit: (raw.head_commit ?? null) as PushCommit | null,
      };

    case "pull_request":
      return {
        type: "pull_request",
        action: typeof raw.action === "string" ? raw.action : "",
        number: typeof raw.number === "number" ? raw.number : 0,
        pull_request: raw.pull_request as PullRequest,
      };

    case "issues":
      return {
        type: "issues",
        action: typeof raw.action === "string" ? raw.action : "",
        issue: raw.issue as Issue,
      };

    case "issue_comment":
      return {
        type: "issue_comment",
        action: typeof raw.action === "string" ? raw.action : "",
        comment: raw.comment as Comment,
        issue: raw.issue as Issue,
      };

    case "release":
      return {
        type: "release",
        action: typeof raw.action === "string" ? raw.action : "",
        release: raw.release as Release,
      };

    case "schedule":
      return {
        type: "schedule",
        schedule: typeof raw.schedule === "string" ? raw.schedule : "",
      };

    case "workflow_dispatch":
      return {
        type: "workflow_dispatch",
        inputs: (raw.inputs ?? {}) as Readonly<Record<string, unknown>>,
      };

    case "repository_dispatch":
      return {
        type: "repository_dispatch",
        action: typeof raw.action === "string" ? raw.action : "",
        client_payload: (raw.client_payload ?? {}) as Readonly<Record<string, unknown>>,
      };

    default:
      return { type: "unknown", raw };
  }
}

/** Environment source abstraction for testability. */
export interface GitHubEnvSource {
  get(name: string): string | undefined;
}

/** Default env source backed by `process.env`. */
const defaultEnvSource: GitHubEnvSource = {
  get: (name) => process.env[name],
};

/**
 * Create a GitHub context provider.
 *
 * @example
 * ```ts
 * const provider = createGitHubContextProvider();
 * if (provider.isActionsEnv()) {
 *   const ctx = provider.provide();
 *   console.log(ctx.eventName, ctx.repository);
 * }
 * ```
 */
export function createGitHubContextProvider(
  env: GitHubEnvSource = defaultEnvSource,
): GitHubContextProvider {
  return {
    isActionsEnv() {
      return env.get("GITHUB_ACTIONS") === "true";
    },

    provide(): GitHubContext {
      const eventName = env.get("GITHUB_EVENT_NAME") ?? "";
      const repository = env.get("GITHUB_REPOSITORY") ?? "";
      const ref = env.get("GITHUB_REF") ?? "";
      const sha = env.get("GITHUB_SHA") ?? "";
      const actor = env.get("GITHUB_ACTOR") ?? "";
      const workspace = env.get("GITHUB_WORKSPACE") ?? "";
      const token = env.get("GITHUB_TOKEN");
      const serverUrl = env.get("GITHUB_SERVER_URL") ?? "https://github.com";
      const apiBaseUrl = env.get("GITHUB_API_URL") ?? "https://api.github.com";

      const eventPath = env.get("GITHUB_EVENT_PATH");
      const raw = readEventPayload(eventPath);
      const payload = parseEventPayload(eventName, raw);

      const ctx: GitHubContext = {
        eventName,
        repository,
        ref,
        sha,
        actor,
        workspace,
        payload,
        serverUrl,
        apiBaseUrl,
      };
      if (token !== undefined && token !== "") {
        ctx.token = token;
      }
      return ctx;
    },
  };
}
