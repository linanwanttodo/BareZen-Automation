/**
 * Plugin registry: maintains a name → descriptor mapping.
 *
 * @packageDocumentation
 */

import {
  PluginConflictError,
  PluginNotFoundError,
} from "../errors/index.js";
import type { PluginDescriptor } from "./descriptor.js";

/** Plugin registry interface. */
export interface PluginRegistry {
  register(descriptor: PluginDescriptor): void;
  get(name: string): PluginDescriptor | undefined;
  has(name: string): boolean;
  list(): PluginDescriptor[];
  resolve(names: readonly string[]): PluginDescriptor[];
  clear(): void;
  readonly size: number;
}

/** Create an empty plugin registry. */
export function createPluginRegistry(): PluginRegistry {
  const plugins = new Map<string, PluginDescriptor>();

  return {
    register(descriptor) {
      const existing = plugins.get(descriptor.name);
      if (existing !== undefined) {
        throw new PluginConflictError(
          descriptor.name,
          existing.dirPath,
          descriptor.dirPath,
        );
      }
      plugins.set(descriptor.name, descriptor);
    },

    get(name) {
      return plugins.get(name);
    },

    has(name) {
      return plugins.has(name);
    },

    list() {
      return [...plugins.values()];
    },

    resolve(names) {
      const result: PluginDescriptor[] = [];
      for (const name of names) {
        const d = plugins.get(name);
        if (d === undefined) {
          throw new PluginNotFoundError(name);
        }
        result.push(d);
      }
      return result;
    },

    clear() {
      plugins.clear();
    },

    get size() {
      return plugins.size;
    },
  };
}
