import { logger } from "../../../utils/logger.js";
import { sendEmail } from "./email.service.js";

type DemoEmailParams = {
  firstName: string;
  email: string;
  slotStart: Date;
  slotEnd: Date;
};

const formatSlot = (slotStart: Date, slotEnd: Date): string =>
  `${slotStart.toISOString()} to ${slotEnd.toISOString()}`;

export async function sendDemoRequestReceivedEmail(params: DemoEmailParams): Promise<boolean> {
  try {
    await sendEmail({
      to: params.email,
      subject: "KCX demo request received",
      text: [
        `Hi ${params.firstName},`,
        "",
        "Thanks for requesting a KCX demo.",
        `Requested slot: ${formatSlot(params.slotStart, params.slotEnd)}`,
        "",
        "Our team will review your request and confirm shortly.",
        "",
        "- KCX",
      ].join("\n"),
    });
    return true;
  } catch (error) {
    logger.error("Failed to send demo request received email", {
      email: params.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function sendDemoConfirmedEmail(params: DemoEmailParams): Promise<boolean> {
  try {
    await sendEmail({
      to: params.email,
      subject: "Your KCX demo is confirmed",
      text: [
        `Hi ${params.firstName},`,
        "",
        "Your KCX demo request has been confirmed.",
        `Confirmed slot: ${formatSlot(params.slotStart, params.slotEnd)}`,
        "",
        "We look forward to speaking with you.",
        "",
        "- KCX",
      ].join("\n"),
    });
    return true;
  } catch (error) {
    logger.error("Failed to send demo confirmed email", {
      email: params.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function sendDemoRejectedEmail(params: DemoEmailParams): Promise<boolean> {
  try {
    await sendEmail({
      to: params.email,
      subject: "Update on your KCX demo request",
      text: [
        `Hi ${params.firstName},`,
        "",
        "We are sorry, but we could not confirm your selected demo slot.",
        `Requested slot: ${formatSlot(params.slotStart, params.slotEnd)}`,
        "",
        "Please submit another request and pick a different slot.",
        "",
        "- KCX",
      ].join("\n"),
    });
    return true;
  } catch (error) {
    logger.error("Failed to send demo rejected email", {
      email: params.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
