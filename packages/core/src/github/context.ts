/**
 * GitHub Actions context types.
 *
 * @packageDocumentation
 */

/** A single commit in a push event. */
export interface PushCommit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
  committer: {
    name: string;
    email: string;
    username?: string;
  };
  added: readonly string[];
  removed: readonly string[];
  modified: readonly string[];
}

/** Pull request payload subset. */
export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  user: { login: string } | null;
  head: {
    ref: string;
    sha: string;
    repo: { full_name: string };
  };
  base: {
    ref: string;
    sha: string;
    repo: { full_name: string };
  };
  html_url: string;
  merged: boolean;
  draft: boolean;
}

/** Issue payload subset. */
export interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  user: { login: string } | null;
  html_url: string;
  labels: readonly { name: string }[];
}

/** Comment payload subset. */
export interface Comment {
  id: number;
  body: string;
  user: { login: string } | null;
  html_url: string;
}

/** Release payload subset. */
export interface Release {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
}

/** Discriminated union of supported GitHub event payloads. */
export type GitHubEventPayload =
  | { type: "push"; ref: string; commits: readonly PushCommit[]; head_commit: PushCommit | null }
  | { type: "pull_request"; action: string; number: number; pull_request: PullRequest }
  | { type: "issues"; action: string; issue: Issue }
  | { type: "issue_comment"; action: string; comment: Comment; issue: Issue }
  | { type: "release"; action: string; release: Release }
  | { type: "schedule"; schedule: string }
  | { type: "workflow_dispatch"; inputs: Readonly<Record<string, unknown>> }
  | { type: "repository_dispatch"; action: string; client_payload: Readonly<Record<string, unknown>> }
  | { type: "unknown"; raw: Readonly<Record<string, unknown>> };

/** Supported event type discriminants. */
export type GitHubEventType = GitHubEventPayload["type"];

/** GitHub context object. */
export interface GitHubContext {
  eventName: string;
  repository: string;
  ref: string;
  sha: string;
  actor: string;
  workspace: string;
  token?: string;
  payload: GitHubEventPayload;
  serverUrl: string;
  apiBaseUrl: string;
}

/** Provider interface. */
export interface GitHubContextProvider {
  provide(): GitHubContext;
  isActionsEnv(): boolean;
}
