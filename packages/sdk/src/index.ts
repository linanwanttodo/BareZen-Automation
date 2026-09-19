/**
 * BareZen Automation TypeScript Plugin SDK.
 *
 * @packageDocumentation
 */

export { definePlugin } from "./define-plugin.js";
export type { PluginDefinition } from "./define-plugin.js";
export {
  type PluginContext,
  type PluginLogger,
  type SecretAccessor,
  createPluginLogger,
  createSecretAccessor,
} from "./context.js";
export {
  type PluginInputMessage,
  type PluginOutputMessage,
  type PluginOutputSuccess,
  type PluginOutputFailure,
  readInput,
  writeOutput,
} from "./protocol.js";
export {
  DEFAULT_HTTP_TIMEOUT_MS,
  fetchJson,
  fetchWithTimeout,
} from "./http.js";
export { splitText } from "./text.js";
