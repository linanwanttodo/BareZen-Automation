/**
 * T-TEST-02: Config Parser + Secret Resolver integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConfigParser } from "../../src/config/parser.js";
import { createSecretResolver } from "../../src/secrets/resolver.js";
import type { EnvSource } from "../../src/secrets/resolver.js";

const TMP_DIR = join(tmpdir(), "barezen-test-config");

function makeEnv(secrets: Record<string, string>): EnvSource {
  return {
    get(name: string): string | undefined {
      return secrets[name];
    },
  };
}

describe("Config + Secret Resolver - Integration", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("parses valid config and resolves secret references", () => {
    const configPath = join(TMP_DIR, "automation.yml");
    writeFileSync(
      configPath,
      `plugins:
  - rss
  - telegram

flows:
  daily:
    - plugin: rss
      inputs:
        url: https://example.com/feed.xml
        limit: 10
      output: news
    - plugin: telegram
      inputs:
        chatId: "\${{ secrets.TELEGRAM_CHAT_ID }}"
        message: "New articles"
      input: news

settings:
  defaultTimeout: 60000
  logLevel: info
`,
    );

    const parser = createConfigParser();
    const config = parser.parse(configPath);

    expect(config.plugins).toEqual(["rss", "telegram"]);
    expect(config.flows.daily).toHaveLength(2);
    expect(config.flows.daily[0]?.plugin).toBe("rss");

    const resolver = createSecretResolver(
      makeEnv({
        TELEGRAM_CHAT_ID: "123456789",
      }),
    );
    const resolved = resolver.resolve(config);

    const telegramStep = resolved.flows.daily[1];
    expect(telegramStep?.inputs?.chatId).toBe("123456789");
  });

  it("throws ConfigFileNotFoundError for missing file", () => {
    const parser = createConfigParser();
    expect(() => parser.parse(join(TMP_DIR, "nonexistent.yml"))).toThrow(/not found/i);
  });

  it("throws ConfigSyntaxError for invalid YAML", () => {
    const configPath = join(TMP_DIR, "bad.yml");
    writeFileSync(configPath, "plugins: [unclosed");

    const parser = createConfigParser();
    expect(() => parser.parse(configPath)).toThrow();
  });

  it("throws ConfigValidationError for invalid schema", () => {
    const configPath = join(TMP_DIR, "invalid.yml");
    writeFileSync(
      configPath,
      `plugins: "not-an-array"
flows: {}
`,
    );

    const parser = createConfigParser();
    expect(() => parser.parse(configPath)).toThrow();
  });

  it("handles nested secret references in arrays and objects", () => {
    const configPath = join(TMP_DIR, "nested.yml");
    writeFileSync(
      configPath,
      `plugins:
  - webhook
flows:
  test:
    - plugin: webhook
      inputs:
        url: "\${{ secrets.WEBHOOK_URL }}"
        headers:
          Authorization: "Bearer \${{ secrets.API_TOKEN }}"
        tags:
          - "\${{ secrets.TAG_1 }}"
          - "static-tag"
`,
    );

    const parser = createConfigParser();
    const config = parser.parse(configPath);

    const resolver = createSecretResolver(
      makeEnv({
        WEBHOOK_URL: "https://hooks.example.com",
        API_TOKEN: "abc123",
        TAG_1: "urgent",
      }),
    );
    const resolved = resolver.resolve(config);

    const step = resolved.flows.test[0];
    expect(step?.inputs?.url).toBe("https://hooks.example.com");
    expect(step?.inputs?.headers?.Authorization).toBe("Bearer abc123");
    expect(step?.inputs?.tags).toEqual(["urgent", "static-tag"]);
  });
});
