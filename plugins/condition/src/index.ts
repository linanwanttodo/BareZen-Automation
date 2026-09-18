        import { definePlugin } from "@barezen/sdk";
        import { z } from "zod";

        export default definePlugin({
          name: "condition",
          inputs: z.object({
            expression: z.string(),
value: z.unknown().optional()
          }),
          async run(ctx) {
            const result = ctx.inputs.expression === "true" || ctx.inputs.expression === String(ctx.inputs.value);
return { result: { matched: result } };
          },
        });
