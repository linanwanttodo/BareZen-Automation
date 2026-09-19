        import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "ai-chat",
          inputs: z.object({
            messages: z.array(z.object({ role: z.string(), content: z.string() })),
model: z.string().default("gpt-4o-mini"),
systemPrompt: z.string().optional()
          }),
          async run(ctx) {
            const apiKey = ctx.secrets.require("OPENAI_API_KEY");
const msgs = ctx.inputs.systemPrompt ? [{ role: "system", content: ctx.inputs.systemPrompt }, ...ctx.inputs.messages] : ctx.inputs.messages;
const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: ctx.inputs.model, messages: msgs }) });
if (!res.ok) throw new Error(`AI API error: ${res.status}`);
const data = await res.json() as { choices: { message: { content: string } }[] };
return { result: { text: data.choices[0]?.message.content ?? "" } };
          },
        });
