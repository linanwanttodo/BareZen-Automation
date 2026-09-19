        import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "crawler",
          inputs: z.object({
            url: z.string().url(),
selectors: z.record(z.string())
          }),
          async run(ctx) {
            const res = await fetchWithTimeout(ctx.inputs.url);
const html = await res.text();
return { result: { html, selectors: ctx.inputs.selectors } };
          },
        });
