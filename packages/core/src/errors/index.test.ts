import { describe, expect, it } from "vitest";
import {
  BareZenError,
  ConfigFileNotFoundError,
  ConfigSyntaxError,
  ConfigValidationError,
  Errors,
  ErrorKind,
  FlowContextKeyNotFoundError,
  isBareZenError,
  PluginConflictError,
  PluginNotFoundError,
  RuntimeNotAvailableError,
  SecretNotFoundError,
} from "./index.js";

describe("BareZenError", () => {
  describe("abstract base class", () => {
    it("cannot be meaningfully instantiated directly (abstract)", () => {
      // Abstract at type-level; at runtime `code`/`kind` are undefined,
      // which proves the class is not meant to be used directly.
      // @ts-expect-error - abstract class
      const err = new BareZenError("x");
      expect((err as { code?: string }).code).toBeUndefined();
      expect((err as { kind?: string }).kind).toBeUndefined();
    });

    it("preserves instanceof chain for subclasses", () => {
      const err = new ConfigFileNotFoundError("/tmp/x.yml");
      expect(err).toBeInstanceOf(ConfigFileNotFoundError);
      expect(err).toBeInstanceOf(BareZenError);
      expect(err).toBeInstanceOf(Error);
    });

    it("sets name to the concrete class name", () => {
      const err = new SecretNotFoundError("TOKEN");
      expect(err.name).toBe("SecretNotFoundError");
    });
  });

  describe("ConfigFileNotFoundError", () => {
    it("exposes stable code and kind", () => {
      const err = new ConfigFileNotFoundError("/path/to/automation.yml");
      expect(err.code).toBe("CONFIG_FILE_NOT_FOUND");
      expect(err.kind).toBe(ErrorKind.Config);
      expect(err.path).toBe("/path/to/automation.yml");
      expect(err.message).toContain("/path/to/automation.yml");
    });

    it("supports cause option", () => {
      const root = new Error("fs error");
      const err = new ConfigFileNotFoundError("/x", { cause: root });
      expect(err.cause).toBe(root);
    });
  });

  describe("ConfigSyntaxError", () => {
    it("carries path and message", () => {
      const err = new ConfigSyntaxError("/c.yml", "bad indentation at line 3");
      expect(err.code).toBe("CONFIG_SYNTAX_ERROR");
      expect(err.kind).toBe(ErrorKind.Config);
      expect(err.path).toBe("/c.yml");
      expect(err.message).toContain("bad indentation at line 3");
    });
  });

  describe("ConfigValidationError", () => {
    it("stores issues in context", () => {
      const issues = [{ path: "flows", message: "required" }] as const;
      const err = new ConfigValidationError("missing flows", issues);
      expect(err.code).toBe("CONFIG_VALIDATION_ERROR");
      expect(err.kind).toBe(ErrorKind.Config);
      expect(err.issues).toBe(issues);
      expect(err.context?.issues).toBe(issues);
    });
  });

  describe("PluginNotFoundError", () => {
    it("exposes pluginName", () => {
      const err = new PluginNotFoundError("rss");
      expect(err.code).toBe("PLUGIN_NOT_FOUND");
      expect(err.kind).toBe(ErrorKind.Plugin);
      expect(err.pluginName).toBe("rss");
    });
  });

  describe("PluginConflictError", () => {
    it("exposes both paths", () => {
      const err = new PluginConflictError("rss", "/a", "/b");
      expect(err.code).toBe("PLUGIN_CONFLICT");
      expect(err.kind).toBe(ErrorKind.Plugin);
      expect(err.existingPath).toBe("/a");
      expect(err.incomingPath).toBe("/b");
      expect(err.message).toContain("/a");
      expect(err.message).toContain("/b");
    });
  });

  describe("SecretNotFoundError", () => {
    it("exposes secretName", () => {
      const err = new SecretNotFoundError("API_KEY");
      expect(err.code).toBe("SECRET_NOT_FOUND");
      expect(err.kind).toBe(ErrorKind.Secret);
      expect(err.secretName).toBe("API_KEY");
    });
  });

  describe("FlowContextKeyNotFoundError", () => {
    it("exposes key and flowName", () => {
      const err = new FlowContextKeyNotFoundError("news", "daily-report");
      expect(err.code).toBe("FLOW_CONTEXT_KEY_NOT_FOUND");
      expect(err.kind).toBe(ErrorKind.Flow);
      expect(err.key).toBe("news");
      expect(err.flowName).toBe("daily-report");
    });
  });

  describe("RuntimeNotAvailableError", () => {
    it("exposes runtime and reason", () => {
      const err = new RuntimeNotAvailableError("python", "binary not on PATH");
      expect(err.code).toBe("RUNTIME_NOT_AVAILABLE");
      expect(err.kind).toBe(ErrorKind.Runtime);
      expect(err.runtime).toBe("python");
      expect(err.reason).toBe("binary not on PATH");
    });
  });

  describe("isBareZenError", () => {
    it("returns true for BareZenError instances", () => {
      expect(isBareZenError(new SecretNotFoundError("X"))).toBe(true);
    });

    it("returns false for plain Errors and non-errors", () => {
      expect(isBareZenError(new Error("plain"))).toBe(false);
      expect(isBareZenError("string")).toBe(false);
      expect(isBareZenError(null)).toBe(false);
      expect(isBareZenError(undefined)).toBe(false);
      expect(isBareZenError({})).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("serializes to a plain object", () => {
      const err = new SecretNotFoundError("X");
      const json = err.toJSON();
      expect(json).toEqual({
        name: "SecretNotFoundError",
        code: "SECRET_NOT_FOUND",
        kind: "Secret",
        message: err.message,
      });
    });

    it("includes context when present", () => {
      const issues = [{ path: "x" }] as const;
      const err = new ConfigValidationError("msg", issues);
      const json = err.toJSON();
      expect(json.context).toEqual({ issues });
    });
  });

  describe("Errors namespace", () => {
    it("re-exports all classes", () => {
      expect(Errors.BareZenError).toBe(BareZenError);
      expect(Errors.ConfigFileNotFoundError).toBe(ConfigFileNotFoundError);
      expect(Errors.RuntimeNotAvailableError).toBe(RuntimeNotAvailableError);
    });
  });
});
