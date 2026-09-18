/**
 * Structured Logger for BareZen Automation.
 *
 * Integrates with `@actions/core` when running inside GitHub Actions,
 * and falls back to formatted console output for local development/testing.
 *
 * @packageDocumentation
 */

import * as actionsCore from "@actions/core";

/** Supported log severity levels, ordered from most to least verbose. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Structured metadata attached to log messages. */
export type LogMeta = Readonly<Record<string, unknown>>;

/** Logger interface. */
export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  child(scope: string): Logger;
  group(name: string): void;
  groupEnd(): void;
}

/** Numeric weight for level comparison. */
const LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Detect whether we are running inside GitHub Actions. */
function isActionsEnv(): boolean {
  return process.env.GITHUB_ACTIONS === "true";
}

/** Format a message with optional scope prefix and metadata suffix. */
function formatMessage(message: string, scope: string | undefined, meta: LogMeta | undefined): string {
  const prefix = scope !== undefined && scope !== "" ? `[${scope}] ` : "";
  const suffix = meta !== undefined && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
  return `${prefix}${message}${suffix}`;
}

/** Console sink abstraction for testability. */
export interface ConsoleSink {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  group(name: string): void;
  groupEnd(): void;
}

/** Default console sink using the global `console`. */
const defaultConsoleSink: ConsoleSink = {
  debug: (msg) => console.log(msg),
  info: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
  group: (name) => {
    console.log(`┌ ${name}`);
  },
  groupEnd: () => {
    console.log("└");
  },
};

/** Actions sink using `@actions/core`. */
const actionsSink: ConsoleSink = {
  debug: (msg) => actionsCore.debug(msg),
  info: (msg) => actionsCore.info(msg),
  warn: (msg) => actionsCore.warning(msg),
  error: (msg) => actionsCore.error(msg),
  group: (name) => actionsCore.startGroup(name),
  groupEnd: () => actionsCore.endGroup(),
};

/** Configuration for constructing a Logger. */
export interface LoggerOptions {
  /** Minimum level to emit. Defaults to `info`. */
  level?: LogLevel;
  /** Scope prefix (typically a plugin or module name). */
  scope?: string;
  /** Override the environment detection (mainly for tests). */
  forceActionsEnv?: boolean;
  /** Override the console sink (mainly for tests). */
  sink?: ConsoleSink;
}

/**
 * Create a structured Logger.
 *
 * @example
 * ```ts
 * const log = createLogger({ level: "debug", scope: "rss" });
 * log.info("Fetching feed", { url });
 * log.group("fetch");
 * // ... work ...
 * log.groupEnd();
 * ```
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const level: LogLevel = options.level ?? "info";
  const scope = options.scope;
  const inActions = options.forceActionsEnv ?? isActionsEnv();
  const sink: ConsoleSink = options.sink ?? (inActions ? actionsSink : defaultConsoleSink);
  const minWeight = LEVEL_WEIGHT[level];

  function shouldEmit(l: LogLevel): boolean {
    return LEVEL_WEIGHT[l] >= minWeight;
  }

  function emit(l: LogLevel, message: string, meta: LogMeta | undefined): void {
    if (!shouldEmit(l)) return;
    const formatted = formatMessage(message, scope, meta);
    switch (l) {
      case "debug":
        sink.debug(formatted);
        break;
      case "info":
        sink.info(formatted);
        break;
      case "warn":
        sink.warn(formatted);
        break;
      case "error":
        sink.error(formatted);
        break;
    }
  }

  return {
    debug: (m, meta) => emit("debug", m, meta),
    info: (m, meta) => emit("info", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta),
    child: (childScope) =>
      createLogger({
        level,
        scope: scope !== undefined && scope !== "" ? `${scope}:${childScope}` : childScope,
        forceActionsEnv: inActions,
        sink,
      }),
    group: (name) => sink.group(formatMessage(name, scope, undefined)),
    groupEnd: () => sink.groupEnd(),
  };
}

/** A no-op logger that discards all output. Useful for tests. */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
  group: () => {},
  groupEnd: () => {},
};
