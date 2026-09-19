import { definePlugin, fetchWithTimeout, splitText } from "@barezen/sdk";
import { z } from "zod";

/** Telegram caps a message at 4096 characters. */
const MESSAGE_LIMIT = 4000;

interface TelegramReply {
  ok: boolean;
  description?: string;
}

export default definePlugin({
  name: "telegram",
  inputs: z.object({
    message: z.string(),
    chatId: z.string().optional(),
  }),
  async run(ctx) {
    const token = ctx.secrets.require("TELEGRAM_BOT_TOKEN");
    const chatId = ctx.inputs.chatId ?? ctx.secrets.get("TELEGRAM_CHAT_ID");
    if (chatId === undefined || chatId === "") {
      throw new Error(
        "telegram needs a chat id via the `chatId` input or TELEGRAM_CHAT_ID",
      );
    }

    const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const chunks = splitText(ctx.inputs.message, MESSAGE_LIMIT);

    for (const [index, chunk] of chunks.entries()) {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      };
      // Only the first chunk carries formatting; a split Markdown block would
      // make the API reject every following chunk.
      if (index === 0) body.parse_mode = "Markdown";

      const reply = await postTelegram(endpoint, body);
      if (reply.ok !== true) {
        if (index === 0) {
          // Malformed Markdown: retry this chunk as plain text before giving up.
          const fallback = await postTelegram(endpoint, { ...body, parse_mode: undefined });
          if (fallback.ok !== true) {
            throw new Error(`telegram send failed: ${String(fallback.description ?? "unknown")}`);
          }
          continue;
        }
        throw new Error(`telegram send failed: ${String(reply.description ?? "unknown")}`);
      }
    }

    ctx.logger.info(`telegram sent ${chunks.length} message(s)`);
    return { sent: true, parts: chunks.length };
  },
});

async function postTelegram(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<TelegramReply> {
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Telegram reports failures as HTTP 200 with ok: false, so the status line
  // alone cannot decide success.
  const parsed = (await response.json().catch(() => ({ ok: false }))) as unknown;
  if (typeof parsed !== "object" || parsed === null) return { ok: false };
  return parsed as TelegramReply;
}
