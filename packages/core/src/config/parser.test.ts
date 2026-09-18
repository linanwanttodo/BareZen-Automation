import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConfigFileNotFoundError,
  ConfigSyntaxError,
  ConfigValidationError,
} from "../errors/index.js";
import { createConfigParser } from "./parser.js";

const VALID_YAML = `
plugins:
  - rss
  - email

flows:
  daily-report:
    - plugin: rss
      output: news
    - plugin: email
      input: news
`;

describe("ConfigParser", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bz-cfg-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("parseString", () => {
    it("parses valid YAML into AutomationConfig", () => {
      const parser = createConfigParser();
      const cfg = parser.parseString(VALID_YAML);
      expect(cfg.plugins).toEqual(["rss", "email"]);
      expect(cfg.flows["daily-report"]).toHaveLength(2);
      expect(cfg.flows["daily-report"]?.[0]?.plugin).toBe("rss");
    });

    it("throws ConfigSyntaxError on invalid YAML", () => {
      const parser = createConfigParser();
      const bad = "plugins: [rss\n  - broken";
      expect(() => parser.parseString(bad, "bad.yml")).toThrow(ConfigSyntaxError);
    });

    it("throws ConfigSyntaxError on empty document", () => {
      const parser = createConfigParser();
      expect(() => parser.parseString("", "empty.yml")).toThrow(ConfigSyntaxError);
    });

    it("throws ConfigValidationError on missing plugins", () => {
      const parser = createConfigParser();
      const bad = `
flows:
  f:
    - plugin: rss
`;
      expect(() => parser.parseString(bad)).toThrow(ConfigValidationError);
    });

    it("throws ConfigValidationError on empty plugins list", () => {
      const parser = createConfigParser();
      const bad = `
plugins: []
flows:
  f:
    - plugin: rss
`;
      expect(() => parser.parseString(bad)).toThrow(ConfigValidationError);
    });

    it("throws ConfigValidationError on empty flow", () => {
      const parser = createConfigParser();
      const bad = `
plugins: [rss]
flows:
  f: []
`;
      expect(() => parser.parseString(bad)).toThrow(ConfigValidationError);
    });

    it("includes issues in ConfigValidationError context", () => {
      const parser = createConfigParser();
      try {
        parser.parseString("plugins: []\nflows: { f: [{ plugin: x }] }");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigValidationError);
        if (err instanceof ConfigValidationError) {
          expect(err.issues.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("parse", () => {
    it("parses a valid file", () => {
      const filePath = join(tmpDir, "automation.yml");
      writeFileSync(filePath, VALID_YAML);
      const parser = createConfigParser();
      const cfg = parser.parse(filePath);
      expect(cfg.plugins).toEqual(["rss", "email"]);
    });

    it("throws ConfigFileNotFoundError when file does not exist", () => {
      const parser = createConfigParser();
      expect(() => parser.parse(join(tmpDir, "missing.yml"))).toThrow(
        ConfigFileNotFoundError,
      );
    });

    it("throws ConfigSyntaxError when file has invalid YAML", () => {
      const filePath = join(tmpDir, "bad.yml");
      writeFileSync(filePath, "plugins: [rss\n  - broken");
      const parser = createConfigParser();
      expect(() => parser.parse(filePath)).toThrow(ConfigSyntaxError);
    });

    it("throws ConfigValidationError when file has invalid schema", () => {
      const filePath = join(tmpDir, "invalid.yml");
      writeFileSync(filePath, "plugins: []\nflows: {}");
      const parser = createConfigParser();
      expect(() => parser.parse(filePath)).toThrow(ConfigValidationError);
    });
  });
});
