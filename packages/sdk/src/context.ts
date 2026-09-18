/**
 * Plugin execution context passed to `run`.
 *
 * @packageDocumentation
 */

import type { GitHubContext } from "@barezen/core";

/** Logger that writes to stderr (so it doesn't corrupt stdout JSON protocol). */
export interface PluginLogger {
  debug(message: string, meta?: Readonly<Record<string, unknown>>): void;
  info(message: string, meta?: Readonly<Record<string, unknown>>): void;
  warn(message: string, meta?: Readonly<Record<string, unknown>>): void;
  error(message: string, meta?: Readonly<Record<string, unknown>>): void;
}

/** Secret accessor for plugins to read environment-injected secrets. */
export interface SecretAccessor {
  /** Get a secret by name. Returns undefined if not set. */
  get(name: string): string | undefined;
  /** Check whether a secret is set. */
  has(name: string): boolean;
  /** Require a secret, throwing if missing. */
  require(name: string): string;
}

/** Context passed to a plugin's `run` function. */
export interface PluginContext<TInputs extends Readonly<Record<string, unknown>>> {
  /** Validated inputs. */
  inputs: TInputs;
  /** Logger writing to stderr. */
  logger: PluginLogger;
  /** Secret accessor. */
  secrets: SecretAccessor;
  /** GitHub Actions context (if running inside Actions). */
  github?: GitHubContext;
}

/** Create a stderr-based plugin logger. */
export function createPluginLogger(): PluginLogger {
  function write(level: string, message: string, meta?: Readonly<Record<string, unknown>>): void {
    const suffix = meta !== undefined && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    process.stderr.write(`[${level}] ${message}${suffix}\n`);
  }
  return {
    debug: (m, meta) => write("DEBUG", m, meta),
    info: (m, meta) => write("INFO", m, meta),
    warn: (m, meta) => write("WARN", m, meta),
    error: (m, meta) => write("ERROR", m, meta),
  };
}

/** Create a secret accessor backed by `process.env`. */
export function createSecretAccessor(env: NodeJS.ProcessEnv = process.env): SecretAccessor {
  return {
    get: (name) => env[name],
    has: (name) => env[name] !== undefined,
    require: (name) => {
      const v = env[name];
      if (v === undefined) {
        throw new Error(`Required secret not found: ${name}`);
      }
      return v;
    },
  };
}
