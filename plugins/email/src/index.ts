import { definePlugin } from "@barezen/sdk";
import { z } from "zod";
import nodemailer from "nodemailer";

export default definePlugin({
  name: "email",
  inputs: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    smtpHost: z.string().optional(),
    smtpPort: z.number().int().positive().default(587),
  }),
  async run(ctx) {
    const user = ctx.secrets.get("SMTP_USER");
    const pass = ctx.secrets.get("SMTP_PASS");
    const host = ctx.inputs.smtpHost ?? ctx.secrets.get("SMTP_HOST") ?? "localhost";
    const transporter = nodemailer.createTransport({ host, port: ctx.inputs.smtpPort, auth: user ? { user, pass } : undefined });
    await transporter.sendMail({ from: user, to: ctx.inputs.to, subject: ctx.inputs.subject, text: ctx.inputs.body });
    ctx.logger.info(`Email sent to ${ctx.inputs.to}`);
    return { sent: true };
  },
});
