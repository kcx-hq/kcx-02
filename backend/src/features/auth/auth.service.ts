import env from "../../config/env.js";
import { BadRequestError, UnauthorizedError } from "../../errors/http-errors.js";
import { AuthSession, PasswordResetToken, Tenant, User, sequelize } from "../../models/index.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { generateOpaqueToken, hashToken } from "../../utils/token.js";
import { buildFrontendUrl } from "../../utils/frontend-url.js";
import { sendEmail } from "../_shared/mail/mailgun.service.js";
import { logger } from "../../utils/logger.js";

type LoginResult = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    tenant: { id: string; name: string; slug: string } | null;
    role: string;
    status: string;
  };
  expiresAt: string;
};

const firstNameFromFullName = (fullName: string): string => {
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "there";
};

export async function loginWithEmailPassword(email: string, password: string): Promise<LoginResult> {
  const user = await User.findOne({ where: { email }, include: [{ model: Tenant }] });
  if (!user) throw new UnauthorizedError("Invalid credentials");
  if (user.status !== "active") throw new UnauthorizedError("Account is not active");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid credentials");

  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60_000);

  await AuthSession.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    revokedAt: null,
  });

  const tenant = (user as unknown as { Tenant?: InstanceType<typeof Tenant> }).Tenant ?? null;

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
      role: user.role,
      status: user.status,
    },
  };
}

export async function requestPasswordReset(email: string): Promise<{ emailSent: boolean }> {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    return { emailSent: true };
  }

  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.resetTokenTtlMinutes * 60_000);

  await PasswordResetToken.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    usedAt: null,
  });

  const resetLink = buildFrontendUrl("/reset-password", { token });

  try {
    await sendEmail({
      to: user.email,
      subject: "Reset your KCX password",
      text: [
        `Hi ${firstNameFromFullName(user.fullName)},`,
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

  const user = await User.findByPk(record.userId);
  if (!user) throw new BadRequestError("Reset token is invalid or expired");

  await sequelize.transaction(async (transaction) => {
    await User.update(
      { passwordHash: await hashPassword(newPassword) },
      { where: { id: user.id }, transaction },
    );

    await PasswordResetToken.update({ usedAt: new Date() }, { where: { id: record.id }, transaction });

    await AuthSession.update(
      { revokedAt: new Date() },
      { where: { userId: user.id, revokedAt: null }, transaction },
    );
  });

  try {
    await sendEmail({
      to: user.email,
      subject: "Your KCX password was changed",
      text: [
        `Hi ${firstNameFromFullName(user.fullName)},`,
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
      email: user.email,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { success: true };
}
