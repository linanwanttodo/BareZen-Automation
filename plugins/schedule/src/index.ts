        import { definePlugin } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "schedule",
          inputs: z.object({
            cron: z.string(),
timezone: z.string().optional()
          }),
          async run(ctx) {
            const now = new Date();
return { result: { shouldExecute: true, now: now.toISOString(), cron: ctx.inputs.cron } };
          },
        });
