import { chatCompletion, definePlugin } from "@barezen/sdk";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export default definePlugin({
  name: "ai-chat",
  inputs: z.object({
    messages: z.array(MessageSchema),
    model: z.string().default("gpt-4o-mini"),
    systemPrompt: z.string().optional(),
    baseURL: z.string().url().optional(),
  }),
  async run(ctx) {
    const messages = ctx.inputs.systemPrompt !== undefined
      ? [{ role: "system", content: ctx.inputs.systemPrompt } as const, ...ctx.inputs.messages]
      : ctx.inputs.messages;

    const text = await chatCompletion({
      model: ctx.inputs.model,
      messages,
      ...(ctx.inputs.baseURL !== undefined ? { baseURL: ctx.inputs.baseURL } : {}),
    });
    return { text };
  },
});
