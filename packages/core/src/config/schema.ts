/**
 * Zod schema definitions for the automation configuration file.
 *
 * @packageDocumentation
 */

import { z } from "zod";

/** Retry configuration for a flow step. */
export const RetryConfigSchema = z.object({
  maxAttempts: z.number().int().positive(),
  delayMs: z.number().nonnegative(),
});

/** A single step within a flow. */
export const FlowStepSchema = z.object({
  plugin: z.string().min(1),
  input: z.union([z.string(), z.record(z.string())]).optional(),
  output: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
  timeout: z.number().positive().optional(),
  continueOnError: z.boolean().optional(),
  retry: RetryConfigSchema.optional(),
  if: z.string().optional(),
});

/** Global settings applied to all flows unless overridden. */
export const GlobalSettingsSchema = z.object({
  defaultTimeout: z.number().positive().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
  pluginDir: z.string().optional(),
});

/** Root automation config schema. */
export const AutomationConfigSchema = z.object({
  plugins: z.array(z.string().min(1)).min(1),
  flows: z.record(z.string(), z.array(FlowStepSchema).min(1)),
  settings: GlobalSettingsSchema.optional(),
});

/** Inferred TypeScript types from the Zod schemas. */
export type RetryConfig = z.infer<typeof RetryConfigSchema>;
export type FlowStep = z.infer<typeof FlowStepSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
export type AutomationConfig = z.infer<typeof AutomationConfigSchema>;
