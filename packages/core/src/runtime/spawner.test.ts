import { describe, expect, it } from "vitest";
import { spawnProcess } from "./spawner.js";

describe("spawnProcess", () => {
  it("captures stdout from a simple command", async () => {
    const result = await spawnProcess("node", ["-e", "process.stdout.write('hello')"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello");
    expect(result.timedOut).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("captures stderr", async () => {
    const result = await spawnProcess("node", ["-e", "process.stderr.write('warn')"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("warn");
  });

  it("passes stdin to the child process", async () => {
    const result = await spawnProcess(
      "node",
      ["-e", "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(d.toUpperCase()))"],
      "abc",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ABC");
  });

  it("returns non-zero exit code on failure", async () => {
    const result = await spawnProcess("node", ["-e", "process.exit(3)"]);
    expect(result.exitCode).toBe(3);
  });

  it("never leaks an uncaught stdin error across concurrent immediate-exit children", async () => {
    const uncaught: unknown[] = [];
    const collect = (err: unknown) => {
      uncaught.push(err);
    };
    process.on("uncaughtException", collect);
    try {
      const payload = JSON.stringify({ inputs: { value: "x".repeat(4096) } });
      const results = await Promise.all(
        Array.from({ length: 200 }, () =>
          spawnProcess("bash", ["-c", "exit 0"], payload),
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(results.every((r) => r.exitCode === 0)).toBe(true);
    } finally {
      process.off("uncaughtException", collect);
    }
    expect(uncaught).toEqual([]);
  });

  it("kills the process on timeout", async () => {
    const result = await spawnProcess(
      "node",
      ["-e", "setInterval(()=>{},1000)"],
      undefined,
      { timeoutMs: 100 },
    );
    expect(result.timedOut).toBe(true);
    expect(result.signal).toBe("SIGTERM");
  });

  it("bounds wall time when a grandchild inherits the pipes", async () => {
    const start = Date.now();
    const result = await spawnProcess(
      "bash",
      ["-c", "sleep 5 & wait"],
      undefined,
      { timeoutMs: 200 },
    );
    const elapsedMs = Date.now() - start;
    expect(result.timedOut).toBe(true);
    expect(elapsedMs).toBeLessThan(2000);
  });

  it("respects cwd option", async () => {
    const result = await spawnProcess("node", ["-e", "process.stdout.write(process.cwd())"], undefined, {
      cwd: "/tmp",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("/tmp");
  });

  it("respects env option", async () => {
    const result = await spawnProcess(
      "node",
      ["-e", "process.stdout.write(process.env.FOO ?? 'unset')"],
      undefined,
      { env: { ...process.env, FOO: "bar" } },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("bar");
  });

  it("rejects when command does not exist", async () => {
    await expect(
      spawnProcess("nonexistent-command-xyz", []),
    ).rejects.toThrow();
  });
});
