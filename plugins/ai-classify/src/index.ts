        import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "ai-classify",
          inputs: z.object({
            text: z.string(),
categories: z.array(z.string()),
model: z.string().default("gpt-4o-mini")
          }),
          async run(ctx) {
            const apiKey = ctx.secrets.require("OPENAI_API_KEY");
const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: ctx.inputs.model, messages: [{ role: "user", content: `Classify into [${ctx.inputs.categories.join(", ")}]: ${ctx.inputs.text}` }] }) });
if (!res.ok) throw new Error(`AI API error: ${res.status}`);
const data = await res.json() as { choices: { message: { content: string } }[] };
return { result: { category: data.choices[0]?.message.content ?? "" } };
          },
        });
