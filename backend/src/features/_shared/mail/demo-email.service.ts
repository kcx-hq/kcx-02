import { logger } from "../../../utils/logger.js";
import { formatUtcSlotRangeForEmail } from "../../../utils/slot-display.js";
import { sendEmail } from "./email.service.js";

type DemoEmailParams = {
  firstName: string;
  email: string;
  slotStart: Date;
  slotEnd: Date;
  timeZone?: string;
};

type DemoConfirmedEmailParams = DemoEmailParams & {
  meetingType?: string | null;
  meetingUrl?: string | null;
};

export async function sendDemoRequestReceivedEmail(params: DemoEmailParams): Promise<boolean> {
  try {
    await sendEmail({
      to: params.email,
      subject: "KCX demo request received",
      text: [
        `Hi ${params.firstName},`,
        "",
        "Thanks for requesting a KCX demo.",
        `Requested slot: ${formatUtcSlotRangeForEmail(params.slotStart, params.slotEnd, params.timeZone)}`,
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

export async function sendDemoConfirmedEmail(params: DemoConfirmedEmailParams): Promise<boolean> {
  try {
    const normalizedMeetingUrl =
      typeof params.meetingUrl === "string" && params.meetingUrl.trim().length > 0
        ? params.meetingUrl.trim()
        : null;
    const normalizedMeetingType =
      typeof params.meetingType === "string" && params.meetingType.trim().length > 0
        ? params.meetingType.trim()
        : "Google Meet";

    await sendEmail({
      to: params.email,
      subject: "Your KCX demo is confirmed",
      text: [
        `Hi ${params.firstName},`,
        "",
        "Your KCX demo request has been confirmed.",
        `Confirmed slot: ${formatUtcSlotRangeForEmail(params.slotStart, params.slotEnd, params.timeZone)}`,
        "",
        ...(normalizedMeetingUrl
          ? [`Where: ${normalizedMeetingType}`, `Meeting URL: ${normalizedMeetingUrl}`, ""]
          : []),
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
        `Requested slot: ${formatUtcSlotRangeForEmail(params.slotStart, params.slotEnd, params.timeZone)}`,
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
