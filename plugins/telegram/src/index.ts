import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "telegram",
  inputs: z.object({
    message: z.string(),
    chatId: z.string(),
  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("WEBHOOK_URL");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ctx.inputs.chatId, text: ctx.inputs.message }),
    });
    if (!response.ok) {
      throw new Error(`telegram webhook failed: ${response.status} ${response.statusText}`);
    }
    ctx.logger.info("telegram message sent");
    return { sent: true };
  },
});
