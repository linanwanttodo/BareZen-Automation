import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "github-release",
  inputs: z.object({
    repo: z.string(),
    tag: z.string(),
    body: z.string().optional(),
    action: z.enum(["create", "update", "delete"]).default("create")
  }),
  async run(ctx) {
    const token = ctx.secrets.require("GITHUB_TOKEN");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
    const url = `https://api.github.com/repos/${ctx.inputs.repo}/releases`;
    if (ctx.inputs.action === "create") {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ tag_name: ctx.inputs.tag, body: ctx.inputs.body }) });
      const data = await res.json() as { id: number; html_url: string };
      return { result: { id: data.id, url: data.html_url } };
    }
    return { result: { action: ctx.inputs.action, tag: ctx.inputs.tag } };
  },
});
