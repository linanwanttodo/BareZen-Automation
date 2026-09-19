/**
 * BareZen RSS Plugin — fetch and parse RSS feeds.
 */

import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const ArticleSchema = z.object({
  title: z.string(),
  link: z.string().optional(),
  description: z.string().optional(),
  pubDate: z.string().optional(),
  guid: z.string().optional(),
});

/**
 * Extract an entry's URL. RSS 2.0 carries a plain string; Atom carries
 * attributes, which fast-xml-parser prefixes with "@_", and may repeat <link>.
 */
function pickLink(link: unknown): string {
  if (typeof link === "string") return link;
  const candidates = (Array.isArray(link) ? link : [link])
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .filter((c) => typeof c["@_href"] === "string");
  const alternate = candidates.find((c) => c["@_rel"] === "alternate");
  return String((alternate ?? candidates[0])?.["@_href"] ?? "");
}

export default definePlugin({
  name: "rss",
  inputs: z.object({
    url: z.string().url(),
    limit: z.number().int().positive().default(20),
  }),
  async run(ctx) {
    ctx.logger.info(`Fetching RSS feed: ${ctx.inputs.url}`);
    const response = await fetchWithTimeout(ctx.inputs.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }
    const xml = await response.text();
    // Ordinary &amp; counts against these budgets and feeds are full of it;
    // the defaults (1000 expansions, 100000 chars) reject most real feeds.
    const parser = new XMLParser({
      ignoreAttributes: false,
      processEntities: {
        maxTotalExpansions: 100000,
        maxExpandedLength: 5000000,
      },
    });
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
        link: pickLink(item.link),
        description: typeof item.description === "string" ? item.description : String(item.summary ?? ""),
        pubDate: String(item.pubDate ?? item.published ?? ""),
        guid: String(item.guid ?? item.id ?? ""),
      }))
      .filter((a) => a.title !== "");

    ctx.logger.info(`Parsed ${articles.length} articles`);
    return { articles: z.array(ArticleSchema).parse(articles) };
  },
});
