/**
 * Plugin loader: scans plugin directories, parses plugin.yaml, and
 * optionally registers descriptors into a registry.
 *
 * @packageDocumentation
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  ConfigFileNotFoundError,
  ConfigSyntaxError,
  ConfigValidationError,
} from "../errors/index.js";
import type { Logger } from "../logger/logger.js";
import { silentLogger } from "../logger/logger.js";
import {
  type PluginDescriptor,
  type PluginYaml,
  PluginYamlSchema,
} from "./descriptor.js";
import type { PluginRegistry } from "./registry.js";

/** Plugin loader interface. */
export interface PluginLoader {
  /** Scan a directory and load all plugins found in its subdirectories. */
  loadFromDir(dirPath: string): PluginDescriptor[];
  /** Load a single plugin from a directory containing plugin.yaml. */
  loadPlugin(pluginDir: string): PluginDescriptor;
}

/** Create a plugin loader. */
export function createPluginLoader(
  registry?: PluginRegistry,
  logger: Logger = silentLogger,
): PluginLoader {
  function parsePluginYaml(filePath: string): PluginYaml {
    if (!existsSync(filePath)) {
      throw new ConfigFileNotFoundError(filePath);
    }
    let raw: unknown;
    try {
      raw = parseYaml(readFileSync(filePath, "utf8"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ConfigSyntaxError(filePath, message, { cause: err });
    }
    if (raw === null || raw === undefined) {
      throw new ConfigSyntaxError(filePath, "empty document");
    }
    const result = PluginYamlSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path.map(String).join("."),
        code: i.code,
        message: i.message,
      }));
      const summary = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new ConfigValidationError(
        `plugin.yaml validation failed: ${summary}`,
        issues,
        { cause: result.error },
      );
    }
    return result.data;
  }

  return {
    loadPlugin(pluginDir) {
      const yamlPath = join(pluginDir, "plugin.yaml");
      const parsed = parsePluginYaml(yamlPath);
      const descriptor: PluginDescriptor = {
        name: parsed.name,
        runtime: parsed.runtime,
        entry: parsed.entry,
        inputs: parsed.inputs,
        dirPath: pluginDir,
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.outputs !== undefined ? { outputs: parsed.outputs } : {}),
        ...(parsed.setup !== undefined ? { setup: parsed.setup } : {}),
      };
      if (registry !== undefined) {
        registry.register(descriptor);
      }
      return descriptor;
    },

    loadFromDir(dirPath) {
      const results: PluginDescriptor[] = [];
      if (!existsSync(dirPath)) {
        logger.warn(`Plugin directory not found: ${dirPath}`);
        return results;
      }
      let entries: string[];
      try {
        entries = readdirSync(dirPath);
      } catch (err) {
        logger.warn(
          `Failed to read plugin directory ${dirPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return results;
      }

      for (const entry of entries) {
        const subDir = join(dirPath, entry);
        try {
          if (!statSync(subDir).isDirectory()) continue;
        } catch {
          continue;
        }
        const yamlPath = join(subDir, "plugin.yaml");
        if (!existsSync(yamlPath)) {
          logger.debug(`Skipping subdirectory without plugin.yaml: ${subDir}`);
          continue;
        }
        try {
          const descriptor = this.loadPlugin(subDir);
          results.push(descriptor);
          logger.info(`Loaded plugin: ${descriptor.name} from ${subDir}`);
        } catch (err) {
          logger.warn(
            `Failed to load plugin from ${subDir}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      return results;
    },
  };
}
