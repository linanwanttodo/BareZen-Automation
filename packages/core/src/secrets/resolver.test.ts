import { describe, expect, it } from "vitest";
import { SecretNotFoundError } from "../errors/index.js";
import { type EnvSource, createSecretResolver } from "./resolver.js";

function makeEnv(map: Readonly<Record<string, string | undefined>>): EnvSource {
  return { get: (name) => map[name] };
}

describe("SecretResolver", () => {
  describe("resolve", () => {
    it("replaces a single reference in a string", () => {
      const r = createSecretResolver(makeEnv({ TOKEN: "abc123" }));
      expect(r.resolve("token=${{ secrets.TOKEN }}")).toBe("token=abc123");
    });

    it("replaces multiple references in one string", () => {
      const r = createSecretResolver(
        makeEnv({ USER: "alice", PASS: "pw" }),
      );
      expect(r.resolve("${{ secrets.USER }}:${{ secrets.PASS }}")).toBe("alice:pw");
    });

    it("handles whitespace inside the reference", () => {
      const r = createSecretResolver(makeEnv({ X: "v" }));
      expect(r.resolve("${{  secrets.X  }}")).toBe("v");
    });

    it("recursively resolves objects", () => {
      const r = createSecretResolver(makeEnv({ TOKEN: "t" }));
      const input = { a: "${{ secrets.TOKEN }}", b: { c: "${{ secrets.TOKEN }}" } };
      expect(r.resolve(input)).toEqual({ a: "t", b: { c: "t" } });
    });

    it("recursively resolves arrays", () => {
      const r = createSecretResolver(makeEnv({ TOKEN: "t" }));
      const input = ["${{ secrets.TOKEN }}", { x: "${{ secrets.TOKEN }}" }];
      expect(r.resolve(input)).toEqual(["t", { x: "t" }]);
    });

    it("leaves non-string values unchanged", () => {
      const r = createSecretResolver(makeEnv({}));
      expect(r.resolve(42)).toBe(42);
      expect(r.resolve(true)).toBe(true);
      expect(r.resolve(null)).toBe(null);
    });

    it("throws SecretNotFoundError when secret is missing", () => {
      const r = createSecretResolver(makeEnv({}));
      expect(() => r.resolve("${{ secrets.MISSING }}")).toThrow(SecretNotFoundError);
    });

    it("does not add empty string secrets to resolvedSecrets", () => {
      const r = createSecretResolver(makeEnv({ EMPTY: "" }));
      r.resolve("${{ secrets.EMPTY }}");
      expect(r.resolvedSecrets.size).toBe(0);
    });
  });

  describe("hasSecretReference", () => {
    it("detects reference in string", () => {
      const r = createSecretResolver(makeEnv({}));
      expect(r.hasSecretReference("${{ secrets.X }}")).toBe(true);
    });

    it("returns false for plain string", () => {
      const r = createSecretResolver(makeEnv({}));
      expect(r.hasSecretReference("hello")).toBe(false);
    });

    it("detects reference in object", () => {
      const r = createSecretResolver(makeEnv({}));
      expect(r.hasSecretReference({ a: "${{ secrets.X }}" })).toBe(true);
    });

    it("detects reference in array", () => {
      const r = createSecretResolver(makeEnv({}));
      expect(r.hasSecretReference(["${{ secrets.X }}"])).toBe(true);
    });

    it("returns false for non-string primitives", () => {
      const r = createSecretResolver(makeEnv({}));
      expect(r.hasSecretReference(42)).toBe(false);
      expect(r.hasSecretReference(null)).toBe(false);
    });
  });

  describe("mask", () => {
    it("replaces known secret values with ***", () => {
      const r = createSecretResolver(makeEnv({ TOKEN: "abc123" }));
      r.resolve("token=${{ secrets.TOKEN }}");
      expect(r.mask("the token is abc123 here")).toBe("the token is *** here");
    });

    it("masks multiple occurrences", () => {
      const r = createSecretResolver(makeEnv({ TOKEN: "abc" }));
      r.resolve("${{ secrets.TOKEN }}");
      expect(r.mask("abc and abc")).toBe("*** and ***");
    });

    it("leaves strings without secrets unchanged", () => {
      const r = createSecretResolver(makeEnv({}));
      expect(r.mask("plain text")).toBe("plain text");
    });

    it("masks multiple different secrets", () => {
      const r = createSecretResolver(makeEnv({ A: "alpha", B: "beta" }));
      r.resolve("${{ secrets.A }} ${{ secrets.B }}");
      expect(r.mask("alpha + beta")).toBe("*** + ***");
    });
  });
});
