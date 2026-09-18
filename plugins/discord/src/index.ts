import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "discord",
  inputs: z.object({
    message: z.string(),
    username: z.string().optional(),
  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("WEBHOOK_URL");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: ctx.inputs.message, ...(ctx.inputs.username ? { username: ctx.inputs.username } : {}) }),
    });
    if (!response.ok) {
      throw new Error(`discord webhook failed: ${response.status} ${response.statusText}`);
    }
    ctx.logger.info("discord message sent");
    return { sent: true };
  },
});
