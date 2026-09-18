import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "wecom",
  inputs: z.object({
    message: z.string(),

  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("WEBHOOK_URL");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msgtype: "text", text: { content: ctx.inputs.message } }),
    });
    if (!response.ok) {
      throw new Error("wecom webhook failed: ${response.status} ${response.statusText}");
    }
    ctx.logger.info("wecom message sent");
    return { sent: true };
  },
});
