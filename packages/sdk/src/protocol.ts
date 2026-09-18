/**
 * SDK ↔ Framework JSON communication protocol.
 *
 * The framework sends a {@link PluginInputMessage} to the plugin via stdin,
 * and the plugin responds with a {@link PluginOutputMessage} via stdout.
 *
 * @packageDocumentation
 */

import type { GitHubContext } from "@barezen/core";

/** Message sent from framework to plugin via stdin. */
export interface PluginInputMessage {
  inputs: Readonly<Record<string, unknown>>;
  github?: GitHubContext;
}

/** Successful output message from plugin to framework. */
export interface PluginOutputSuccess {
  success: true;
  data: Readonly<Record<string, unknown>>;
}

/** Failure output message from plugin to framework. */
export interface PluginOutputFailure {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: Readonly<Record<string, unknown>>;
  };
}

/** Output message from plugin to framework (success | failure). */
export type PluginOutputMessage = PluginOutputSuccess | PluginOutputFailure;

/**
 * Read and parse the plugin input message from stdin.
 *
 * Reads all of stdin as UTF-8 JSON and parses it into a
 * {@link PluginInputMessage}. Throws if stdin is not valid JSON.
 */
export function readInput(): Promise<PluginInputMessage> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(data) as PluginInputMessage);
      } catch (err) {
        reject(
          new Error(
            `Failed to parse stdin as JSON: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    });
    process.stdin.on("error", reject);
  });
}

/**
 * Write the plugin output message to stdout as JSON.
 *
 * Uses `process.stdout.write` with a single JSON string (no trailing newline)
 * to avoid framing issues.
 */
export function writeOutput(message: PluginOutputMessage): void {
  process.stdout.write(JSON.stringify(message));
}
