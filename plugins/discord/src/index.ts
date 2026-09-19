import { definePlugin, fetchWithTimeout, splitText } from "@barezen/sdk";
import { z } from "zod";

/** Discord caps webhook content at 2000 characters. */
const MESSAGE_LIMIT = 2000;

export default definePlugin({
  name: "discord",
  inputs: z.object({
    message: z.string(),
    username: z.string().optional(),
  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("DISCORD_WEBHOOK_URL");
    const chunks = splitText(ctx.inputs.message, MESSAGE_LIMIT);

    for (const chunk of chunks) {
      const response = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: chunk,
          ...(ctx.inputs.username !== undefined ? { username: ctx.inputs.username } : {}),
        }),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 200);
        throw new Error(`discord send failed: ${response.status} ${response.statusText} ${detail}`);
      }
    }

    ctx.logger.info(`discord sent ${chunks.length} message(s)`);
    return { sent: true, parts: chunks.length };
  },
});
