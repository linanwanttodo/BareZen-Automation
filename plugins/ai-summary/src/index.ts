        import { definePlugin } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "ai-summary",
          inputs: z.object({
            text: z.string(),
model: z.string().default("gpt-4o-mini")
          }),
          async run(ctx) {
            const apiKey = ctx.secrets.require("OPENAI_API_KEY");
const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: ctx.inputs.model, messages: [{ role: "user", content: ctx.inputs.text }] }) });
if (!res.ok) throw new Error(`AI API error: ${res.status}`);
const data = await res.json() as { choices: { message: { content: string } }[] };
return { result: { text: data.choices[0]?.message.content ?? "" } };
          },
        });
