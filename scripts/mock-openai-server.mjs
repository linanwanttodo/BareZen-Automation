/**
 * Minimal OpenAI-compatible chat endpoint for tests and CI.
 *
 * Lets a pipeline prove its AI step end to end without a vendor key. It is
 * deliberately picky: unless the request looks like a real chat completion, and
 * optionally carries an expected substring in the prompt, it fails so a green
 * run means data actually crossed the model boundary.
 *
 * Env:
 *   PORT                   listen port (default 8787)
 *   MOCK_REPLY             assistant text to return
 *   MOCK_REQUIRE_SUBSTRING fail with 400 unless the prompt contains it
 */

import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8787);
const reply = process.env.MOCK_REPLY ?? "Mocked model summary: the digest has several releases.";
const required = process.env.MOCK_REQUIRE_SUBSTRING;

const server = createServer((req, res) => {
  const respond = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (!req.url?.endsWith("/chat/completions")) {
    console.error(`[mock] unexpected path ${String(req.url)}`);
    respond(404, { error: { message: "unexpected path" } });
    return;
  }

  if (req.headers.authorization === undefined) {
    respond(401, { error: { message: "missing Authorization header" } });
    return;
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
  });
  req.on("end", () => {
    /** @type {{ model?: string, messages?: { content?: string }[] }} */
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      respond(400, { error: { message: "body was not JSON" } });
      return;
    }

    const messages = payload.messages ?? [];
    if (messages.length === 0 || typeof payload.model !== "string") {
      respond(400, { error: { message: "model and messages are required" } });
      return;
    }

    const prompt = messages.map((message) => message.content ?? "").join("\n");
    if (required !== undefined && !prompt.includes(required)) {
      console.error(`[mock] prompt missing "${required}"; got ${prompt.slice(0, 200)}`);
      respond(400, { error: { message: `prompt did not contain ${required}` } });
      return;
    }

    console.log(`[mock] ok: model=${payload.model} messages=${messages.length} promptChars=${prompt.length}`);
    respond(200, { choices: [{ message: { role: "assistant", content: reply } }] });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[mock] listening on http://127.0.0.1:${port}/v1`);
});
