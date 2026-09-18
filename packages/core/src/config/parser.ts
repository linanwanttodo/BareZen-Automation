/**
 * YAML configuration parser with schema validation.
 *
 * @packageDocumentation
 */

import { readFileSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import {
  ConfigFileNotFoundError,
  ConfigSyntaxError,
  ConfigValidationError,
} from "../errors/index.js";
import { AutomationConfigSchema, type AutomationConfig } from "./schema.js";

/** Config parser interface. */
export interface ConfigParser {
  parse(filePath: string): AutomationConfig;
  parseString(content: string, source?: string): AutomationConfig;
}

/** Create a config parser. */
export function createConfigParser(): ConfigParser {
  return {
    parse(filePath) {
      if (!existsSync(filePath)) {
        throw new ConfigFileNotFoundError(filePath);
      }
      const content = readFileSync(filePath, "utf8");
      return this.parseString(content, filePath);
    },

    parseString(content, source = "<string>") {
      let raw: unknown;
      try {
        raw = parseYaml(content);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ConfigSyntaxError(source, message, { cause: err });
      }

      if (raw === null || raw === undefined) {
        throw new ConfigSyntaxError(source, "empty document");
      }

      const result = AutomationConfigSchema.safeParse(raw);
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
          `Config validation failed: ${summary}`,
          issues,
          { cause: result.error },
        );
      }

      return result.data;
    },
  };
}
