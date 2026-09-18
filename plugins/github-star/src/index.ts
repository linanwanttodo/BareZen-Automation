import { definePlugin } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "github-star",
  inputs: z.object({
    repo: z.string(),
    action: z.enum(["star", "unstar"]).default("star")
  }),
  async run(ctx) {
    const token = ctx.secrets.require("GITHUB_TOKEN");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
    const method = ctx.inputs.action === "star" ? "PUT" : "DELETE";
    const res = await fetch(`https://api.github.com/user/starred/${ctx.inputs.repo}`, { method, headers });
    return { result: { starred: ctx.inputs.action === "star", success: res.ok } };
  },
});
