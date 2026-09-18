import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "feishu",
  inputs: z.object({
    message: z.string(),

  }),
  async run(ctx) {
    const webhookUrl = ctx.secrets.require("WEBHOOK_URL");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: "text", content: { text: ctx.inputs.message } }),
    });
    if (!response.ok) {
      throw new Error("feishu webhook failed: ${response.status} ${response.statusText}");
    }
    ctx.logger.info("feishu message sent");
    return { sent: true };
  },
});
