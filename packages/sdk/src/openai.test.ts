import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chatCompletion,
  DEFAULT_CHAT_BASE_URL,
  resolveChatUrl,
} from "./openai.js";

describe("resolveChatUrl", () => {
  const saved = process.env.OPENAI_API_BASE;

  beforeEach(() => {
    delete process.env.OPENAI_API_BASE;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.OPENAI_API_BASE;
    else process.env.OPENAI_API_BASE = saved;
  });

  it("falls back to OpenAI", () => {
    expect(resolveChatUrl(undefined)).toBe(`${DEFAULT_CHAT_BASE_URL}/chat/completions`);
  });

  it("prefers an explicit base over the environment", () => {
    process.env.OPENAI_API_BASE = "https://env.example/v1";
    expect(resolveChatUrl("https://arg.example/v1")).toBe(
      "https://arg.example/v1/chat/completions",
    );
  });

  it("uses OPENAI_API_BASE when no argument is given", () => {
    process.env.OPENAI_API_BASE = "https://deepseek.example/v1";
    expect(resolveChatUrl(undefined)).toBe("https://deepseek.example/v1/chat/completions");
  });

  it("strips trailing slashes and surrounding whitespace", () => {
    expect(resolveChatUrl("  https://x.example/v1//  ")).toBe(
      "https://x.example/v1/chat/completions",
    );
  });

  it("rejects a base that resolves to nothing", () => {
    process.env.OPENAI_API_BASE = "   ";
    expect(() => resolveChatUrl("///")).toThrow(/empty/);
  });
});

describe("chatCompletion", () => {
  const savedKey = process.env.OPENAI_API_KEY;
  let server: Server;
  let baseUrl: string;
  const received: { path: string; auth: string; body: unknown }[] = [];

  beforeEach(async () => {
    delete process.env.OPENAI_API_KEY;
    received.length = 0;
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk: string) => {
        raw += chunk;
      });
      req.on("end", () => {
        received.push({
          path: req.url ?? "",
          auth: req.headers.authorization ?? "",
          body: JSON.parse(raw) as unknown,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: "  summarised  " } }],
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedKey;
  });

  it("requires a key", async () => {
    await expect(
      chatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("posts to the configured base and returns trimmed content", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_API_BASE = baseUrl;
    const text = await chatCompletion({
      model: "mini",
      messages: [
        { role: "system", content: "be brief" },
        { role: "user", content: "hello" },
      ],
      temperature: 0.2,
    });

    expect(text).toBe("summarised");
    expect(received).toHaveLength(1);
    expect(received[0]?.path).toBe("/v1/chat/completions");
    expect(received[0]?.auth).toBe("Bearer test-key");
    const body = received[0]?.body as {
      model: string;
      temperature: number;
      messages: unknown[];
    };
    expect(body.model).toBe("mini");
    expect(body.temperature).toBe(0.2);
    expect(body.messages).toHaveLength(2);
  });

  it("fails loudly when the reply carries no content", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    server.removeAllListeners("request");
    server.on("request", (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ unexpected: true }));
    });
    await expect(
      chatCompletion({
        model: "m",
        messages: [{ role: "user", content: "hi" }],
        baseURL: baseUrl,
      }),
    ).rejects.toThrow(/no assistant content/);
  });
});
