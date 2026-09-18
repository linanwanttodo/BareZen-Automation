/**
 * Runtime adapter registry.
 *
 * @packageDocumentation
 */

import type { RuntimeType } from "../../plugin/descriptor.js";
import type { RuntimeAdapter } from "./types.js";
import { nodeAdapter } from "./node.js";
import { pythonAdapter } from "./python.js";
import { shellAdapter } from "./shell.js";
import { typescriptAdapter } from "./typescript.js";

/** Map of runtime type → adapter. */
export const runtimeAdapters: Readonly<Record<RuntimeType, RuntimeAdapter>> = {
  python: pythonAdapter,
  node: nodeAdapter,
  shell: shellAdapter,
  typescript: typescriptAdapter,
  docker: {
    type: "docker",
    buildCommand: () => {
      throw new Error("docker runtime is not yet implemented");
    },
    isAvailable: () => false,
  },
};

/** Get the adapter for a runtime type. */
export function getAdapter(type: RuntimeType): RuntimeAdapter {
  return runtimeAdapters[type] as RuntimeAdapter;
}
