import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PluginDescriptor } from "../plugin/descriptor.js";
import { createRuntimeManager } from "./manager.js";

function makeNodeDescriptor(dirPath: string, entry: string): PluginDescriptor {
  return {
    name: "test-plugin",
    runtime: "node",
    entry,
    inputs: {},
    dirPath,
  };
}

describe("RuntimeManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bz-rt-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns success:true when plugin outputs success", async () => {
    const entry = join(tmpDir, "ok.js");
    writeFileSync(
      entry,
      "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{process.stdout.write(JSON.stringify({success:true,data:{score:100}}))})",
    );
    const mgr = createRuntimeManager();
    const result = await mgr.execute(makeNodeDescriptor(tmpDir, "ok.js"), { x: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ score: 100 });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns success:false when plugin outputs failure", async () => {
    const entry = join(tmpDir, "fail.js");
    writeFileSync(
      entry,
      "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{process.stdout.write(JSON.stringify({success:false,error:{message:'bad cookie'}}))})",
    );
    const mgr = createRuntimeManager();
    const result = await mgr.execute(makeNodeDescriptor(tmpDir, "fail.js"), {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.kind).toBe("plugin-failed");
      if (result.error.kind === "plugin-failed") {
        expect(result.error.message).toBe("bad cookie");
      }
    }
  });

  it("returns non-zero-exit error when plugin exits non-zero", async () => {
    const entry = join(tmpDir, "exit.js");
    writeFileSync(entry, "process.stderr.write('boom');process.exit(2)");
    const mgr = createRuntimeManager();
    const result = await mgr.execute(makeNodeDescriptor(tmpDir, "exit.js"), {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.kind).toBe("non-zero-exit");
      if (result.error.kind === "non-zero-exit") {
        expect(result.error.exitCode).toBe(2);
        expect(result.error.stderr).toBe("boom");
      }
    }
  });

  it("returns invalid-output error when stdout is not JSON", async () => {
    const entry = join(tmpDir, "bad.js");
    writeFileSync(entry, "process.stdout.write('not json')");
    const mgr = createRuntimeManager();
    const result = await mgr.execute(makeNodeDescriptor(tmpDir, "bad.js"), {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.kind).toBe("invalid-output");
      if (result.error.kind === "invalid-output") {
        expect(result.error.raw).toBe("not json");
      }
    }
  });

  it("returns timeout error when plugin exceeds timeout", async () => {
    const entry = join(tmpDir, "slow.js");
    writeFileSync(entry, "setInterval(()=>{},1000)");
    const mgr = createRuntimeManager();
    const result = await mgr.execute(makeNodeDescriptor(tmpDir, "slow.js"), {}, {
      timeoutMs: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.kind).toBe("timeout");
    }
  });

  it("passes inputs to the plugin via stdin", async () => {
    const entry = join(tmpDir, "echo.js");
    writeFileSync(
      entry,
      "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const m=JSON.parse(d);process.stdout.write(JSON.stringify({success:true,data:{echoed:m.inputs}}))})",
    );
    const mgr = createRuntimeManager();
    const result = await mgr.execute(makeNodeDescriptor(tmpDir, "echo.js"), { foo: "bar" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ echoed: { foo: "bar" } });
    }
  });

  it("returns plugin-failed when success:false has no error message", async () => {
    const entry = join(tmpDir, "nofail.js");
    writeFileSync(
      entry,
      "process.stdout.write(JSON.stringify({success:false}))",
    );
    const mgr = createRuntimeManager();
    const result = await mgr.execute(makeNodeDescriptor(tmpDir, "nofail.js"), {});
    expect(result.success).toBe(false);
    if (!result.success && result.error.kind === "plugin-failed") {
      expect(result.error.message).toContain("failure");
    }
  });

  it("defaults data to {} when success:true omits data", async () => {
    const entry = join(tmpDir, "nodata.js");
    writeFileSync(entry, "process.stdout.write(JSON.stringify({success:true}))");
    const mgr = createRuntimeManager();
    const result = await mgr.execute(makeNodeDescriptor(tmpDir, "nodata.js"), {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });
});
