import { definePlugin, fetchWithTimeout } from "@barezen/sdk";
import { z } from "zod";

export default definePlugin({
  name: "github-sync",
  inputs: z.object({
    sourceRepo: z.string(),
    targetRepo: z.string(),
    branches: z.array(z.string()).optional()
  }),
  async run(ctx) {
    const token = ctx.secrets.require("GITHUB_TOKEN");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
    const branches = ctx.inputs.branches ?? ["main"];
    const results: { branch: string; success: boolean }[] = [];
    for (const branch of branches) {
      const res = await fetchWithTimeout(`https://api.github.com/repos/${ctx.inputs.sourceRepo}/git/refs/heads/${branch}`, { headers });
      if (!res.ok) { results.push({ branch, success: false }); continue; }
      const data = await res.json() as { object: { sha: string } };
      const pushRes = await fetchWithTimeout(`https://api.github.com/repos/${ctx.inputs.targetRepo}/git/refs/heads/${branch}`, { method: "PATCH", headers, body: JSON.stringify({ sha: data.object.sha }) });
      results.push({ branch, success: pushRes.ok });
    }
    return { result: { synced: results } };
  },
});
