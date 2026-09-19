/**
 * BareZen GitHub Models plugin — LLM calls without a separate API key.
 *
 * GitHub Actions' own GITHUB_TOKEN authenticates against GitHub Models, so an
 * AI step costs nothing extra to wire up and stores no third-party credential.
 */

import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
import { z } from "zod";

const ENDPOINT = "https://models.github.ai/inference/chat/completions";

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
  message?: string;
}

export default definePlugin({
  name: "ai-github-models",
  inputs: z.object({
    prompt: z.string(),
    system: z.string().optional(),
    model: z.string().default("openai/gpt-4o-mini"),
  }),
  async run(ctx) {
    const token = ctx.secrets.require("GITHUB_TOKEN");
    const messages = [
      ...(ctx.inputs.system !== undefined
        ? [{ role: "system", content: ctx.inputs.system }]
        : []),
      { role: "user", content: ctx.inputs.prompt },
    ];

    ctx.logger.info(`requesting ${ctx.inputs.model} via GitHub Models`);
    const response = await fetchWithTimeout(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ model: ctx.inputs.model, messages }),
    });

    const data = (await response.json().catch(() => ({}))) as ChatCompletion;
    if (!response.ok) {
      // GitHub replies with prose (terms not accepted, model not available for
      // this account) that is useless without the status.
      const detail = data.error?.message ?? data.message ?? "";
      throw new Error(
        `GitHub Models error ${response.status}${detail === "" ? "" : `: ${detail.slice(0, 300)}`}`,
      );
    }

    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error(`GitHub Models returned no content: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return { text: text.trim() };
  },
});
