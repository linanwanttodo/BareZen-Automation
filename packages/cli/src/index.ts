/**
 * BareZen Automation CLI.
 *
 * @packageDocumentation
 */

import { Command, type Command as CommandType } from "commander";
import { registerRunCommand } from "./commands/run.js";

/** CLI version (matches package.json). */
const CLI_VERSION = "0.1.0";

/** Create the CLI program. */
export function createCLI(): CommandType {
  const program = new Command();
  program
    .name("barezen")
    .version(CLI_VERSION)
    .description("Plugin-Driven Automation Runtime for GitHub Actions");
  registerRunCommand(program);
  return program;
}

/** CLI entry point. */
export async function main(argv: readonly string[] = process.argv): Promise<void> {
  const program = createCLI();
  await program.parseAsync(argv);
}
