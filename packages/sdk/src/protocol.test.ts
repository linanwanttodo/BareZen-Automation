import { describe, expect, it } from "vitest";
import { writeOutput, type PluginOutputMessage } from "./protocol.js";

describe("protocol", () => {
  describe("writeOutput", () => {
    it("writes success message as JSON to stdout", () => {
      const chunks: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
        return true;
      }) as typeof process.stdout.write;
      try {
        writeOutput({ success: true, data: { x: 1 } });
      } finally {
        process.stdout.write = originalWrite;
      }
      expect(chunks.join("")).toBe(JSON.stringify({ success: true, data: { x: 1 } }));
    });

    it("writes failure message as JSON to stdout", () => {
      const chunks: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
        return true;
      }) as typeof process.stdout.write;
      try {
        const msg: PluginOutputMessage = {
          success: false,
          error: { message: "bad", code: "E_BAD" },
        };
        writeOutput(msg);
      } finally {
        process.stdout.write = originalWrite;
      }
      expect(chunks.join("")).toContain('"success":false');
      expect(chunks.join("")).toContain('"message":"bad"');
    });
  });

  describe("types", () => {
    it("PluginOutputMessage discriminates on success", () => {
      const ok: PluginOutputMessage = { success: true, data: {} };
      const err: PluginOutputMessage = {
        success: false,
        error: { message: "x" },
      };
      expect(ok.success).toBe(true);
      expect(err.success).toBe(false);
    });
  });
});
