import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import {
  archiveAdminAnnouncement,
  createAdminAnnouncement,
  getAdminAnnouncements,
  publishAdminAnnouncement,
  unpublishAdminAnnouncement,
  updateAdminAnnouncement,
} from "./admin-announcements.service.js";
import {
  parseAdminAnnouncementListQuery,
  parseAdminAnnouncementParams,
  parseCreateAdminAnnouncementBody,
  parseUpdateAdminAnnouncementBody,
} from "./admin-announcements.validator.js";

const parseAdminIdFromRequest = (req: Request): number | null => {
  const raw = req.auth?.user?.id;
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export async function handleAdminGetAnnouncements(req: Request, res: Response): Promise<void> {
  const query = parseAdminAnnouncementListQuery(req.query);
  const data = await getAdminAnnouncements(query);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Announcements fetched",
    data,
  });
}

export async function handleAdminCreateAnnouncement(req: Request, res: Response): Promise<void> {
  const payload = parseCreateAdminAnnouncementBody(req.body);
  const data = await createAdminAnnouncement(payload, parseAdminIdFromRequest(req));

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Announcement created",
    data,
  });
}

export async function handleAdminUpdateAnnouncement(req: Request, res: Response): Promise<void> {
  const { id } = parseAdminAnnouncementParams(req.params);
  const payload = parseUpdateAdminAnnouncementBody(req.body);
  const data = await updateAdminAnnouncement(id, payload);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Announcement updated",
    data,
  });
}

export async function handleAdminPublishAnnouncement(req: Request, res: Response): Promise<void> {
  const { id } = parseAdminAnnouncementParams(req.params);
  const data = await publishAdminAnnouncement(id);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Announcement published",
    data,
  });
}

export async function handleAdminUnpublishAnnouncement(req: Request, res: Response): Promise<void> {
  const { id } = parseAdminAnnouncementParams(req.params);
  const data = await unpublishAdminAnnouncement(id);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Announcement unpublished",
    data,
  });
}

export async function handleAdminArchiveAnnouncement(req: Request, res: Response): Promise<void> {
  const { id } = parseAdminAnnouncementParams(req.params);
  const data = await archiveAdminAnnouncement(id);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Announcement archived",
    data,
  });
}
