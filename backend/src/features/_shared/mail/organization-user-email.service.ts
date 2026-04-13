import { buildFrontendUrl } from "../../../utils/frontend-url.js";
import { logger } from "../../../utils/logger.js";
import { sendEmail } from "./email.service.js";

type OrganizationInviteEmailParams = {
  email: string;
  inviteeName: string;
  invitedByName: string;
  role: "member" | "admin";
};

export async function sendOrganizationInviteEmail(params: OrganizationInviteEmailParams): Promise<boolean> {
  try {
    const loginUrl = buildFrontendUrl("/login");
    await sendEmail({
      to: params.email,
      subject: "You have been invited to your company workspace",
      text: [
        `Hi ${params.inviteeName},`,
        "",
        `${params.invitedByName} invited you to join your company workspace on KCX.`,
        `Assigned role: ${params.role}`,
        "",
        ...(loginUrl ? [`Sign in: ${loginUrl}`, ""] : []),
        "If you believe this was sent by mistake, please contact your company administrator.",
        "",
        "- KCX",
      ].join("\n"),
    });
    return true;
  } catch (error) {
    logger.error("Failed to send organization invite email", {
      email: params.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

