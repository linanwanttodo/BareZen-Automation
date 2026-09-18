import type { RuntimeAdapter } from "./types.js";
import { isBinaryAvailable } from "./available.js";

export const typescriptAdapter: RuntimeAdapter = {
  type: "typescript",
  buildCommand(entry) {
    return { command: "npx", args: ["tsx", entry] };
  },
  isAvailable() {
    return isBinaryAvailable("npx");
  },
};
