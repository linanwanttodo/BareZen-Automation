import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "github-pr",
  inputs: z.object({
    repo: z.string(),
    title: z.string(),
    body: z.string().optional(),
    base: z.string().default("main"),
    head: z.string(),
    action: z.enum(["create", "merge"]).default("create")
  }),
  async run(ctx) {
    const token = ctx.secrets.require("GITHUB_TOKEN");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
    const url = `https://api.github.com/repos/${ctx.inputs.repo}/pulls`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ title: ctx.inputs.title, body: ctx.inputs.body, base: ctx.inputs.base, head: ctx.inputs.head }) });
    const data = await res.json() as { number: number; html_url: string };
    return { result: { number: data.number, url: data.html_url } };
  },
});
