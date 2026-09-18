/**
 * `definePlugin` — the main entry point for TypeScript plugins.
 *
 * Handles stdin reading, input validation via Zod, execution, and
 * JSON output writing. Plugins only need to declare their schema and
 * a `run` function.
 *
 * @packageDocumentation
 */

import type { z } from "zod";
import {
  createPluginLogger,
  createSecretAccessor,
  type PluginContext,
} from "./context.js";
import { readInput, writeOutput } from "./protocol.js";

/** A plugin definition. */
export interface PluginDefinition<
  TInputs extends z.ZodType,
  TOutputs extends Readonly<Record<string, unknown>>,
> {
  /** Plugin name (for logging). */
  name: string;
  /** Zod schema for validating inputs. */
  inputs: TInputs;
  /** Execute the plugin. */
  run(ctx: PluginContext<z.infer<TInputs>>): Promise<TOutputs> | TOutputs;
}

/**
 * Define a plugin and run it immediately.
 *
 * Reads stdin, validates inputs, calls `run`, and writes the result to stdout.
 * On validation failure or exception, writes a failure message and exits with
 * code 1.
 *
 * @example
 * ```ts
 * export default definePlugin({
 *   name: "rss",
 *   inputs: z.object({ url: z.string() }),
 *   async run(ctx) {
 *     const feed = await fetch(ctx.inputs.url);
 *     return { articles: await feed.json() };
 *   },
 * });
 * ```
 */
export function definePlugin<
  TInputs extends z.ZodType,
  TOutputs extends Readonly<Record<string, unknown>>,
>(definition: PluginDefinition<TInputs, TOutputs>): void {
  const logger = createPluginLogger();
  const secrets = createSecretAccessor();

  readInput()
    .then(async (message) => {
      const parseResult = definition.inputs.safeParse(message.inputs);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        writeOutput({
          success: false,
          error: {
            message: `Input validation failed: ${firstIssue?.message ?? "unknown"}`,
            code: "INPUT_VALIDATION_ERROR",
            details: {
              issues: parseResult.error.issues.map((i) => ({
                path: i.path.map(String).join("."),
                message: i.message,
              })),
            },
          },
        });
        process.exit(1);
      }

      const ctx: PluginContext<z.infer<TInputs>> = {
        inputs: parseResult.data,
        logger,
        secrets,
        ...(message.github !== undefined ? { github: message.github } : {}),
      };

      try {
        const data = await definition.run(ctx);
        writeOutput({ success: true, data });
      } catch (err) {
        writeOutput({
          success: false,
          error: {
            message: err instanceof Error ? err.message : String(err),
            code: err instanceof Error && "code" in err ? String(err.code) : "PLUGIN_ERROR",
          },
        });
        process.exit(1);
      }
    })
    .catch((err: unknown) => {
      writeOutput({
        success: false,
        error: {
          message: `Failed to read input: ${err instanceof Error ? err.message : String(err)}`,
          code: "INPUT_READ_ERROR",
        },
      });
      process.exit(1);
    });
}
