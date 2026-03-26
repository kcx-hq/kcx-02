import env from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { mailgunApiKey, mailgunDomain, mailgunFrom } = env;

  if (!mailgunApiKey || !mailgunDomain || !mailgunFrom) {
    throw new Error("Mailgun is not configured (MAILGUN_API_KEY/MAILGUN_DOMAIN/MAILGUN_FROM)");
  }

  const url = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;

  const body = new URLSearchParams();
  body.set("from", mailgunFrom);
  body.set("to", params.to);
  body.set("subject", params.subject);
  body.set("text", params.text);
  if (params.html) body.set("html", params.html);

  const auth = Buffer.from(`api:${mailgunApiKey}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.error("Mailgun send failed", {
      status: response.status,
      response: text.slice(0, 500),
    });
    throw new Error(`Mailgun send failed (${response.status})`);
  }
}
