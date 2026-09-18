/**
 * Step executor: resolves step inputs, invokes the runtime manager,
 * and stores outputs into the flow context.
 *
 * @packageDocumentation
 */

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

/** Create a step executor. */
export function createStepExecutor(
  runtimeManager: RuntimeManager,
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

      const inputs = resolveInputs(step, context, descriptor);

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

      const options = {
        ...(step.timeout !== undefined ? { timeoutMs: step.timeout } : {}),
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

/** Resolve inputs by merging direct values and context references. */
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
      const value = context.getInput(step.input);
      resolved["input"] = value;
    } else {
      for (const [k, refKey] of Object.entries(step.input)) {
        resolved[k] = context.getInput(refKey);
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
