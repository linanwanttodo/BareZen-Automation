/**
 * `barezen run` command: orchestrates the full automation pipeline.
 *
 *!@packageDocumentation
 */

import * as actionsCore from "@actions/core";
import type { Command } from "commander";
import {
  type AutomationConfig,
  type FlowResult,
  type PluginDescriptor,
  type PluginLoader,
  type PluginRegistry,
  createConfigParser,
  createFlowEngine,
  createGitHubContextProvider,
  createLogger,
  createPluginLoader,
  createPluginRegistry,
  createRuntimeManager,
  createSecretResolver,
} from "@barezen/core";

export interface RunOptions {
  config: string;
  flow?: string;
  plugins?: string;
  logLevel?: "debug" | "info" | "warn" | "error";
}

/** Default plugin directory name. */
const DEFAULT_PLUGIN_DIR = "plugins";
const DEFAULT_LOG_LEVEL = "info" as const;

/** Split a comma-separated `--plugins` value into directory roots. */
export function splitPluginDirs(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Load plugins from several roots into a registry. Later roots win on name
 * collisions, letting a local plugin shadow a built-in one without tripping the
 * registry's conflict error.
 *
 * @returns the number of distinct plugins registered.
 */
export function loadPluginsFromDirs(
  dirs: readonly string[],
  registry: PluginRegistry,
  loader: PluginLoader,
): number {
  const byName = new Map<string, PluginDescriptor>();
  for (const dir of dirs) {
    for (const descriptor of loader.loadFromDir(dir)) {
      byName.set(descriptor.name, descriptor);
    }
  }
  for (const descriptor of byName.values()) {
    registry.register(descriptor);
  }
  return byName.size;
}

/** Register the `run` subcommand on a commander Command. */
export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Run an automation config file")
    .requiredOption("-c, --config <path>", "Path to automation.yml")
    .option("-f, --flow <name>", "Execute only the specified flow")
    .option(
      "-p, --plugins <dirs>",
      "Comma-separated plugin directories; later roots win (default: plugins)",
      DEFAULT_PLUGIN_DIR,
    )
    .option(
      "-l, --log-level <level>",
      "Log level: debug | info | warn | error",
      DEFAULT_LOG_LEVEL,
    )
    .action(async (opts: RunOptions) => {
      const exitCode = await runAutomation(opts);
      process.exit(exitCode);
    });
}

/** Execute the automation pipeline. Returns exit code (0 = success, 1 = failure). */
export async function runAutomation(options: RunOptions): Promise<number> {
  const logLevel = options.logLevel ?? DEFAULT_LOG_LEVEL;
  const logger = createLogger({ level: logLevel, scope: "cli" });

  try {
    // 1. GitHub context
    const githubProvider = createGitHubContextProvider();
    const githubCtx = githubProvider.provide();
    logger.debug(`GitHub context: ${githubCtx.eventName} @ ${githubCtx.repository}`);

    // 2. Parse config
    const configParser = createConfigParser();
    const config: AutomationConfig = configParser.parse(options.config);
    logger.info(`Loaded config with ${config.plugins.length} plugins, ${Object.keys(config.flows).length} flows`);

    // 3. Resolve secrets in config
    const secretResolver = createSecretResolver();
    const resolvedConfig = secretResolver.resolve(config);

    // 4. Load plugins
    const pluginDirs = splitPluginDirs(options.plugins ?? DEFAULT_PLUGIN_DIR);
    const registry = createPluginRegistry();
    const loader = createPluginLoader(undefined, logger);
    const pluginCount = loadPluginsFromDirs(pluginDirs, registry, loader);
    logger.info(
      `Loaded ${pluginCount} plugins from ${pluginDirs.length} root(s): ${pluginDirs.join(", ")}`,
    );

    // 5. Resolve required plugins
    registry.resolve(resolvedConfig.plugins);

    // 6. Execute flows
    const runtimeManager = createRuntimeManager();
    const flowEngine = createFlowEngine(runtimeManager, logger);

    const flowNames =
      options.flow !== undefined
        ? [options.flow]
        : Object.keys(resolvedConfig.flows);

    const results: FlowResult[] = [];
    for (const flowName of flowNames) {
      const steps = resolvedConfig.flows[flowName];
      if (steps === undefined) {
        logger.warn(`Flow not found: ${flowName}`);
        results.push({
          flowName,
          success: false,
          steps: [],
          durationMs: 0,
          error: { stepIndex: -1, message: "flow not found" },
        });
        continue;
      }
      const result = await flowEngine.execute(flowName, steps, registry, githubCtx);
      results.push(result);
    }

    // 7. Output summary
    const summary = {
      flows: results.map((r) => ({
        name: r.flowName,
        success: r.success,
        durationMs: r.durationMs,
        steps: r.steps.length,
      })),
      success: results.every((r) => r.success),
    };
    actionsCore.setOutput("result", JSON.stringify(summary));
    logger.info(`Automation complete: ${summary.success ? "success" : "failure"}`);

    return summary.success ? 0 : 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Automation failed: ${message}`);
    actionsCore.setFailed(message);
    return 1;
  }
}
