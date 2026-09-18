import { describe, expect, it } from "vitest";
import { getAdapter, runtimeAdapters } from "./index.js";
import { nodeAdapter } from "./node.js";
import { pythonAdapter } from "./python.js";
import { shellAdapter } from "./shell.js";
import { typescriptAdapter } from "./typescript.js";

describe("RuntimeAdapters", () => {
  describe("pythonAdapter", () => {
    it("builds python command", () => {
      expect(pythonAdapter.buildCommand("main.py")).toEqual({
        command: "python",
        args: ["main.py"],
      });
    });
    it("has type python", () => {
      expect(pythonAdapter.type).toBe("python");
    });
  });

  describe("nodeAdapter", () => {
    it("builds node command", () => {
      expect(nodeAdapter.buildCommand("index.js")).toEqual({
        command: "node",
        args: ["index.js"],
      });
    });
    it("has type node", () => {
      expect(nodeAdapter.type).toBe("node");
    });
  });

  describe("shellAdapter", () => {
    it("builds bash command", () => {
      expect(shellAdapter.buildCommand("run.sh")).toEqual({
        command: "bash",
        args: ["run.sh"],
      });
    });
    it("has type shell", () => {
      expect(shellAdapter.type).toBe("shell");
    });
  });

  describe("typescriptAdapter", () => {
    it("builds npx tsx command", () => {
      expect(typescriptAdapter.buildCommand("index.ts")).toEqual({
        command: "npx",
        args: ["tsx", "index.ts"],
      });
    });
    it("has type typescript", () => {
      expect(typescriptAdapter.type).toBe("typescript");
    });
  });

  describe("runtimeAdapters registry", () => {
    it("contains all runtime types", () => {
      expect(Object.keys(runtimeAdapters).sort()).toEqual([
        "docker",
        "node",
        "python",
        "shell",
        "typescript",
      ]);
    });

    it("getAdapter returns the correct adapter", () => {
      expect(getAdapter("python")).toBe(pythonAdapter);
      expect(getAdapter("node")).toBe(nodeAdapter);
      expect(getAdapter("shell")).toBe(shellAdapter);
      expect(getAdapter("typescript")).toBe(typescriptAdapter);
    });

    it("docker adapter throws on buildCommand", () => {
      expect(() => runtimeAdapters.docker.buildCommand("x")).toThrow();
      expect(runtimeAdapters.docker.isAvailable()).toBe(false);
    });
  });

  describe("isAvailable", () => {
    it("returns a boolean without throwing", () => {
      expect(typeof pythonAdapter.isAvailable()).toBe("boolean");
      expect(typeof nodeAdapter.isAvailable()).toBe("boolean");
      expect(typeof shellAdapter.isAvailable()).toBe("boolean");
      expect(typeof typescriptAdapter.isAvailable()).toBe("boolean");
    });
  });
});
