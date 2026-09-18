import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConfigFileNotFoundError,
  ConfigSyntaxError,
  ConfigValidationError,
} from "../errors/index.js";
import { createPluginRegistry } from "./registry.js";
import { createPluginLoader } from "./loader.js";

const VALID_PLUGIN_YAML = `
name: rss
runtime: node
entry: index.js
inputs:
  url:
    required: true
    type: string
`;

describe("PluginLoader", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bz-loader-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadPlugin", () => {
    it("loads a valid plugin directory", () => {
      const pluginDir = join(tmpDir, "rss");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "plugin.yaml"), VALID_PLUGIN_YAML);

      const loader = createPluginLoader();
      const d = loader.loadPlugin(pluginDir);
      expect(d.name).toBe("rss");
      expect(d.runtime).toBe("node");
      expect(d.entry).toBe("index.js");
      expect(d.dirPath).toBe(pluginDir);
      expect(d.inputs.url?.required).toBe(true);
    });

    it("registers into registry when provided", () => {
      const pluginDir = join(tmpDir, "rss");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "plugin.yaml"), VALID_PLUGIN_YAML);

      const reg = createPluginRegistry();
      const loader = createPluginLoader(reg);
      loader.loadPlugin(pluginDir);
      expect(reg.has("rss")).toBe(true);
    });

    it("throws ConfigFileNotFoundError when plugin.yaml missing", () => {
      const pluginDir = join(tmpDir, "empty");
      mkdirSync(pluginDir, { recursive: true });
      const loader = createPluginLoader();
      expect(() => loader.loadPlugin(pluginDir)).toThrow(ConfigFileNotFoundError);
    });

    it("throws ConfigSyntaxError on invalid YAML", () => {
      const pluginDir = join(tmpDir, "bad");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "plugin.yaml"), "name: [unclosed");
      const loader = createPluginLoader();
      expect(() => loader.loadPlugin(pluginDir)).toThrow(ConfigSyntaxError);
    });

    it("throws ConfigValidationError on invalid schema", () => {
      const pluginDir = join(tmpDir, "invalid");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "plugin.yaml"), "name: x\nruntime: ruby\nentry: e");
      const loader = createPluginLoader();
      expect(() => loader.loadPlugin(pluginDir)).toThrow(ConfigValidationError);
    });
  });

  describe("loadFromDir", () => {
    it("loads all valid plugin subdirectories", () => {
      for (const name of ["rss", "email"]) {
        const dir = join(tmpDir, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, "plugin.yaml"),
          `name: ${name}\nruntime: node\nentry: index.js\n`,
        );
      }
      const loader = createPluginLoader();
      const plugins = loader.loadFromDir(tmpDir);
      expect(plugins).toHaveLength(2);
      expect(plugins.map((p) => p.name).sort()).toEqual(["email", "rss"]);
    });

    it("skips subdirectories without plugin.yaml", () => {
      const rssDir = join(tmpDir, "rss");
      mkdirSync(rssDir, { recursive: true });
      writeFileSync(join(rssDir, "plugin.yaml"), VALID_PLUGIN_YAML);

      const noYamlDir = join(tmpDir, "not-a-plugin");
      mkdirSync(noYamlDir, { recursive: true });
      writeFileSync(join(noYamlDir, "README.md"), "not a plugin");

      const loader = createPluginLoader();
      const plugins = loader.loadFromDir(tmpDir);
      expect(plugins).toHaveLength(1);
      expect(plugins[0]?.name).toBe("rss");
    });

    it("skips non-directory entries", () => {
      writeFileSync(join(tmpDir, "stray.txt"), "text");
      const rssDir = join(tmpDir, "rss");
      mkdirSync(rssDir, { recursive: true });
      writeFileSync(join(rssDir, "plugin.yaml"), VALID_PLUGIN_YAML);

      const loader = createPluginLoader();
      const plugins = loader.loadFromDir(tmpDir);
      expect(plugins).toHaveLength(1);
    });

    it("returns empty array when directory does not exist", () => {
      const loader = createPluginLoader();
      const plugins = loader.loadFromDir(join(tmpDir, "nonexistent"));
      expect(plugins).toEqual([]);
    });

    it("continues loading after a broken plugin", () => {
      const goodDir = join(tmpDir, "good");
      mkdirSync(goodDir, { recursive: true });
      writeFileSync(join(goodDir, "plugin.yaml"), VALID_PLUGIN_YAML);

      const badDir = join(tmpDir, "bad");
      mkdirSync(badDir, { recursive: true });
      writeFileSync(join(badDir, "plugin.yaml"), "name: x\nruntime: ruby\nentry: e");

      const loader = createPluginLoader();
      const plugins = loader.loadFromDir(tmpDir);
      expect(plugins).toHaveLength(1);
      expect(plugins[0]?.name).toBe("rss");
    });
  });
});
