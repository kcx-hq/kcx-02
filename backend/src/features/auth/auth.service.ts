import env from "../../config/env.js";
import { BadRequestError, UnauthorizedError } from "../../errors/http-errors.js";
import { AuthSession, Client, PasswordResetToken, sequelize } from "../../models/index.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { generateOpaqueToken, hashToken } from "../../utils/token.js";
import { buildFrontendUrl } from "../../utils/frontend-url.js";
import { sendEmail } from "../_shared/mail/mailgun.service.js";
import { logger } from "../../utils/logger.js";

type LoginResult = {
  token: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    companyName: string | null;
    role: string;
    status: string;
    source: string;
  };
  expiresAt: string;
};

export async function loginWithEmailPassword(email: string, password: string): Promise<LoginResult> {
  const client = await Client.findOne({ where: { email } });
  if (!client) throw new UnauthorizedError("Invalid credentials");
  if (client.status === "blocked") throw new UnauthorizedError("Account is blocked");

  const ok = await verifyPassword(password, client.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid credentials");

  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60_000);

  await AuthSession.create({
    clientId: client.id,
    tokenHash,
    expiresAt,
    revokedAt: null,
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: client.id,
      email: client.email,
      firstName: client.firstName,
      lastName: client.lastName,
      companyName: client.companyName,
      role: client.role,
      status: client.status,
      source: client.source,
    },
  };
}

export async function requestPasswordReset(email: string): Promise<{ emailSent: boolean }> {
  const client = await Client.findOne({ where: { email } });
  if (!client) {
    return { emailSent: true };
  }

  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.resetTokenTtlMinutes * 60_000);

  await PasswordResetToken.create({
    clientId: client.id,
    tokenHash,
    expiresAt,
    usedAt: null,
  });

  const resetLink = buildFrontendUrl("/reset-password", { token });

  try {
    await sendEmail({
      to: client.email,
      subject: "Reset your KCX password",
      text: [
        `Hi ${client.firstName},`,
        "",
        "We received a request to reset your KCX password.",
        ...(resetLink ? [`Reset link: ${resetLink}`] : ["Reset link is currently unavailable (missing FRONTEND_BASE_URL)."]),
        "",
        `This link expires in ${env.resetTokenTtlMinutes} minutes.`,
        "",
        "If you didn't request this, you can ignore this email.",
        "",
        "— KCX",
      ].join("\n"),
    });
  } catch (error) {
    logger.error("Failed to send reset email", {
      email,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Always return success to avoid leaking whether a user exists or whether email delivery is configured.
  return { emailSent: true };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<{ success: true }> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const record = await PasswordResetToken.findOne({
    where: { tokenHash, usedAt: null },
  });

  if (!record) throw new BadRequestError("Reset token is invalid or expired");
  if (record.expiresAt.getTime() <= now.getTime()) throw new BadRequestError("Reset token is invalid or expired");

  const client = await Client.findByPk(record.clientId);
  if (!client) throw new BadRequestError("Reset token is invalid or expired");

  await sequelize.transaction(async (transaction) => {
    await Client.update(
      { passwordHash: await hashPassword(newPassword) },
      { where: { id: client.id }, transaction },
    );

    await PasswordResetToken.update({ usedAt: new Date() }, { where: { id: record.id }, transaction });

    await AuthSession.update(
      { revokedAt: new Date() },
      { where: { clientId: client.id, revokedAt: null }, transaction },
    );
  });

  try {
    await sendEmail({
      to: client.email,
      subject: "Your KCX password was changed",
      text: [
        `Hi ${client.firstName},`,
        "",
        "Your KCX password has been updated successfully.",
        "",
        "If you did not perform this action, please reset your password immediately.",
        "",
        "— KCX",
      ].join("\n"),
    });
  } catch (error) {
    logger.warn("Failed to send password changed email", {
      email: client.email,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { success: true };
}
