/**
 * BareZen Error Type System
 *
 * All framework errors extend the abstract {@link BareZenError} base class.
 * Each error carries a stable `code` (machine-readable) and `kind` (category)
 * to support programmatic handling, logging, and GitHub Actions error annotations.
 *
 * @packageDocumentation
 */

/**
 * Abstract base class for all BareZen framework errors.
 *
 * Concrete subclasses must declare a stable `code` (unique string identifier)
 * and a `kind` (logical category) for programmatic discrimination.
 *
 * @example
 * ```ts
 * try {
 *   await runFlow(config);
 * } catch (err) {
 *   if (err instanceof BareZenError) {
 *     core.setFailed(`${err.kind}/${err.code}: ${err.message}`);
 *   }
 * }
 * ```
 */
export abstract class BareZenError extends Error {
  /** Stable machine-readable error code (unique per concrete class). */
  public abstract readonly code: string;

  /** Logical error category for grouping and filtering. */
  public abstract readonly kind: string;

  /**
   * Optional structured context attached to the error.
   * Used for rich logging and GitHub Actions error annotations.
   */
  public readonly context?: Readonly<Record<string, unknown>>;

  public constructor(
    message: string,
    options?: {
      context?: Readonly<Record<string, unknown>>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    if (options?.context !== undefined) {
      this.context = options.context;
    }
    // Restore prototype chain after Error subclassing (TS strict + ES2022).
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize to a plain object suitable for JSON logging or IPC.
   */
  public toJSON(): {
    name: string;
    code: string;
    kind: string;
    message: string;
    context?: Readonly<Record<string, unknown>>;
  } {
    return {
      name: this.name,
      code: this.code,
      kind: this.kind,
      message: this.message,
      ...(this.context !== undefined ? { context: this.context } : {}),
    };
  }
}

/** Error kind constants for consistency across concrete classes. */
export const ErrorKind = {
  Config: "Config",
  Plugin: "Plugin",
  Secret: "Secret",
  Flow: "Flow",
  Runtime: "Runtime",
} as const;

export type ErrorKindValue = (typeof ErrorKind)[keyof typeof ErrorKind];

/**
 * Thrown when the automation config file cannot be located on disk.
 */
export class ConfigFileNotFoundError extends BareZenError {
  public readonly code = "CONFIG_FILE_NOT_FOUND";
  public readonly kind = ErrorKind.Config;

  public constructor(
    public readonly path: string,
    options?: { cause?: unknown },
  ) {
    super(`Configuration file not found: ${path}`, options);
  }
}

/**
 * Thrown when the config file exists but cannot be parsed (invalid YAML syntax).
 */
export class ConfigSyntaxError extends BareZenError {
  public readonly code = "CONFIG_SYNTAX_ERROR";
  public readonly kind = ErrorKind.Config;

  public constructor(
    public readonly path: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(`Failed to parse configuration file "${path}": ${message}`, options);
  }
}

/**
 * Thrown when the config parses successfully but fails schema validation.
 */
export class ConfigValidationError extends BareZenError {
  public readonly code = "CONFIG_VALIDATION_ERROR";
  public readonly kind = ErrorKind.Config;

  public constructor(
    message: string,
    public readonly issues: readonly Readonly<Record<string, unknown>>[],
    options?: { cause?: unknown },
  ) {
    super(message, {
      context: { issues },
      ...(options?.cause !== undefined ? { cause: options.cause } : {}),
    });
  }
}

/**
 * Thrown when a referenced plugin name cannot be resolved in the registry.
 */
export class PluginNotFoundError extends BareZenError {
  public readonly code = "PLUGIN_NOT_FOUND";
  public readonly kind = ErrorKind.Plugin;

  public constructor(
    public readonly pluginName: string,
    options?: { cause?: unknown },
  ) {
    super(`Plugin not found in registry: "${pluginName}"`, options);
  }
}

/**
 * Thrown when two plugins with the same name are registered.
 */
export class PluginConflictError extends BareZenError {
  public readonly code = "PLUGIN_CONFLICT";
  public readonly kind = ErrorKind.Plugin;

  public constructor(
    public readonly pluginName: string,
    public readonly existingPath: string,
    public readonly incomingPath: string,
    options?: { cause?: unknown },
  ) {
    super(
      `Plugin name conflict: "${pluginName}" is already registered from "${existingPath}", cannot register from "${incomingPath}"`,
      options,
    );
  }
}

/**
 * Thrown when a `${{ secrets.XXX }}` reference cannot be resolved in environment.
 */
export class SecretNotFoundError extends BareZenError {
  public readonly code = "SECRET_NOT_FOUND";
  public readonly kind = ErrorKind.Secret;

  public constructor(
    public readonly secretName: string,
    options?: { cause?: unknown },
  ) {
    super(`Secret not found in environment: "${secretName}"`, options);
  }
}

/**
 * Thrown when a flow step references an output key not present in the flow context.
 */
export class FlowContextKeyNotFoundError extends BareZenError {
  public readonly code = "FLOW_CONTEXT_KEY_NOT_FOUND";
  public readonly kind = ErrorKind.Flow;

  public constructor(
    public readonly key: string,
    public readonly flowName: string,
    options?: { cause?: unknown },
  ) {
    super(
      `Flow context key "${key}" not found in flow "${flowName}"`,
      options,
    );
  }
}

/**
 * Thrown when a plugin declares a `runtime` that is not available on the host
 * (e.g. `python` runtime but `python` binary not on PATH).
 */
export class RuntimeNotAvailableError extends BareZenError {
  public readonly code = "RUNTIME_NOT_AVAILABLE";
  public readonly kind = ErrorKind.Runtime;

  public constructor(
    public readonly runtime: string,
    public readonly reason: string,
    options?: { cause?: unknown },
  ) {
    super(
      `Runtime "${runtime}" is not available: ${reason}`,
      options,
    );
  }
}

/**
 * Type guard: narrow an unknown value to {@link BareZenError}.
 */
export function isBareZenError(value: unknown): value is BareZenError {
  return value instanceof BareZenError;
}

/**
 * Re-export all error classes as a namespace for ergonomic imports.
 */
export const Errors = {
  BareZenError,
  ConfigFileNotFoundError,
  ConfigSyntaxError,
  ConfigValidationError,
  PluginNotFoundError,
  PluginConflictError,
  SecretNotFoundError,
  FlowContextKeyNotFoundError,
  RuntimeNotAvailableError,
} as const;
