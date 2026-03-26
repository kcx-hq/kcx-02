import { sequelize, DemoRequest, User, PasswordResetToken } from "../../models/index.js";
import env from "../../config/env.js";
import { generateTemporaryPassword, hashPassword } from "../../utils/password.js";
import { generateOpaqueToken, hashToken } from "../../utils/token.js";
import { sendEmail } from "../_shared/mail/mailgun.service.js";
import { logger } from "../../utils/logger.js";
import { buildFrontendUrl } from "../../utils/frontend-url.js";

import type { ScheduleDemoInput } from "./schedule-demo.validator.js";

type SubmitScheduleDemoResult = {
  demoRequestId: number;
  userId: number;
  isNewUser: boolean;
  emailSent: boolean;
};

export async function submitScheduleDemo(
  input: ScheduleDemoInput,
): Promise<SubmitScheduleDemoResult> {
  const now = new Date();
  const resetExpiry = new Date(now.getTime() + env.resetTokenTtlMinutes * 60_000);

  let isNewUser = false;
  let tempPassword: string | null = null;
  let resetToken: string | null = null;

  const { demoRequest, user } = await sequelize.transaction(async (transaction) => {
    const existing = await User.findOne({
      where: { email: input.companyEmail },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!existing) {
      isNewUser = true;
      tempPassword = generateTemporaryPassword();
    }

    const user =
      existing ??
      (await User.create(
        {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.companyEmail,
          passwordHash: await hashPassword(tempPassword ?? generateTemporaryPassword()),
          companyName: input.companyName,
          role: "client",
          status: "active",
          source: "schedule_demo",
        },
        { transaction },
      ));

    if (isNewUser) {
      resetToken = generateOpaqueToken(32);
      await PasswordResetToken.create(
        {
          userId: user.id,
          tokenHash: hashToken(resetToken),
          expiresAt: resetExpiry,
          usedAt: null,
        },
        { transaction },
      );
    }

    const demoRequest = await DemoRequest.create(
      {
        userId: user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        companyEmail: input.companyEmail,
        companyName: input.companyName,
        heardAboutUs: input.heardAboutUs,
        status: "submitted",
      },
      { transaction },
    );

    return { demoRequest, user };
  });

  const resetLink = resetToken ? buildFrontendUrl("/reset-password", { token: resetToken }) : null;

  let emailSent = false;
  try {
    const subject = "KCX demo request received";
    const lines: string[] = [
      `Hi ${input.firstName},`,
      "",
      "Thanks for requesting a KCX demo. We'll reach out shortly to schedule a time.",
      "",
      `Login email: ${input.companyEmail}`,
    ];

    if (isNewUser && tempPassword) {
      lines.push(`Temporary password: ${tempPassword}`);
      if (resetLink) {
        lines.push("", `Set a new password here: ${resetLink}`);
      }
    }

    lines.push("", "— KCX");

    await sendEmail({
      to: input.companyEmail,
      subject,
      text: lines.join("\n"),
    });
    emailSent = true;
  } catch (error) {
    logger.error("Failed to send schedule demo email", {
      email: input.companyEmail,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    demoRequestId: demoRequest.id,
    userId: user.id,
    isNewUser,
    emailSent,
  };
}
