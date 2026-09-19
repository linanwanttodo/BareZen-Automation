/**
 * BareZen markdown-report plugin — articles in, Markdown out.
 *
 * Lets a digest flow work without an AI step: the same upstream sources feed a
 * deterministic report instead of a model call.
 */

import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

const ArticleSchema = z.object({
  title: z.string(),
  link: z.string().optional(),
  description: z.string().optional(),
  pubDate: z.string().optional(),
});

export default definePlugin({
  name: "markdown-report",
  inputs: z.object({
    articles: z.array(z.unknown()),
    heading: z.string().optional(),
    limit: z.number().int().positive().default(20),
  }),
  async run(ctx) {
    const articles = ctx.inputs.articles
      .map((item) => ArticleSchema.safeParse(item))
      .filter((parsed) => parsed.success)
      .map((parsed) => (parsed as { data: z.infer<typeof ArticleSchema> }).data)
      .filter((article) => article.title.trim() !== "")
      .slice(0, ctx.inputs.limit);

    const lines: string[] = [];
    if (ctx.inputs.heading !== undefined) lines.push(`# ${ctx.inputs.heading}`, "");

    if (articles.length === 0) {
      lines.push("_Nothing was fetched._");
    }

    articles.forEach((article, index) => {
      const title = article.link !== undefined && article.link !== ""
        ? `[${article.title}](${article.link})`
        : article.title;
      lines.push(`${index + 1}. **${title}**`);
      const extras = [
        article.description,
        article.pubDate !== undefined && article.pubDate !== "" ? article.pubDate : undefined,
      ].filter((extra): extra is string => extra !== undefined && extra !== "");
      if (extras.length > 0) lines.push(`   > ${extras.join(" · ")}`);
    });

    const text = lines.join("\n");
    ctx.logger.info(`rendered ${articles.length} article(s) as markdown`);
    return { text, count: articles.length };
  },
});
