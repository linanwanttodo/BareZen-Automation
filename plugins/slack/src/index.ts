import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "slack",
  inputs: z.object({
    message: z.string(),

  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("WEBHOOK_URL");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: ctx.inputs.message }),
    });
    if (!response.ok) {
      throw new Error("slack webhook failed: ${response.status} ${response.statusText}");
    }
    ctx.logger.info("slack message sent");
    return { sent: true };
  },
});
