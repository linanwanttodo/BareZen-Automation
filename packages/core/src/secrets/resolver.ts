/**
 * Secret resolver: identifies `${{ secrets.XXX }}` references and replaces
 * them with values from the environment, while tracking resolved values
 * for log masking.
 *
 * @packageDocumentation
 */

import { SecretNotFoundError } from "../errors/index.js";

/** Pattern matching `${{ secrets.NAME }}` references. */
const SECRET_REF_PATTERN = /\$\{\{\s*secrets\.(\w+)\s*\}\}/g;

/** Non-global pattern for `test()` (avoids lastIndex statefulness). */
const SECRET_REF_TEST_PATTERN = /\$\{\{\s*secrets\.(\w+)\s*\}\}/;

/** Environment source abstraction for testability. */
export interface EnvSource {
  get(name: string): string | undefined;
}

/** Default env source backed by `process.env`. */
const defaultEnvSource: EnvSource = {
  get: (name) => process.env[name],
};

/** Secret resolver interface. */
export interface SecretResolver {
  /** Recursively replace `${{ secrets.XXX }}` references in any value. */
  resolve<T>(value: T): T;
  /** Check whether a value contains any secret reference. */
  hasSecretReference(value: unknown): boolean;
  /** Mask known secret values in a log string with `***`. */
  mask(value: string): string;
  /** Set of resolved secret values (for masking). */
  readonly resolvedSecrets: ReadonlySet<string>;
}

/** Create a secret resolver. */
export function createSecretResolver(
  env: EnvSource = defaultEnvSource,
): SecretResolver {
  const resolvedSecrets = new Set<string>();

  function resolveString(str: string): string {
    return str.replace(SECRET_REF_PATTERN, (_match, name: string) => {
      const envValue = env.get(name);
      if (envValue === undefined) {
        throw new SecretNotFoundError(name);
      }
      if (envValue !== "") {
        resolvedSecrets.add(envValue);
      }
      return envValue;
    });
  }

  function resolveValue(value: unknown): unknown {
    if (typeof value === "string") {
      return resolveString(value);
    }
    if (Array.isArray(value)) {
      return value.map(resolveValue);
    }
    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = resolveValue(v);
      }
      return result;
    }
    return value;
  }

  function hasRef(value: unknown): boolean {
    if (typeof value === "string") {
      return SECRET_REF_TEST_PATTERN.test(value);
    }
    if (Array.isArray(value)) {
      return value.some(hasRef);
    }
    if (value !== null && typeof value === "object") {
      return Object.values(value).some(hasRef);
    }
    return false;
  }

  return {
    resolvedSecrets,

    resolve<T>(value: T): T {
      return resolveValue(value) as T;
    },

    hasSecretReference(value: unknown): boolean {
      return hasRef(value);
    },

    mask(value: string): string {
      let masked = value;
      for (const secret of resolvedSecrets) {
        if (secret.length > 0) {
          masked = masked.split(secret).join("***");
        }
      }
      return masked;
    },
  };
}
