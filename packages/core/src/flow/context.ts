/**
 * Flow context: maintains step-to-step data passing and GitHub context.
 *
 * @packageDocumentation
 */

import { FlowContextKeyNotFoundError } from "../errors/index.js";
import type { GitHubContext } from "../github/context.js";

/** Flow context interface. */
export interface FlowContext {
  setOutput(key: string, value: unknown): void;
  getInput(key: string): unknown;
  has(key: string): boolean;
  keys(): string[];
  getGitHub(): GitHubContext;
  readonly flowName: string;
}

/** Create a flow context. */
export function createFlowContext(
  flowName: string,
  github: GitHubContext,
): FlowContext {
  const outputs = new Map<string, unknown>();

  return {
    flowName,

    setOutput(key, value) {
      outputs.set(key, value);
    },

    getInput(key) {
      if (!outputs.has(key)) {
        throw new FlowContextKeyNotFoundError(key, flowName);
      }
      return outputs.get(key);
    },

    has(key) {
      return outputs.has(key);
    },

    keys() {
      return [...outputs.keys()];
    },

    getGitHub() {
      return github;
    },
  };
}
