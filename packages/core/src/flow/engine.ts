/**
 * Flow engine: executes a sequence of steps, handling conditions,
 * failure policies, and retries.
 *
 * @packageDocumentation
 */

import type { FlowStep } from "../config/schema.js";
import type { GitHubContext } from "../github/context.js";
import type { Logger } from "../logger/logger.js";
import { silentLogger } from "../logger/logger.js";
import type { PluginRegistry } from "../plugin/registry.js";
import type { RuntimeManager } from "../runtime/manager.js";
import { createFlowContext, type FlowContext } from "./context.js";
import { evaluateExpression } from "./expression.js";
import {
  createStepExecutor,
  type StepExecutorOptions,
  type StepResult,
} from "./step.js";

/** Result of a flow execution. */
export interface FlowResult {
  flowName: string;
  success: boolean;
  steps: StepResult[];
  durationMs: number;
  error?: { stepIndex: number; message: string };
}

/** Flow engine interface. */
export interface FlowEngine {
  execute(
    flowName: string,
    steps: readonly FlowStep[],
    registry: PluginRegistry,
    githubContext: GitHubContext,
  ): Promise<FlowResult>;
}

/** Create a flow engine. */
export function createFlowEngine(
  runtimeManager: RuntimeManager,
  logger: Logger = silentLogger,
  stepOptions: StepExecutorOptions = {},
): FlowEngine {
  const stepExecutor = createStepExecutor(runtimeManager, stepOptions);

  return {
    async execute(flowName, steps, registry, githubContext) {
      const start = Date.now();
      const context: FlowContext = createFlowContext(flowName, githubContext);
      const results: StepResult[] = [];

      logger.info(`Starting flow: ${flowName}`);
      logger.group(flowName);

      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i]!;
        const stepLabel = `[${i}] ${step.plugin}`;

        const gate =
          step.if !== undefined
            ? evaluateExpression(step.if, buildScope(githubContext, context))
            : undefined;

        if (gate !== undefined && gate.success && !gate.value) {
          logger.info(`Skipping step ${stepLabel} (condition false)`);
          continue;
        }

        logger.info(`Executing step ${stepLabel}`);

        const result =
          gate !== undefined && !gate.success
            ? {
                index: i,
                plugin: step.plugin,
                result: {
                  success: false as const,
                  error: {
                    kind: "plugin-failed" as const,
                    message: `Invalid 'if' expression: ${gate.error}`,
                  },
                  durationMs: 0,
                },
              }
            : await executeWithRetry(
                stepExecutor,
                step,
                i,
                context,
                registry,
                logger,
              );
        results.push(result);

        if (!result.result.success) {
          const errMsg = result.result.success
            ? ""
            : "error" in result.result
              ? JSON.stringify(result.result.error)
              : "";
          logger.warn(`Step ${stepLabel} failed: ${errMsg}`);

          if (!step.continueOnError) {
            logger.groupEnd();
            logger.error(`Flow ${flowName} aborted at step ${i}`);
            return {
              flowName,
              success: false,
              steps: results,
              durationMs: Date.now() - start,
              error: {
                stepIndex: i,
                message: errMsg,
              },
            };
          }
        } else {
          logger.info(`Step ${stepLabel} completed`);
        }
      }

      logger.groupEnd();
      logger.info(`Flow ${flowName} completed`);

      const allSuccess = results.every((r) => r.result.success);
      return {
        flowName,
        success: allSuccess,
        steps: results,
        durationMs: Date.now() - start,
      };
    },
  };
}

/** Execute a step with retry logic. */
async function executeWithRetry(
  stepExecutor: ReturnType<typeof createStepExecutor>,
  step: FlowStep,
  index: number,
  context: FlowContext,
  registry: PluginRegistry,
  logger: Logger,
): Promise<StepResult> {
  const maxAttempts = step.retry?.maxAttempts ?? 1;
  const delayMs = step.retry?.delayMs ?? 0;

  let lastResult: StepResult;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      logger.info(`Retry attempt ${attempt}/${maxAttempts}`);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
    lastResult = await stepExecutor.execute(step, index, context, registry);
    if (lastResult.result.success) {
      return lastResult;
    }
  }
  return lastResult!;
}

/** Names an `if` expression may reference: the GitHub context plus step outputs. */
function buildScope(github: GitHubContext, context: FlowContext): Record<string, unknown> {
  const scope: Record<string, unknown> = { github };
  for (const key of context.keys()) {
    scope[key] = context.getInput(key);
  }
  return scope;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
