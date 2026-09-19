import { definePlugin, fetchWithTimeout, splitText } from "@barezen/sdk";
import { z } from "zod";

/** WeCom markdown content is capped at 4096 bytes. */
const MESSAGE_LIMIT = 4000;

export default definePlugin({
  name: "wecom",
  inputs: z.object({
    message: z.string(),
  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("WECOM_WEBHOOK_URL");
    const chunks = splitText(ctx.inputs.message, MESSAGE_LIMIT);

    for (const chunk of chunks) {
      const response = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msgtype: "markdown", markdown: { content: chunk } }),
      });
      const reply = (await response.json().catch(() => ({}))) as {
        errcode?: number;
        errmsg?: string;
      };
      // WeCom reports rejection as HTTP 200 with a non-zero errcode.
      if (!response.ok || reply.errcode !== 0) {
        throw new Error(`wecom send failed: ${JSON.stringify(reply).slice(0, 200)}`);
      }
    }

    ctx.logger.info(`wecom sent ${chunks.length} message(s)`);
    return { sent: true, parts: chunks.length };
  },
});
