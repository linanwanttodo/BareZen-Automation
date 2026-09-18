import type { RuntimeAdapter } from "./types.js";
import { isBinaryAvailable } from "./available.js";

export const nodeAdapter: RuntimeAdapter = {
  type: "node",
  buildCommand(entry) {
    return { command: "node", args: [entry] };
  },
  isAvailable() {
    return isBinaryAvailable("node");
  },
};
