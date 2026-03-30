import { timingSafeEqual } from "node:crypto";

import env from "../../config/env.js";
import { UnauthorizedError, InternalServerError } from "../../errors/http-errors.js";
import { AuthSession, User as UserModel } from "../../models/index.js";
import type { User } from "../../models/user.js";
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

const ensureAdminUser = async (adminEmail: string, adminPassword: string): Promise<User> => {
  const existing = await UserModel.findOne({ where: { email: adminEmail } });

  if (!existing) {
    return UserModel.create({
      firstName: "Admin",
      lastName: "User",
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      companyName: null,
      role: "admin",
      status: "active",
      source: "admin",
    });
  }

  const needsPasswordUpdate = !(await verifyPassword(adminPassword, existing.passwordHash));
  const needsRoleUpdate = existing.role !== "admin";
  const needsSourceUpdate = existing.source !== "admin";
  const needsStatusUpdate = existing.status !== "active";

  if (needsPasswordUpdate || needsRoleUpdate || needsSourceUpdate || needsStatusUpdate) {
    await UserModel.update(
      {
        ...(needsPasswordUpdate ? { passwordHash: await hashPassword(adminPassword) } : {}),
        ...(needsRoleUpdate ? { role: "admin" } : {}),
        ...(needsSourceUpdate ? { source: "admin" } : {}),
        ...(needsStatusUpdate ? { status: "active" } : {}),
      },
      { where: { id: existing.id } },
    );

    const refreshed = await UserModel.findByPk(existing.id);
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

  await AuthSession.create({
    userId: adminUser.id,
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
