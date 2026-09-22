/**
 * BareZen crawler plugin — extract fields from a page with CSS selectors.
 *
 * For pages that have no feed. Output composes with text-template and the AI
 * plugins the same way rss and hackernews do.
 */

import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
import { parse } from "node-html-parser";
import { z } from "zod";

export default definePlugin({
  name: "crawler",
  inputs: z.object({
    url: z.string().url(),
    selectors: z.record(z.string()),
  }),
  async run(ctx) {
    ctx.logger.info(`fetching ${ctx.inputs.url}`);
    const response = await fetchWithTimeout(ctx.inputs.url);
    if (!response.ok) {
      throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType !== "" && !contentType.includes("html")) {
      throw new Error(`expected HTML from ${ctx.inputs.url}, got ${contentType}`);
    }

    const root = parse(await response.text());
    const fields: Record<string, string | null> = {};
    const missing: string[] = [];

    for (const [name, selector] of Object.entries(ctx.inputs.selectors)) {
      const node = root.querySelector(selector);
      const text = node?.text.trim() ?? "";
      fields[name] = text === "" ? null : text;
      if (text === "") missing.push(name);
    }

    if (missing.length > 0) {
      ctx.logger.warn(`no text extracted for: ${missing.join(", ")}`);
    }

    return {
      fields,
      url: ctx.inputs.url,
      matchedCount: Object.keys(fields).length - missing.length,
    };
  },
});
