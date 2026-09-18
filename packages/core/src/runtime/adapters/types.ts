/**
 * Runtime adapter types.
 *
 * @packageDocumentation
 */

import type { RuntimeType } from "../../plugin/descriptor.js";

/** A command to execute. */
export interface RuntimeCommand {
  command: string;
  args: readonly string[];
}

/** Adapter for a specific runtime. */
export interface RuntimeAdapter {
  /** The runtime type this adapter handles. */
  readonly type: RuntimeType;
  /** Build the command to execute the given entry file. */
  buildCommand(entry: string): RuntimeCommand;
  /** Check whether the runtime is available on the host. */
  isAvailable(): boolean;
}
