import { randomUUID } from "node:crypto";

import env from "../../../config/env.js";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../errors/http-errors.js";
import type { AwsTempCredentials } from "./s3-upload-aws.service.js";

export type S3UploadSession = {
  sessionId: string;
  tenantId: string;
  userId: string;
  roleArn: string;
  externalId: string | null;
  bucket: string;
  basePrefix: string;
  resolvedRegion: string;
  credentials: AwsTempCredentials;
  createdAt: Date;
  expiresAt: Date;
};

type CreateS3UploadSessionParams = {
  tenantId: string;
  userId: string;
  roleArn: string;
  externalId?: string | null;
  bucket: string;
  basePrefix: string;
  resolvedRegion: string;
  credentials: AwsTempCredentials;
};

const normalizeSessionId = (value: string): string => String(value ?? "").trim();

class S3UploadSessionStore {
  private readonly sessions = new Map<string, S3UploadSession>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;

    const cleanupIntervalMs = Math.max(30_000, Math.floor(this.ttlMs / 2));
    const cleanupTimer = setInterval(() => this.cleanupExpiredSessions(), cleanupIntervalMs);
    cleanupTimer.unref();
  }

  create(params: CreateS3UploadSessionParams): S3UploadSession {
    const sessionId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + this.ttlMs);
    const session: S3UploadSession = {
      sessionId,
      tenantId: params.tenantId,
      userId: params.userId,
      roleArn: params.roleArn,
      externalId: params.externalId?.trim() ? params.externalId.trim() : null,
      bucket: params.bucket,
      basePrefix: params.basePrefix,
      resolvedRegion: params.resolvedRegion,
      credentials: params.credentials,
      createdAt,
      expiresAt,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getOwnedActiveOrThrow(params: {
    sessionId: string;
    tenantId: string;
    userId: string;
  }): S3UploadSession {
    const sessionId = normalizeSessionId(params.sessionId);
    if (!sessionId) {
      throw new NotFoundError("S3 upload session not found");
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError("S3 upload session not found");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(sessionId);
      throw new UnauthorizedError("S3 upload session expired");
    }

    if (session.tenantId !== params.tenantId || session.userId !== params.userId) {
      throw new ForbiddenError("You are not allowed to use this S3 upload session");
    }

    return session;
  }

  invalidate(sessionId: string): void {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) return;
    this.sessions.delete(normalizedSessionId);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt.getTime() <= now) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

const sessionTtlMinutes = Math.max(30, Math.min(60, env.billingS3UploadSessionTtlMinutes));

export const s3UploadSessionStore = new S3UploadSessionStore(sessionTtlMinutes * 60_000);
