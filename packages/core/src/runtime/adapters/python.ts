import type { RuntimeAdapter } from "./types.js";
import { isBinaryAvailable } from "./available.js";

export const pythonAdapter: RuntimeAdapter = {
  type: "python",
  buildCommand(entry) {
    return { command: "python", args: [entry] };
  },
  isAvailable() {
    return isBinaryAvailable("python") || isBinaryAvailable("python3");
  },
};
