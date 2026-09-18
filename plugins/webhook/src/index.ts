        import { definePlugin } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "webhook",
          inputs: z.object({
            payload: z.string(),
secret: z.string().optional()
          }),
          async run(ctx) {
            const data = JSON.parse(ctx.inputs.payload);
return { result: { data, valid: true } };
          },
        });
