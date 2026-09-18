import { describe, expect, it } from "vitest";
import { createCLI } from "./index.js";

describe("CLI", () => {
  it("createCLI returns a Command with name barezen", () => {
    const program = createCLI();
    expect(program.name()).toBe("barezen");
  });

  it("has version set", () => {
    const program = createCLI();
    expect(program.version()).toBe("0.1.0");
  });

  it("has run subcommand registered", () => {
    const program = createCLI();
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain("run");
  });

  it("run command has --config required option", () => {
    const program = createCLI();
    const runCmd = program.commands.find((c) => c.name() === "run");
    expect(runCmd).toBeDefined();
    const options = runCmd?.options.map((o) => o.long);
    expect(options).toContain("--config");
    expect(options).toContain("--flow");
    expect(options).toContain("--plugins");
    expect(options).toContain("--log-level");
  });
});
