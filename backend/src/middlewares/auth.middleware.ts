import type { RequestHandler } from "express";

import { UnauthorizedError, ForbiddenError } from "../errors/http-errors.js";
import {
  AdminAuthSession,
  AdminUser as AdminUserModel,
  AuthSession,
  Client as ClientModel,
} from "../models/index.js";
import type { AdminUser } from "../models/admin-user.js";
import type { Client } from "../models/client.js";
import { hashToken } from "../utils/token.js";

const getBearerToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = getBearerToken(req.header("authorization"));
  if (!token) {
    next(new UnauthorizedError("Missing Authorization header"));
    return;
  }

  const session = await AuthSession.findOne({
    where: { tokenHash: hashToken(token), revokedAt: null },
    include: [{ model: ClientModel }],
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

  const client = (session as unknown as { Client?: Client }).Client;
  if (!client) {
    next(new UnauthorizedError("Invalid session"));
    return;
  }

  req.auth = {
    token,
    sessionId: session.id,
    user: {
      id: client.id,
      email: client.email,
      role: client.role,
    },
  };

  next();
};

export const requireAdminAuth: RequestHandler = async (req, res, next) => {
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
