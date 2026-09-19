import { chatCompletion, definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "ai-review",
  inputs: z.object({
    content: z.string(),
    type: z.string().default("code"),
    model: z.string().default("gpt-4o-mini"),
    baseURL: z.string().url().optional(),
  }),
  async run(ctx) {
    const text = await chatCompletion({
      model: ctx.inputs.model,
      messages: [
        {
          role: "user",
          content: `Review this ${ctx.inputs.type}. List concrete issues, or "no issues found":\n\n${ctx.inputs.content}`,
        },
      ],
      ...(ctx.inputs.baseURL !== undefined ? { baseURL: ctx.inputs.baseURL } : {}),
    });
    return { text };
  },
});
