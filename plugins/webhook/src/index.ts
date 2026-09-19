import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "webhook",
  inputs: z.object({
    payload: z.string(),
    url: z.string().url().optional(),
  }),
  async run(ctx) {
    const url = ctx.inputs.url ?? ctx.secrets.get("GENERIC_WEBHOOK_URL");
    if (url === undefined || url === "") {
      throw new Error(
        "webhook needs a target via the `url` input or GENERIC_WEBHOOK_URL",
      );
    }

    // A JSON payload is forwarded as-is; anything else is wrapped so the
    // receiver still gets a valid body.
    let body: unknown;
    try {
      body = JSON.parse(ctx.inputs.payload);
    } catch {
      body = { text: ctx.inputs.payload };
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const secret = ctx.secrets.get("GENERIC_WEBHOOK_SECRET");
    if (secret !== undefined && secret !== "") {
      headers["Authorization"] = `Bearer ${secret}`;
    }

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      throw new Error(`webhook post failed: ${response.status} ${response.statusText} ${detail}`);
    }

    ctx.logger.info(`webhook posted to ${new URL(url).host}`);
    return { sent: true, status: response.status };
  },
});
