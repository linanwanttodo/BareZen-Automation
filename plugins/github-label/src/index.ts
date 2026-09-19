import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "github-label",
  inputs: z.object({
    repo: z.string(),
    name: z.string(),
    color: z.string().optional(),
    description: z.string().optional(),
    action: z.enum(["create", "update", "delete"]).default("create")
  }),
  async run(ctx) {
    const token = ctx.secrets.require("GITHUB_TOKEN");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
    const url = `https://api.github.com/repos/${ctx.inputs.repo}/labels`;
    const res = await fetchWithTimeout(url, { method: "POST", headers, body: JSON.stringify({ name: ctx.inputs.name, color: ctx.inputs.color, description: ctx.inputs.description }) });
    const data = await res.json() as { id: number; name: string };
    return { result: { id: data.id, name: data.name } };
  },
});
