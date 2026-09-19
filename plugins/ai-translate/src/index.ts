import { chatCompletion, definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "ai-translate",
  inputs: z.object({
    text: z.string(),
    to: z.string(),
    from: z.string().optional(),
    model: z.string().default("gpt-4o-mini"),
    baseURL: z.string().url().optional(),
  }),
  async run(ctx) {
    const source = ctx.inputs.from !== undefined ? `from ${ctx.inputs.from} ` : "";
    const text = await chatCompletion({
      model: ctx.inputs.model,
      messages: [
        {
          role: "user",
          content: `Translate ${source}to ${ctx.inputs.to}. Reply with the translation only:\n\n${ctx.inputs.text}`,
        },
      ],
      ...(ctx.inputs.baseURL !== undefined ? { baseURL: ctx.inputs.baseURL } : {}),
    });
    return { text };
  },
});
