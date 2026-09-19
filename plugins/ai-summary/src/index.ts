import { chatCompletion, definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "ai-summary",
  inputs: z.object({
    text: z.string(),
    model: z.string().default("gpt-4o-mini"),
    baseURL: z.string().url().optional(),
  }),
  async run(ctx) {
    const text = await chatCompletion({
      model: ctx.inputs.model,
      messages: [{ role: "user", content: ctx.inputs.text }],
      ...(ctx.inputs.baseURL !== undefined ? { baseURL: ctx.inputs.baseURL } : {}),
    });
    return { text };
  },
});
