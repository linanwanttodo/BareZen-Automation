import { describe, expect, it } from "vitest";
import { evaluateExpression } from "./expression.js";

const scope: Record<string, unknown> = {
  github: {
    eventName: "push",
    actor: "dev",
    ref: "refs/heads/main",
    official: true,
    payload: { type: "push", count: 2 },
  },
  news: {
    count: 7,
    tag: "3",
    articles: [{ title: "A" }, { title: "B" }],
  },
};

function value(expr: string): boolean {
  const result = evaluateExpression(expr, scope);
  if (!result.success) {
    throw new Error(`unexpected parse failure: ${result.error}`);
  }
  return result.value;
}

function error(expr: string): string {
  const result = evaluateExpression(expr, scope);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("expected failure");
  return result.error;
}

describe("evaluateExpression", () => {
  it("evaluates boolean literals", () => {
    expect(value("true")).toBe(true);
    expect(value("false")).toBe(false);
  });

  it("compares string literals with either quote style", () => {
    expect(value('github.eventName == "push"')).toBe(true);
    expect(value("github.actor != 'dev'")).toBe(false);
  });

  it("compares numbers resolved from context paths", () => {
    expect(value("news.count > 5")).toBe(true);
    expect(value("news.count >= 7 && news.count <= 7")).toBe(true);
    expect(value("github.payload.count < news.count")).toBe(true);
  });

  it("treats a bare path as truthiness", () => {
    expect(value("github.official")).toBe(true);
    expect(value("!github.official")).toBe(false);
    expect(value("!github.missing")).toBe(true);
  });

  it("binds && tighter than ||", () => {
    expect(value("true || false && false")).toBe(true);
    expect(value("(true || false) && false")).toBe(false);
  });

  it("coerces numeric strings for equality but not for ordering", () => {
    expect(value('news.tag == 3')).toBe(true);
    expect(value('news.tag == "3"')).toBe(true);
    expect(error('"abc" > 5')).toContain("abc");
  });

  it("resolves array indices", () => {
    expect(value('news.articles[1].title == "B"')).toBe(true);
    expect(value("news.articles[0].title == news.articles[1].title")).toBe(false);
  });

  it("errors instead of returning false for an unknown root", () => {
    expect(error("nope.x == 1")).toContain("nope.x");
  });

  it("errors for an unresolvable nested path", () => {
    expect(error("news.articles[5].title == \"x\"")).toContain("news.articles[5]");
  });

  it("refuses prototype access and globals", () => {
    expect(error("github.__proto__ == 1")).toContain("github.__proto__");
    expect(error("news.constructor == 1")).toContain("news.constructor");
    expect(error("process.exit(1) == true")).toContain("process");
    expect(error("globalThis.foo == 1")).toContain("globalThis");
  });

  it("reports malformed expressions instead of silently failing", () => {
    expect(error("github.eventName ==").length).toBeGreaterThan(0);
    expect(error("(true && false").length).toBeGreaterThan(0);
    expect(error('"unclosed').length).toBeGreaterThan(0);
    expect(error("").length).toBeGreaterThan(0);
  });

  it("never evaluates anything resembling a call", () => {
    let thrown = false;
    try {
      const outcome = evaluateExpression("news.articles.map(x => x.title).length == 2", scope);
      thrown = !outcome.success;
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});
