import { timingSafeEqual } from "node:crypto";

import env from "../../config/env.js";
import { UnauthorizedError, InternalServerError } from "../../errors/http-errors.js";
import { AdminAuthSession, AdminUser } from "../../models/index.js";
import type { AdminUser as AdminUserType } from "../../models/admin-user.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { generateOpaqueToken, hashToken } from "../../utils/token.js";

type AdminLoginResult = {
  token: string;
  expiresAt: string;
  admin: {
    id: number;
    email: string;
    role: string;
  };
};

const safeEqual = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
};

const getAdminConfig = (): { email: string; password: string } => {
  if (!env.adminEmail || !env.adminPassword) {
    throw new InternalServerError("Admin credentials are not configured");
  }

  return { email: env.adminEmail, password: env.adminPassword };
};

const ensureAdminUser = async (
  adminEmail: string,
  adminPassword: string,
): Promise<AdminUserType> => {
  const existing = await AdminUser.findOne({ where: { email: adminEmail } });

  if (!existing) {
    return AdminUser.create({
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "admin",
      status: "active",
    });
  }

  const needsPasswordUpdate = !(await verifyPassword(adminPassword, existing.passwordHash));
  const needsRoleUpdate = existing.role !== "admin";
  const needsStatusUpdate = existing.status !== "active";

  if (needsPasswordUpdate || needsRoleUpdate || needsStatusUpdate) {
    await AdminUser.update(
      {
        ...(needsPasswordUpdate ? { passwordHash: await hashPassword(adminPassword) } : {}),
        ...(needsRoleUpdate ? { role: "admin" } : {}),
        ...(needsStatusUpdate ? { status: "active" } : {}),
      },
      { where: { id: existing.id } },
    );

    const refreshed = await AdminUser.findByPk(existing.id);
    if (refreshed) {
      return refreshed;
    }
  }

  return existing;
};

export async function loginAdminWithEmailPassword(
  email: string,
  password: string,
): Promise<AdminLoginResult> {
  const config = getAdminConfig();

  const emailOk = email.toLowerCase() === config.email.toLowerCase();
  const passwordOk = safeEqual(password, config.password);

  if (!emailOk || !passwordOk) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const adminUser = await ensureAdminUser(config.email, config.password);

  const token = generateOpaqueToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60_000);

  await AdminAuthSession.create({
    adminUserId: adminUser.id,
    tokenHash,
    expiresAt,
    revokedAt: null,
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    admin: {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    },
  };
}
