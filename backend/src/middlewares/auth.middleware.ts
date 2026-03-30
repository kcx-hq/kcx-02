import type { RequestHandler } from "express";

import { UnauthorizedError, ForbiddenError } from "../errors/http-errors.js";
import { AuthSession, User as UserModel } from "../models/index.js";
import type { User } from "../models/user.js";
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
    include: [{ model: UserModel }],
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

  const user = (session as unknown as { User?: User }).User;
  if (!user) {
    next(new UnauthorizedError("Invalid session"));
    return;
  }

  req.auth = {
    token,
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };

  next();
};

export const requireAdminAuth: RequestHandler = async (req, res, next) => {
  await requireAuth(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    const role = req.auth?.user.role;
    if (role !== "admin") {
      next(new ForbiddenError("Admin access required"));
      return;
    }

    next();
  });
};
