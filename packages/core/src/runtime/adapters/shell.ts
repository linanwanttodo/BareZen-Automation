import type { RuntimeAdapter } from "./types.js";
import { isBinaryAvailable } from "./available.js";

export const shellAdapter: RuntimeAdapter = {
  type: "shell",
  buildCommand(entry) {
    return { command: "bash", args: [entry] };
  },
  isAvailable() {
    return isBinaryAvailable("bash") || isBinaryAvailable("sh");
  },
};
