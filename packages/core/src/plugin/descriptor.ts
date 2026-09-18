/**
 * Plugin descriptor types and plugin.yaml Zod schema.
 *
 * @packageDocumentation
 */

import { z } from "zod";

/** Supported plugin runtime types. */
export type RuntimeType = "python" | "node" | "shell" | "typescript" | "docker";

/** Input value type discriminator. */
export type InputValueType = "string" | "number" | "boolean" | "object" | "array";

/** Specification for a plugin input field. */
export interface InputSpec {
  required: boolean;
  type?: InputValueType | undefined;
  default?: unknown;
  description?: string | undefined;
}

/** Specification for a plugin output field. */
export interface OutputSpec {
  type?: InputValueType | undefined;
  description?: string | undefined;
}

/** Plugin descriptor (parsed plugin.yaml + resolved directory path). */
export interface PluginDescriptor {
  name: string;
  runtime: RuntimeType;
  entry: string;
  description?: string;
  inputs: Readonly<Record<string, InputSpec>>;
  outputs?: Readonly<Record<string, OutputSpec>>;
  setup?: string;
  dirPath: string;
}

/** Zod schema for the `inputs` field of plugin.yaml. */
export const InputSpecSchema = z.object({
  required: z.boolean().default(false),
  type: z.enum(["string", "number", "boolean", "object", "array"]).optional(),
  default: z.unknown().optional(),
  description: z.string().optional(),
});

/** Zod schema for the `outputs` field of plugin.yaml. */
export const OutputSpecSchema = z.object({
  type: z.enum(["string", "number", "boolean", "object", "array"]).optional(),
  description: z.string().optional(),
});

/** Zod schema for plugin.yaml. */
export const PluginYamlSchema = z.object({
  name: z.string().min(1),
  runtime: z.enum(["python", "node", "shell", "typescript", "docker"]),
  entry: z.string().min(1),
  description: z.string().optional(),
  inputs: z.record(z.string(), InputSpecSchema).default({}),
  outputs: z.record(z.string(), OutputSpecSchema).optional(),
  setup: z.string().optional(),
});

/** Type inferred from PluginYamlSchema (without dirPath). */
export type PluginYaml = z.infer<typeof PluginYamlSchema>;
