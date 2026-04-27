import type { RequestHandler } from "express";

import { requireAdminAuth, requireAuth } from "./auth.middleware.js";

const PUBLIC_EXACT_PATHS = new Set<string>([
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/admin/auth/login",
  "/api/aws/callback",
  "/api/aws/export-file-arrived",
]);

const PUBLIC_PREFIX_PATHS = ["/schedule-demo"];

const isPublicPath = (path: string): boolean => {
  if (PUBLIC_EXACT_PATHS.has(path)) return true;
  return PUBLIC_PREFIX_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

export const apiSecurityMiddleware: RequestHandler = (req, res, next) => {
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const path = req.path;

  if (isPublicPath(path)) {
    next();
    return;
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    requireAdminAuth(req, res, next);
    return;
  }

  requireAuth(req, res, next);
};
