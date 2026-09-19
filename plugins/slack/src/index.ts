import { definePlugin, fetchWithTimeout, splitText } from "@barezen/sdk";
import { z } from "zod";

/** Slack rejects text blocks beyond ~4000 characters. */
const MESSAGE_LIMIT = 3000;

export default definePlugin({
  name: "slack",
  inputs: z.object({
    message: z.string(),
  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("SLACK_WEBHOOK_URL");
    const chunks = splitText(ctx.inputs.message, MESSAGE_LIMIT);

    for (const chunk of chunks) {
      const response = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk }),
      });
      const body = (await response.text().catch(() => "")).trim();
      // Slack answers 200 with "ok" on success and 200 with a reason token
      // (no_text, invalid_arguments, ...) on failure.
      if (!response.ok || (body !== "" && body !== "ok")) {
        throw new Error(`slack send failed: ${response.status} ${body.slice(0, 200)}`);
      }
    }

    ctx.logger.info(`slack sent ${chunks.length} message(s)`);
    return { sent: true, parts: chunks.length };
  },
});
