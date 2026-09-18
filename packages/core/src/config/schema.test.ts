import { describe, expect, it } from "vitest";
import {
  AutomationConfigSchema,
  FlowStepSchema,
  RetryConfigSchema,
} from "./schema.js";

describe("RetryConfigSchema", () => {
  it("accepts valid retry config", () => {
    expect(RetryConfigSchema.parse({ maxAttempts: 3, delayMs: 100 }).success).not.toBe(false);
  });

  it("rejects non-positive maxAttempts", () => {
    expect(() => RetryConfigSchema.parse({ maxAttempts: 0, delayMs: 100 })).toThrow();
  });

  it("rejects non-integer maxAttempts", () => {
    expect(() => RetryConfigSchema.parse({ maxAttempts: 1.5, delayMs: 100 })).toThrow();
  });

  it("rejects negative delayMs", () => {
    expect(() => RetryConfigSchema.parse({ maxAttempts: 1, delayMs: -1 })).toThrow();
  });
});

describe("FlowStepSchema", () => {
  it("accepts minimal step with only plugin", () => {
    expect(FlowStepSchema.parse({ plugin: "rss" })).toEqual({ plugin: "rss" });
  });

  it("accepts full step with all fields", () => {
    const step = {
      plugin: "ai-summary",
      input: "news",
      output: "summary",
      inputs: { model: "gpt-4" },
      timeout: 5000,
      continueOnError: true,
      retry: { maxAttempts: 3, delayMs: 100 },
      if: "github.event_name == 'push'",
    };
    expect(FlowStepSchema.parse(step)).toEqual(step);
  });

  it("accepts input as record of strings", () => {
    const step = { plugin: "email", input: { to: "user@example.com", from: "bot" } };
    expect(FlowStepSchema.parse(step)).toEqual(step);
  });

  it("rejects empty plugin name", () => {
    expect(() => FlowStepSchema.parse({ plugin: "" })).toThrow();
  });

  it("rejects non-positive timeout", () => {
    expect(() => FlowStepSchema.parse({ plugin: "rss", timeout: 0 })).toThrow();
    expect(() => FlowStepSchema.parse({ plugin: "rss", timeout: -1 })).toThrow();
  });
});

describe("AutomationConfigSchema", () => {
  it("accepts valid minimal config", () => {
    const cfg = {
      plugins: ["rss"],
      flows: {
        "daily-report": [{ plugin: "rss" }],
      },
    };
    expect(AutomationConfigSchema.parse(cfg)).toEqual(cfg);
  });

  it("accepts config with settings", () => {
    const cfg = {
      plugins: ["rss", "email"],
      flows: {
        flow: [{ plugin: "rss", output: "news" }],
      },
      settings: { defaultTimeout: 10000, logLevel: "debug", pluginDir: "./plugins" },
    };
    expect(AutomationConfigSchema.parse(cfg)).toEqual(cfg);
  });

  it("rejects empty plugins array", () => {
    expect(() =>
      AutomationConfigSchema.parse({ plugins: [], flows: { f: [{ plugin: "x" }] } }),
    ).toThrow();
  });

  it("rejects empty plugin name in plugins list", () => {
    expect(() =>
      AutomationConfigSchema.parse({ plugins: [""], flows: { f: [{ plugin: "x" }] } }),
    ).toThrow();
  });

  it("rejects empty flow step array", () => {
    expect(() =>
      AutomationConfigSchema.parse({ plugins: ["x"], flows: { f: [] } }),
    ).toThrow();
  });

  it("rejects missing plugins field", () => {
    expect(() => AutomationConfigSchema.parse({ flows: { f: [{ plugin: "x" }] } })).toThrow();
  });

  it("rejects missing flows field", () => {
    expect(() => AutomationConfigSchema.parse({ plugins: ["x"] })).toThrow();
  });

  it("rejects invalid logLevel", () => {
    expect(() =>
      AutomationConfigSchema.parse({
        plugins: ["x"],
        flows: { f: [{ plugin: "x" }] },
        settings: { logLevel: "trace" },
      }),
    ).toThrow();
  });

  it("produces a typed AutomationConfig with flows as a record", () => {
    const cfg = AutomationConfigSchema.parse({
      plugins: ["rss"],
      flows: {
        "daily-report": [{ plugin: "rss", output: "news" }],
        "weekly-report": [{ plugin: "rss", output: "news" }],
      },
    });
    expect(Object.keys(cfg.flows).sort()).toEqual(["daily-report", "weekly-report"]);
  });
});
