import { BadRequestError, NotFoundError } from "../../errors/http-errors.js";
import { SupportMeeting, Tenant, User } from "../../models/index.js";
import type { SupportMeetingStatus } from "../../models/support-meeting.js";

type SupportMeetingInstance = InstanceType<typeof SupportMeeting>;
type UserInstance = InstanceType<typeof User>;
type TenantInstance = InstanceType<typeof Tenant>;

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const ensureRequired = (value: string, fieldLabel: string): void => {
  if (value.length === 0) throw new BadRequestError(`${fieldLabel} is required`);
};

const parseDateOrThrow = (value: string, fieldLabel: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestError(`${fieldLabel} must be a valid date`);
  return parsed;
};

const getMeetingOrThrow = async (meetingId: string): Promise<SupportMeetingInstance> => {
  const meeting = await SupportMeeting.findByPk(meetingId, {
    include: [
      { model: User, attributes: ["id", "fullName", "email"] },
      { model: Tenant, attributes: ["id", "name"] },
    ],
  });
  if (!meeting) throw new NotFoundError("Meeting request not found");
  return meeting as SupportMeetingInstance;
};

const getClientMeetingOrThrow = async (params: {
  meetingId: string;
  tenantId: string;
}): Promise<SupportMeetingInstance> => {
  const meeting = await getMeetingOrThrow(params.meetingId);
  if (String(meeting.tenantId) !== String(params.tenantId)) {
    throw new NotFoundError("Meeting request not found");
  }
  return meeting;
};

const generateMeetingCode = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 9).toUpperCase();
  return `MTG-${randomPart}`;
};

const randomMeetCodePart = (size: number): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length: size })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
};

const generateDefaultMeetingUrl = (): string => {
  return `https://meet.google.com/${randomMeetCodePart(3)}-${randomMeetCodePart(4)}-${randomMeetCodePart(3)}`;
};

const statusToAfterSummary = (status: SupportMeetingStatus | string): string => {
  if (status === "COMPLETED") return "Meeting completed";
  if (status === "REJECTED") return "Rejected by KCX";
  if (status === "CANCELLED") return "Cancelled by client";
  if (status === "SCHEDULED") return "Meeting approved";
  return "Pending summary";
};

const mapMeetingForClient = (meeting: SupportMeetingInstance): {
  id: string;
  code: string;
  title: string;
  meetingType: string;
  agenda: string;
  mode: string;
  status: SupportMeetingStatus | string;
  slotStart: string;
  slotEnd: string;
  timeZone: string;
  meetingUrl: string | null;
  requestedBy: string;
  host: string;
  duration: string;
  afterSummary: string;
  createdAt: string;
  updatedAt: string;
} => {
  const requester = (meeting as unknown as { User?: UserInstance | null }).User;
  const durationMs = meeting.slotEnd.getTime() - meeting.slotStart.getTime();
  const durationMinutes = Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs / 60000) : 30;

  return {
    id: String(meeting.id),
    code: meeting.meetingCode,
    title: `${meeting.meetingType} Session`,
    meetingType: meeting.meetingType,
    agenda: meeting.agenda,
    mode: meeting.mode,
    status: meeting.status,
    slotStart: meeting.slotStart.toISOString(),
    slotEnd: meeting.slotEnd.toISOString(),
    timeZone: meeting.timeZone,
    meetingUrl: meeting.meetingUrl,
    requestedBy: requester?.fullName || "You",
    host: "KCX Support",
    duration: `${durationMinutes} min`,
    afterSummary: meeting.afterMeetingSummary || statusToAfterSummary(meeting.status),
    createdAt: (meeting.createdAt ?? new Date()).toISOString(),
    updatedAt: (meeting.updatedAt ?? new Date()).toISOString(),
  };
};

const mapMeetingForAdmin = (meeting: SupportMeetingInstance): {
  id: string;
  meeting_code: string;
  meeting_type: string;
  agenda: string;
  mode: string;
  status: SupportMeetingStatus | string;
  slot_start: string;
  slot_end: string;
  time_zone: string;
  meeting_url: string | null;
  after_meeting_summary: string | null;
  created_at: string;
  updated_at: string;
  client: { id: string; name: string; email: string | null; company_name: string | null };
} => {
  const requester = (meeting as unknown as { User?: UserInstance | null }).User;
  const tenant = (meeting as unknown as { Tenant?: TenantInstance | null }).Tenant;

  return {
    id: String(meeting.id),
    meeting_code: meeting.meetingCode,
    meeting_type: meeting.meetingType,
    agenda: meeting.agenda,
    mode: meeting.mode,
    status: meeting.status,
    slot_start: meeting.slotStart.toISOString(),
    slot_end: meeting.slotEnd.toISOString(),
    time_zone: meeting.timeZone,
    meeting_url: meeting.meetingUrl,
    after_meeting_summary: meeting.afterMeetingSummary,
    created_at: (meeting.createdAt ?? new Date()).toISOString(),
    updated_at: (meeting.updatedAt ?? new Date()).toISOString(),
    client: {
      id: requester?.id ? String(requester.id) : "",
      name: requester?.fullName || "Client",
      email: requester?.email ?? null,
      company_name: tenant?.name ?? null,
    },
  };
};

export async function getClientSupportMeetings(params: {
  tenantId: string;
}): Promise<{ meetings: ReturnType<typeof mapMeetingForClient>[] }> {
  const meetings = await SupportMeeting.findAll({
    where: { tenantId: params.tenantId },
    include: [{ model: User, attributes: ["id", "fullName", "email"] }],
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });
  return { meetings: meetings.map((meeting) => mapMeetingForClient(meeting as SupportMeetingInstance)) };
}

export async function createClientSupportMeeting(params: {
  tenantId: string;
  userId: string;
  payload: {
    meetingType: unknown;
    agenda: unknown;
    mode?: unknown;
    slotStart: unknown;
    slotEnd: unknown;
    timeZone: unknown;
  };
}): Promise<{ meeting: ReturnType<typeof mapMeetingForClient> }> {
  const meetingType = normalizeString(params.payload.meetingType);
  const agenda = normalizeString(params.payload.agenda);
  const mode = normalizeString(params.payload.mode) || "Google Meet";
  const timeZone = normalizeString(params.payload.timeZone) || "Asia/Kolkata";
  const slotStart = parseDateOrThrow(normalizeString(params.payload.slotStart), "slotStart");
  const slotEnd = parseDateOrThrow(normalizeString(params.payload.slotEnd), "slotEnd");

  ensureRequired(meetingType, "Meeting type");
  ensureRequired(agenda, "Agenda");
  if (agenda.length < 1) throw new BadRequestError("Agenda is required");
  if (slotEnd.getTime() <= slotStart.getTime()) {
    throw new BadRequestError("slotEnd must be after slotStart");
  }

  let meetingCode = generateMeetingCode();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const exists = await SupportMeeting.findOne({ where: { meetingCode }, attributes: ["id"] });
    if (!exists) break;
    meetingCode = generateMeetingCode();
  }

  const created = await SupportMeeting.create({
    tenantId: params.tenantId,
    requestedBy: params.userId,
    meetingCode,
    meetingType,
    agenda,
    mode,
    status: "REQUESTED",
    slotStart,
    slotEnd,
    timeZone,
    meetingUrl: null,
    afterMeetingSummary: "Pending approval from KCX",
  });

  const meeting = await SupportMeeting.findByPk(created.id, {
    include: [{ model: User, attributes: ["id", "fullName", "email"] }],
  });
  if (!meeting) throw new NotFoundError("Meeting request not found after creation");
  return { meeting: mapMeetingForClient(meeting as SupportMeetingInstance) };
}

export async function applyClientSupportMeetingAction(params: {
  tenantId: string;
  meetingId: string;
  action: unknown;
}): Promise<{ meeting: ReturnType<typeof mapMeetingForClient> }> {
  const action = normalizeString(params.action).toUpperCase();
  const meeting = await getClientMeetingOrThrow({ meetingId: params.meetingId, tenantId: params.tenantId });

  if (action !== "CANCEL") throw new BadRequestError("Invalid meeting action");
  if (meeting.status === "COMPLETED" || meeting.status === "CANCELLED" || meeting.status === "REJECTED") {
    throw new BadRequestError("This meeting cannot be cancelled");
  }

  meeting.status = "CANCELLED";
  meeting.afterMeetingSummary = "Cancelled by client";
  meeting.updatedAt = new Date();
  await meeting.save();
  await meeting.reload({ include: [{ model: User, attributes: ["id", "fullName", "email"] }] });
  return { meeting: mapMeetingForClient(meeting as SupportMeetingInstance) };
}

export async function getAdminSupportMeetings(): Promise<ReturnType<typeof mapMeetingForAdmin>[]> {
  const meetings = await SupportMeeting.findAll({
    include: [
      { model: User, attributes: ["id", "fullName", "email"] },
      { model: Tenant, attributes: ["id", "name"] },
    ],
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });

  return meetings.map((meeting) => mapMeetingForAdmin(meeting as SupportMeetingInstance));
}

export async function approveAdminSupportMeeting(params: {
  meetingId: string;
  adminId: number;
  meetingUrl?: unknown;
}): Promise<ReturnType<typeof mapMeetingForAdmin>> {
  const meeting = await getMeetingOrThrow(params.meetingId);
  if (meeting.status !== "REQUESTED") {
    throw new BadRequestError("Only requested meetings can be approved");
  }

  const providedMeetingUrl = normalizeString(params.meetingUrl);
  meeting.status = "SCHEDULED";
  meeting.meetingUrl = providedMeetingUrl || generateDefaultMeetingUrl();
  meeting.approvedByAdminId = params.adminId;
  meeting.approvedAt = new Date();
  meeting.afterMeetingSummary = "Meeting approved by KCX";
  meeting.updatedAt = new Date();
  await meeting.save();
  await meeting.reload({
    include: [
      { model: User, attributes: ["id", "fullName", "email"] },
      { model: Tenant, attributes: ["id", "name"] },
    ],
  });
  return mapMeetingForAdmin(meeting as SupportMeetingInstance);
}

export async function rejectAdminSupportMeeting(params: {
  meetingId: string;
}): Promise<ReturnType<typeof mapMeetingForAdmin>> {
  const meeting = await getMeetingOrThrow(params.meetingId);
  if (meeting.status !== "REQUESTED") {
    throw new BadRequestError("Only requested meetings can be rejected");
  }

  meeting.status = "REJECTED";
  meeting.afterMeetingSummary = "Rejected by KCX";
  meeting.updatedAt = new Date();
  await meeting.save();
  await meeting.reload({
    include: [
      { model: User, attributes: ["id", "fullName", "email"] },
      { model: Tenant, attributes: ["id", "name"] },
    ],
  });
  return mapMeetingForAdmin(meeting as SupportMeetingInstance);
}
