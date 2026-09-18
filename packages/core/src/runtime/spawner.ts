/**
 * Process spawner: runs a child process with stdin input, timeout control,
 * and captures stdout/stderr.
 *
 * @packageDocumentation
 */

import { spawn, type ChildProcess } from "node:child_process";

/** Options for spawning a process. */
export interface SpawnOptions {
  /** Working directory. */
  cwd?: string;
  /** Environment variables (defaults to process.env). */
  env?: Readonly<Record<string, string | undefined>>;
  /** Timeout in milliseconds. Defaults to no timeout. */
  timeoutMs?: number;
  /** Kill signal on timeout. Defaults to SIGTERM. */
  killSignal?: NodeJS.Signals;
}

/** Result of a spawned process. */
export interface SpawnResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

/** Error thrown when a process fails. */
export class SpawnError extends Error {
  public constructor(
    public readonly result: SpawnResult,
    message?: string,
  ) {
    super(
      message ??
        `Process exited with code ${result.exitCode} signal ${result.signal}`,
    );
    this.name = "SpawnError";
  }
}

/**
 * Spawn a child process, write stdin data, and collect output.
 *
 * @example
 * ```ts
 * const result = await spawnProcess("node", ["-e", "process.stdout.write(JSON.stringify(JSON.parse(require('fs').readFileSync(0,'utf8'))))"], '{"x":1}', { timeoutMs: 5000 });
 * console.log(result.stdout); // '{"x":1}'
 * ```
 */
export function spawnProcess(
  command: string,
  args: readonly string[],
  stdinData?: string,
  options: SpawnOptions = {},
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child: ChildProcess = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;
    let settled = false;

    const finish = (result: SpawnResult) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(result);
    };

    if (child.stdout !== null) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
    }
    if (child.stderr !== null) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
    }

    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill(options.killSignal ?? "SIGTERM");
      }, options.timeoutMs);
    }

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code, signal) => {
      finish({
        exitCode: code,
        signal: signal as NodeJS.Signals | null,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - start,
      });
    });

    if (child.stdin !== null) {
      // A child that exits before this write lands closes the pipe's read end,
      // making the resulting EPIPE unactionable: exit code and stderr carry the
      // real signal, so it must not surface as an uncaught stream error.
      child.stdin.on("error", () => {});
      child.stdin.end(stdinData);
    }
  });
}
