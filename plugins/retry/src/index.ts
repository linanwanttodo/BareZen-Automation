        import { definePlugin } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "retry",
          inputs: z.object({
            attempts: z.number().int().positive().default(3),
delay: z.number().nonnegative().default(1000)
          }),
          async run(ctx) {
            return { result: { attempts: ctx.inputs.attempts, delay: ctx.inputs.delay } };
          },
        });
