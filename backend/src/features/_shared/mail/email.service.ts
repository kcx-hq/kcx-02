import { sendEmail as sendMailgunEmail } from "./mailgun.service.js";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

class MailgunEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    await sendMailgunEmail(message);
  }
}

const defaultProvider: EmailProvider = new MailgunEmailProvider();

export async function sendEmail(
  message: EmailMessage,
  provider: EmailProvider = defaultProvider,
): Promise<void> {
  await provider.send(message);
}
