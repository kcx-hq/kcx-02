import type { RequestHandler } from "express";

import env from "../config/env.js";
import { UnauthorizedError, ForbiddenError } from "../errors/http-errors.js";
import {
  AdminAuthSession,
  AdminUser as AdminUserModel,
  AuthSession,
  User as UserModel,
} from "../models/index.js";
import type { AdminUser } from "../models/admin-user.js";
import { hashToken } from "../utils/token.js";
import { verifyJwt } from "../utils/jwt.js";

const getBearerToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  if (!env.jwtSecret) {
    next(new UnauthorizedError("JWT auth is not configured"));
    return;
  }

  const token = getBearerToken(req.header("authorization"));
  if (!token) {
    next(new UnauthorizedError("Missing Authorization header"));
    return;
  }
  const payload = verifyJwt(token, env.jwtSecret);
  if (!payload) {
    next(new UnauthorizedError("Invalid or expired token"));
    return;
  }

  if (payload.iss !== env.jwtIssuer || payload.type !== "user_access") {
    next(new UnauthorizedError("Invalid token"));
    return;
  }

  const userId = typeof payload.sub === "string" ? payload.sub : null;
  if (!userId) {
    next(new UnauthorizedError("Invalid token"));
    return;
  }

  const session = await AuthSession.findOne({
    where: { tokenHash: hashToken(token), revokedAt: null },
  });

  if (!session) {
    next(new UnauthorizedError("Invalid session"));
    return;
  }

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    next(new UnauthorizedError("Session expired"));
    return;
  }

  const user = await UserModel.findByPk(userId);
  if (!user) {
    next(new UnauthorizedError("Invalid session"));
    return;
  }
  if (user.status !== "active") {
    next(new UnauthorizedError("User is not active"));
    return;
  }

  req.auth = {
    token,
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    },
  };

  next();
};

export const requireAdminAuth: RequestHandler = async (req, _res, next) => {
  const token = getBearerToken(req.header("authorization"));
  if (!token) {
    next(new UnauthorizedError("Missing Authorization header"));
    return;
  }

  const session = await AdminAuthSession.findOne({
    where: { tokenHash: hashToken(token), revokedAt: null },
    include: [{ model: AdminUserModel }],
  });

  if (!session) {
    next(new UnauthorizedError("Invalid session"));
    return;
  }

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    next(new UnauthorizedError("Session expired"));
    return;
  }

  const admin = (session as unknown as { AdminUser?: AdminUser }).AdminUser;
  if (!admin) {
    next(new UnauthorizedError("Invalid session"));
    return;
  }

  if (admin.role !== "admin") {
    next(new ForbiddenError("Admin access required"));
    return;
  }

  req.auth = {
    token,
    sessionId: session.id,
    user: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
  };

  next();
};
