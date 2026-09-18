/**
 * Binary availability check helper.
 *
 * @packageDocumentation
 */

import { spawnSync } from "node:child_process";

/**
 * Check whether a binary is available on PATH by running `--version`.
 * Returns true if the binary exits with code 0, false otherwise.
 */
export function isBinaryAvailable(command: string): boolean {
  try {
    const result = spawnSync(command, ["--version"], {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    return result.status === 0;
  } catch {
    return false;
  }
}
