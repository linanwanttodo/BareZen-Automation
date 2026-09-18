import { describe, expect, it } from "vitest";
import {
  PluginConflictError,
  PluginNotFoundError,
} from "../errors/index.js";
import { type PluginDescriptor } from "./descriptor.js";
import { createPluginRegistry } from "./registry.js";

function makeDescriptor(name: string, dirPath: string): PluginDescriptor {
  return {
    name,
    runtime: "node",
    entry: "index.js",
    inputs: {},
    dirPath,
  };
}

describe("PluginRegistry", () => {
  it("registers and retrieves a plugin", () => {
    const reg = createPluginRegistry();
    const d = makeDescriptor("rss", "/plugins/rss");
    reg.register(d);
    expect(reg.has("rss")).toBe(true);
    expect(reg.get("rss")).toBe(d);
    expect(reg.size).toBe(1);
  });

  it("throws PluginConflictError on duplicate name", () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss", "/a/rss"));
    expect(() => reg.register(makeDescriptor("rss", "/b/rss"))).toThrow(
      PluginConflictError,
    );
  });

  it("returns undefined for unknown plugin", () => {
    const reg = createPluginRegistry();
    expect(reg.get("missing")).toBeUndefined();
    expect(reg.has("missing")).toBe(false);
  });

  it("list returns all registered plugins", () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss", "/rss"));
    reg.register(makeDescriptor("email", "/email"));
    const list = reg.list();
    expect(list).toHaveLength(2);
    expect(list.map((d) => d.name).sort()).toEqual(["email", "rss"]);
  });

  it("resolve returns descriptors in order", () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss", "/rss"));
    reg.register(makeDescriptor("email", "/email"));
    const resolved = reg.resolve(["email", "rss"]);
    expect(resolved.map((d) => d.name)).toEqual(["email", "rss"]);
  });

  it("resolve throws PluginNotFoundError for missing plugin", () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss", "/rss"));
    expect(() => reg.resolve(["rss", "missing"])).toThrow(PluginNotFoundError);
  });

  it("clear removes all plugins", () => {
    const reg = createPluginRegistry();
    reg.register(makeDescriptor("rss", "/rss"));
    reg.clear();
    expect(reg.size).toBe(0);
    expect(reg.has("rss")).toBe(false);
  });

  it("size reflects current count", () => {
    const reg = createPluginRegistry();
    expect(reg.size).toBe(0);
    reg.register(makeDescriptor("a", "/a"));
    expect(reg.size).toBe(1);
    reg.register(makeDescriptor("b", "/b"));
    expect(reg.size).toBe(2);
  });
});
