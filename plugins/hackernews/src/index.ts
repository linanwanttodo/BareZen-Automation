/**
 * BareZen Hacker News plugin — stories via the Algolia HN search API.
 *
 * Outputs the same article shape as the rss plugin so text-template,
 * markdown-report and the AI plugins can consume either source unchanged.
 */

import { definePlugin, fetchJson } from "@barezen/sdk";
import { z } from "zod";

const ENDPOINT = "https://hn.algolia.com/api/v1/search";

const HitSchema = z.object({
  objectID: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  points: z.number().optional(),
  num_comments: z.number().optional(),
  created_at: z.string().optional(),
});

const ResponseSchema = z.object({ hits: z.array(HitSchema) });

export default definePlugin({
  name: "hackernews",
  inputs: z.object({
    tag: z.string().default("front_page"),
    limit: z.number().int().positive().max(50).default(10),
  }),
  async run(ctx) {
    const url = `${ENDPOINT}?tags=${encodeURIComponent(ctx.inputs.tag)}&hitsPerPage=${ctx.inputs.limit}`;
    ctx.logger.info(`fetching Hacker News (${ctx.inputs.tag})`);
    const raw = await fetchJson<unknown>(url);
    const parsed = ResponseSchema.parse(raw);

    const articles = parsed.hits
      .filter((hit) => hit.title !== undefined)
      .map((hit) => {
        const extras = [
          hit.points !== undefined ? `${hit.points} points` : undefined,
          hit.num_comments !== undefined ? `${hit.num_comments} comments` : undefined,
        ].filter((part): part is string => part !== undefined);
        return {
          title: hit.title as string,
          // Ask/Show posts have no external URL and live on Hacker News itself.
          link: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
          description: extras.join(" · "),
          pubDate: hit.created_at ?? "",
          guid: hit.objectID,
        };
      });

    ctx.logger.info(`fetched ${articles.length} stories`);
    return { articles };
  },
});
