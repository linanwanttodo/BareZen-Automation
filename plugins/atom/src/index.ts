        import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "atom",
          inputs: z.object({
            url: z.string().url(),
limit: z.number().int().positive().default(20)
          }),
          async run(ctx) {
            const res = await fetchWithTimeout(ctx.inputs.url);
if (!res.ok) throw new Error(`Failed to fetch Atom feed: ${res.status}`);
const xml = await res.text();
return { result: { xml, limit: ctx.inputs.limit } };
          },
        });
