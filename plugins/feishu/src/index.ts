import { definePlugin, fetchWithTimeout, splitText } from "@barezen/sdk";
import { z } from "zod";

/** Feishu text messages allow a generous payload, but still need a cap. */
const MESSAGE_LIMIT = 30000;

export default definePlugin({
  name: "feishu",
  inputs: z.object({
    message: z.string(),
  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("FEISHU_WEBHOOK_URL");
    const chunks = splitText(ctx.inputs.message, MESSAGE_LIMIT);

    for (const chunk of chunks) {
      const response = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg_type: "text", content: { text: chunk } }),
      });
      const reply = (await response.json().catch(() => ({}))) as {
        code?: number;
        msg?: string;
        StatusCode?: number;
      };
      // Two response shapes are in the wild: {code} on newer bots, {StatusCode}
      // on older ones; both signal success with zero.
      const errorCode = reply.code ?? reply.StatusCode;
      if (!response.ok || (errorCode !== undefined && errorCode !== 0)) {
        throw new Error(`feishu send failed: ${JSON.stringify(reply).slice(0, 200)}`);
      }
    }

    ctx.logger.info(`feishu sent ${chunks.length} message(s)`);
    return { sent: true, parts: chunks.length };
  },
});
