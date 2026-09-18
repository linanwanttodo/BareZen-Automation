/**
 * BareZen RSS Plugin — fetch and parse RSS feeds.
 */

import { definePlugin } from "@barezen/sdk";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const ArticleSchema = z.object({
  title: z.string(),
  link: z.string().optional(),
  description: z.string().optional(),
  pubDate: z.string().optional(),
  guid: z.string().optional(),
});

export default definePlugin({
  name: "rss",
  inputs: z.object({
    url: z.string().url(),
    limit: z.number().int().positive().default(20),
  }),
  async run(ctx) {
    ctx.logger.info(`Fetching RSS feed: ${ctx.inputs.url}`);
    const response = await fetch(ctx.inputs.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }
    const xml = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);

    const channel = parsed.rss?.channel ?? parsed.feed;
    const rawItems = channel.item ?? channel.entry ?? [];
    const items: Record<string, unknown>[] = Array.isArray(rawItems)
      ? rawItems
      : [rawItems];

    const articles = items
      .slice(0, ctx.inputs.limit)
      .map((item) => ({
        title: String(item.title ?? ""),
        link: typeof item.link === "string" ? item.link : String((item.link as { href?: string })?.href ?? ""),
        description: typeof item.description === "string" ? item.description : String(item.summary ?? ""),
        pubDate: String(item.pubDate ?? item.published ?? ""),
        guid: String(item.guid ?? item.id ?? ""),
      }))
      .filter((a) => a.title !== "");

    ctx.logger.info(`Parsed ${articles.length} articles`);
    return { articles: z.array(ArticleSchema).parse(articles) };
  },
});
