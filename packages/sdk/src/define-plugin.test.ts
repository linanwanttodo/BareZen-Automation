import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** Run a plugin script with given stdin and capture stdout. */
function runPlugin(
  script: string,
  stdin: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn("node", ["--input-type=module", "-e", script], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: join(process.cwd(), "packages", "sdk"),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c: string) => (stdout += c));
    child.stderr.on("data", (c: string) => (stderr += c));
    child.on("close", (code) => resolve({ stdout, stderr, exitCode: code }));
    child.stdin.end(stdin);
  });
}

const SDK_IMPORT = `
const { definePlugin } = await import('@barezen/sdk');
const { z } = await import('zod');
`;

describe("definePlugin", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bz-sdk-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("outputs success JSON when run returns", async () => {
    const script = `${SDK_IMPORT}
definePlugin({
  name: "test",
  inputs: z.object({ x: z.number() }),
  async run(ctx) {
    return { doubled: ctx.inputs.x * 2 };
  },
});
`;
    const result = await runPlugin(script, JSON.stringify({ inputs: { x: 21 } }));
    const out = JSON.parse(result.stdout);
    expect(out.success).toBe(true);
    expect(out.data).toEqual({ doubled: 42 });
  });

  it("outputs failure JSON on input validation error", async () => {
    const script = `${SDK_IMPORT}
definePlugin({
  name: "test",
  inputs: z.object({ url: z.string().url() }),
  async run() { return {}; },
});
`;
    const result = await runPlugin(script, JSON.stringify({ inputs: { url: "not-a-url" } }));
    const out = JSON.parse(result.stdout);
    expect(out.success).toBe(false);
    expect(out.error.code).toBe("INPUT_VALIDATION_ERROR");
    expect(result.exitCode).toBe(1);
  });

  it("outputs failure JSON when run throws", async () => {
    const script = `${SDK_IMPORT}
definePlugin({
  name: "test",
  inputs: z.object({}),
  async run() { throw new Error("boom"); },
});
`;
    const result = await runPlugin(script, JSON.stringify({ inputs: {} }));
    const out = JSON.parse(result.stdout);
    expect(out.success).toBe(false);
    expect(out.error.message).toBe("boom");
    expect(result.exitCode).toBe(1);
  });

  it("passes github context to ctx.github", async () => {
    const script = `${SDK_IMPORT}
definePlugin({
  name: "test",
  inputs: z.object({}),
  async run(ctx) {
    return { event: ctx.github?.eventName ?? "none" };
  },
});
`;
    const stdin = JSON.stringify({
      inputs: {},
      github: { eventName: "push", repository: "o/r", ref: "r", sha: "s", actor: "a", workspace: "/", payload: { type: "unknown", raw: {} }, serverUrl: "https://github.com", apiBaseUrl: "https://api.github.com" },
    });
    const result = await runPlugin(script, stdin);
    const out = JSON.parse(result.stdout);
    expect(out.success).toBe(true);
    expect(out.data).toEqual({ event: "push" });
  });

  it("logger writes to stderr", async () => {
    const script = `${SDK_IMPORT}
definePlugin({
  name: "test",
  inputs: z.object({}),
  async run(ctx) {
    ctx.logger.info("hello from plugin");
    return { ok: true };
  },
});
`;
    const result = await runPlugin(script, JSON.stringify({ inputs: {} }));
    expect(result.stderr).toContain("[INFO] hello from plugin");
  });
});
