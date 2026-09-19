import { chatCompletion, definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "ai-classify",
  inputs: z.object({
    text: z.string(),
    categories: z.array(z.string()).min(1),
    model: z.string().default("gpt-4o-mini"),
    baseURL: z.string().url().optional(),
  }),
  async run(ctx) {
    const raw = await chatCompletion({
      model: ctx.inputs.model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Classify into exactly one of [${ctx.inputs.categories.join(", ")}]. Reply with only that label:\n\n${ctx.inputs.text}`,
        },
      ],
      ...(ctx.inputs.baseURL !== undefined ? { baseURL: ctx.inputs.baseURL } : {}),
    });

    // Models wrap the label in prose or quotes even when told not to; match
    // against the caller's own list instead of trusting the raw reply.
    const normalized = raw.trim().toLowerCase();
    const category =
      ctx.inputs.categories.find((option) => option.toLowerCase() === normalized) ??
      ctx.inputs.categories.find((option) => normalized.includes(option.toLowerCase()));

    if (category === undefined) {
      throw new Error(
        `classification "${raw.slice(0, 100)}" matched none of [${ctx.inputs.categories.join(", ")}]`,
      );
    }
    return { category };
  },
});
