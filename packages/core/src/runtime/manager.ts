/**
 * Runtime manager: coordinates adapters and the process spawner to execute
 * plugins and parse their JSON output protocol.
 *
 * @packageDocumentation
 */

import type { PluginDescriptor } from "../plugin/descriptor.js";
import type { GitHubContext } from "../github/context.js";
import { RuntimeNotAvailableError } from "../errors/index.js";
import { getAdapter } from "./adapters/index.js";
import { spawnProcess, type SpawnOptions } from "./spawner.js";

/** Options for executing a plugin. */
export interface ExecuteOptions extends SpawnOptions {
  /** GitHub context to inject into the plugin input message. */
  github?: GitHubContext;
}

/** Input message sent to the plugin via stdin. */
export interface PluginInputMessage {
  inputs: Readonly<Record<string, unknown>>;
  github?: GitHubContext;
}

/** Output message received from the plugin via stdout. */
export interface PluginOutputMessage {
  success: boolean;
  data?: Readonly<Record<string, unknown>>;
  error?: { message?: string };
}

/** Plugin error variants. */
export type PluginError =
  | { kind: "timeout"; timeoutMs: number }
  | { kind: "non-zero-exit"; exitCode: number; stderr: string }
  | { kind: "signal-killed"; signal: string }
  | { kind: "invalid-output"; raw: string; parseError: string }
  | { kind: "plugin-failed"; message: string };

/** Result of a plugin execution. */
export type PluginResult =
  | { success: true; data: Readonly<Record<string, unknown>>; durationMs: number }
  | { success: false; error: PluginError; durationMs: number };

/** Runtime manager interface. */
export interface RuntimeManager {
  execute(
    descriptor: PluginDescriptor,
    inputs: Readonly<Record<string, unknown>>,
    options?: ExecuteOptions,
  ): Promise<PluginResult>;
}

/**
 * Read a plugin's output message from stdout.
 *
 * The SDK writes its message as the last thing on stdout, but a bundled
 * dependency may print above it, so whole-buffer parsing is tried first and
 * line scanning backwards is the fallback.
 */
function parsePluginOutput(stdout: string): PluginOutputMessage | undefined {
  const asMessage = (text: string): PluginOutputMessage | undefined => {
    try {
      const candidate: unknown = JSON.parse(text);
      if (
        typeof candidate === "object" &&
        candidate !== null &&
        "success" in candidate
      ) {
        return candidate as PluginOutputMessage;
      }
    } catch {
      // Not JSON; keep looking.
    }
    return undefined;
  };

  const whole = asMessage(stdout);
  if (whole !== undefined) return whole;

  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]!;
    if (line.trim() === "") continue;
    const candidate = asMessage(line);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
}

/** Create a runtime manager. */
export function createRuntimeManager(): RuntimeManager {
  return {
    async execute(descriptor, inputs, options = {}) {
      const adapter = getAdapter(descriptor.runtime);
      if (!adapter.isAvailable()) {
        return {
          success: false,
          error: {
            kind: "plugin-failed",
            message: new RuntimeNotAvailableError(
              descriptor.runtime,
              "binary not on PATH",
            ).message,
          },
          durationMs: 0,
        };
      }

      const { command, args } = adapter.buildCommand(descriptor.entry);
      const message: PluginInputMessage = { inputs };
      if (options.github !== undefined) {
        message.github = options.github;
      }
      const stdinData = JSON.stringify(message);

      const spawnOpts: SpawnOptions = {
        cwd: options.cwd ?? descriptor.dirPath,
        ...(options.env !== undefined ? { env: options.env } : {}),
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.killSignal !== undefined ? { killSignal: options.killSignal } : {}),
      };

      let result;
      try {
        result = await spawnProcess(command, args, stdinData, spawnOpts);
      } catch (err) {
        return {
          success: false,
          error: {
            kind: "plugin-failed",
            message: err instanceof Error ? err.message : String(err),
          },
          durationMs: 0,
        };
      }

      if (result.timedOut) {
        return {
          success: false,
          error: {
            kind: "timeout",
            timeoutMs: options.timeoutMs ?? 0,
          },
          durationMs: result.durationMs,
        };
      }

      if (result.signal !== null) {
        return {
          success: false,
          error: { kind: "signal-killed", signal: result.signal },
          durationMs: result.durationMs,
        };
      }

      const parsed = parsePluginOutput(result.stdout);

      // A structured failure outranks the exit code: plugins report errors this
      // way and then exit non-zero, and dropping the message is undebuggable.
      if (parsed !== undefined && parsed.success === false) {
        return {
          success: false,
          error: {
            kind: "plugin-failed",
            message: parsed.error?.message ?? "plugin reported failure without message",
          },
          durationMs: result.durationMs,
        };
      }

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: {
            kind: "non-zero-exit",
            exitCode: result.exitCode ?? -1,
            stderr: result.stderr,
          },
          durationMs: result.durationMs,
        };
      }

      if (parsed === undefined) {
        return {
          success: false,
          error: {
            kind: "invalid-output",
            raw: result.stdout,
            parseError: "stdout contained no plugin output message",
          },
          durationMs: result.durationMs,
        };
      }

      return {
        success: true,
        data: parsed.data ?? {},
        durationMs: result.durationMs,
      };
    },
  };
}
