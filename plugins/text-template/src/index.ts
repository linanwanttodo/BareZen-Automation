/**
 * BareZen text-template plugin — renders a Handlebars template.
 *
 * Exists because step outputs are objects and most sink plugins want a string:
 * this is the shaping step between them.
 */

import { definePlugin } from "@barezen/sdk";
import Handlebars from "handlebars";
import { z } from "zod";

export default definePlugin({
  name: "text-template",
  inputs: z.object({
    template: z.string(),
    vars: z.record(z.unknown()).optional(),
  }),
  async run(ctx) {
    // Escape by default: template data usually comes from fetched feeds.
    const compiled = Handlebars.compile(ctx.inputs.template);
    const text = compiled(ctx.inputs.vars ?? {});
    ctx.logger.info(`Rendered template into ${text.length} characters`);
    return { text };
  },
});
