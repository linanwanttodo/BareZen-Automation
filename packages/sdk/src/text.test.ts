import { describe, expect, it } from "vitest";
import { splitText } from "./text.js";

describe("splitText", () => {
  it("returns short text untouched", () => {
    expect(splitText("hello", 100)).toEqual(["hello"]);
  });

  it("rejects a non-positive limit", () => {
    expect(() => splitText("x", 0)).toThrow(/positive/);
  });

  it("keeps whole paragraphs together under the limit", () => {
    expect(splitText("aaa\nbbb\nccc", 7)).toEqual(["aaa\nbbb", "ccc"]);
  });

  it("hard-splits a single line longer than the limit", () => {
    expect(splitText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("produces no empty chunks and never exceeds the limit", () => {
    const text = [
      "short",
      "x".repeat(50),
      "another paragraph with words that are individually long enough to matter",
      "y".repeat(9),
    ].join("\n");
    const chunks = splitText(text, 12);
    expect(chunks.every((chunk) => chunk.length <= 12)).toBe(true);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
    // Content preserved apart from the newlines used as boundaries.
    expect(chunks.join("").replace(/\n/g, "")).toBe(text.replace(/\n/g, ""));
  });

  it("folds blank lines into the preceding chunk", () => {
    expect(splitText("a\n\nb", 3)).toEqual(["a\n", "b"]);
  });
});
