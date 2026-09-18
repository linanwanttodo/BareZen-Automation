import { describe, expect, it } from "vitest";
import { InputSpecSchema, OutputSpecSchema, PluginYamlSchema } from "./descriptor.js";

describe("InputSpecSchema", () => {
  it("accepts full input spec", () => {
    const r = InputSpecSchema.parse({
      required: true,
      type: "string",
      default: "x",
      description: "cookie",
    });
    expect(r).toEqual({
      required: true,
      type: "string",
      default: "x",
      description: "cookie",
    });
  });

  it("defaults required to false when omitted", () => {
    const r = InputSpecSchema.parse({});
    expect(r.required).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(() => InputSpecSchema.parse({ type: "bigint" })).toThrow();
  });
});

describe("OutputSpecSchema", () => {
  it("accepts empty object", () => {
    expect(OutputSpecSchema.parse({})).toEqual({});
  });

  it("accepts type and description", () => {
    expect(OutputSpecSchema.parse({ type: "object", description: "result" })).toEqual({
      type: "object",
      description: "result",
    });
  });
});

describe("PluginYamlSchema", () => {
  it("accepts minimal valid plugin.yaml", () => {
    const r = PluginYamlSchema.parse({
      name: "rss",
      runtime: "python",
      entry: "main.py",
    });
    expect(r.name).toBe("rss");
    expect(r.runtime).toBe("python");
    expect(r.entry).toBe("main.py");
    expect(r.inputs).toEqual({});
  });

  it("accepts full plugin.yaml with inputs and outputs", () => {
    const yaml = {
      name: "jd-checkin",
      runtime: "python",
      entry: "main.py",
      description: "JD daily checkin",
      inputs: {
        cookie: { required: true, type: "string", description: "JD cookie" },
        retry: { required: false, type: "number", default: 3 },
      },
      outputs: {
        result: { type: "object", description: "checkin result" },
      },
      setup: "pip install -r requirements.txt",
    };
    const r = PluginYamlSchema.parse(yaml);
    expect(r.name).toBe("jd-checkin");
    expect(r.inputs.cookie?.required).toBe(true);
    expect(r.inputs.retry?.default).toBe(3);
    expect(r.outputs?.result?.type).toBe("object");
    expect(r.setup).toBe("pip install -r requirements.txt");
  });

  it("rejects empty name", () => {
    expect(() =>
      PluginYamlSchema.parse({ name: "", runtime: "node", entry: "index.js" }),
    ).toThrow();
  });

  it("rejects empty entry", () => {
    expect(() =>
      PluginYamlSchema.parse({ name: "x", runtime: "node", entry: "" }),
    ).toThrow();
  });

  it("rejects invalid runtime", () => {
    expect(() =>
      PluginYamlSchema.parse({ name: "x", runtime: "ruby", entry: "main.rb" }),
    ).toThrow();
  });

  it("rejects missing name", () => {
    expect(() => PluginYamlSchema.parse({ runtime: "node", entry: "x" })).toThrow();
  });

  it("rejects missing runtime", () => {
    expect(() => PluginYamlSchema.parse({ name: "x", entry: "y" })).toThrow();
  });

  it("rejects missing entry", () => {
    expect(() => PluginYamlSchema.parse({ name: "x", runtime: "node" })).toThrow();
  });

  it("accepts all runtime types", () => {
    for (const runtime of ["python", "node", "shell", "typescript", "docker"] as const) {
      const r = PluginYamlSchema.parse({ name: "x", runtime, entry: "e" });
      expect(r.runtime).toBe(runtime);
    }
  });
});
