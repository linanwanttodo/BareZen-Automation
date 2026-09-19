/**
 * Step executor: resolves step inputs, invokes the runtime manager,
 * and stores outputs into the flow context.
 *
 * @packageDocumentation
 */

import { FlowContextKeyNotFoundError } from "../errors/index.js";
import type { FlowStep } from "../config/schema.js";
import type { PluginRegistry } from "../plugin/registry.js";
import type { RuntimeManager, PluginResult } from "../runtime/manager.js";
import type { FlowContext } from "./context.js";

/** Result of a single step execution. */
export interface StepResult {
  index: number;
  plugin: string;
  result: PluginResult;
  outputKey?: string;
}

/** Step executor interface. */
export interface StepExecutor {
  execute(
    step: FlowStep,
    index: number,
    context: FlowContext,
    registry: PluginRegistry,
  ): Promise<StepResult>;
}

/** Options for a step executor. */
export interface StepExecutorOptions {
  /** Applied to steps that do not declare their own `timeout`. */
  defaultTimeoutMs?: number;
}

/** Create a step executor. */
export function createStepExecutor(
  runtimeManager: RuntimeManager,
  executorOptions: StepExecutorOptions = {},
): StepExecutor {
  return {
    async execute(step, index, context, registry) {
      const descriptor = registry.get(step.plugin);
      if (descriptor === undefined) {
        return {
          index,
          plugin: step.plugin,
          result: {
            success: false,
            error: {
              kind: "plugin-failed",
              message: `Plugin not found: ${step.plugin}`,
            },
            durationMs: 0,
          },
        };
      }

      let inputs: Record<string, unknown>;
      try {
        inputs = resolveInputs(step, context, descriptor);
      } catch (err) {
        return {
          index,
          plugin: step.plugin,
          result: {
            success: false,
            error: {
              kind: "plugin-failed",
              message: err instanceof Error ? err.message : String(err),
            },
            durationMs: 0,
          },
        };
      }

      const requiredMissing = checkRequiredInputs(descriptor, inputs);
      if (requiredMissing.length > 0) {
        return {
          index,
          plugin: step.plugin,
          result: {
            success: false,
            error: {
              kind: "plugin-failed",
              message: `Missing required inputs: ${requiredMissing.join(", ")}`,
            },
            durationMs: 0,
          },
        };
      }

      const timeoutMs = step.timeout ?? executorOptions.defaultTimeoutMs;
      const options = {
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
        github: context.getGitHub(),
      };

      const result = await runtimeManager.execute(descriptor, inputs, options);

      if (result.success && step.output !== undefined) {
        context.setOutput(step.output, result.data);
      }

      return {
        index,
        plugin: step.plugin,
        result,
        ...(step.output !== undefined ? { outputKey: step.output } : {}),
      };
    },
  };
}

/** Match a `.segment` or `[n]` path component. */
const PATH_SEGMENT = /([^.[\]]+)|\[(\d+)\]/g;

/**
 * Resolve a context reference, which may address a nested value:
 * `news`, `news.articles`, or `news.articles[0].title`.
 */
export function resolveContextRef(context: FlowContext, ref: string): unknown {
  const segments: (string | number)[] = [];
  for (const match of ref.matchAll(PATH_SEGMENT)) {
    if (match[1] !== undefined) {
      segments.push(match[1]);
    } else if (match[2] !== undefined) {
      segments.push(Number(match[2]));
    }
  }

  const root = segments[0];
  if (typeof root !== "string" || !context.has(root)) {
    throw new FlowContextKeyNotFoundError(ref, context.flowName);
  }

  let cursor: unknown = context.getInput(root);
  for (const segment of segments.slice(1)) {
    if (cursor === null || typeof cursor !== "object") {
      throw new FlowContextKeyNotFoundError(ref, context.flowName);
    }
    const value = (cursor as Record<string | number, unknown>)[segment];
    if (value === undefined) {
      throw new FlowContextKeyNotFoundError(ref, context.flowName);
    }
    cursor = value;
  }
  return cursor;
}

/** Resolve a step's inputs from its config, the flow context and plugin defaults. */
function resolveInputs(
  step: FlowStep,
  context: FlowContext,
  descriptor: { inputs: Readonly<Record<string, { default?: unknown }>> },
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  if (step.inputs !== undefined) {
    for (const [k, v] of Object.entries(step.inputs)) {
      resolved[k] = v;
    }
  }

  if (step.input !== undefined) {
    if (typeof step.input === "string") {
      resolved["input"] = resolveContextRef(context, step.input);
    } else {
      for (const [k, ref] of Object.entries(step.input)) {
        resolved[k] = resolveContextRef(context, ref);
      }
    }
  }

  for (const [k, spec] of Object.entries(descriptor.inputs)) {
    if (!(k in resolved) && spec.default !== undefined) {
      resolved[k] = spec.default;
    }
  }

  return resolved;
}

/** Check for missing required inputs. */
function checkRequiredInputs(
  descriptor: { inputs: Readonly<Record<string, { required?: boolean }>> },
  inputs: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const [k, spec] of Object.entries(descriptor.inputs)) {
    if (spec.required === true && !(k in inputs)) {
      missing.push(k);
    }
  }
  return missing;
}
