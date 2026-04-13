import { Op, type WhereOptions } from "sequelize";

import { BadRequestError, NotFoundError } from "../../errors/http-errors.js";
import { SupportTicket, SupportTicketMessage, Tenant, User } from "../../models/index.js";
import type { SupportTicketStatus } from "../../models/support-ticket.js";

type SupportTicketInstance = InstanceType<typeof SupportTicket>;
type SupportTicketMessageInstance = InstanceType<typeof SupportTicketMessage>;
type UserInstance = InstanceType<typeof User>;
type TenantInstance = InstanceType<typeof Tenant>;

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const ALLOWED_PROGRESS = ["NEW", "IN_PROGRESS", "CLIENT_REVIEW", "RESOLVED", "CLOSED"] as const;

const STATUS_LABELS = new Set<SupportTicketStatus>(["Open", "Under Review", "Resolved", "Closed", "Draft", "Cancelled by Client"]);

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0);
};

const ensureRequired = (value: string, fieldLabel: string): void => {
  if (value.length === 0) throw new BadRequestError(`${fieldLabel} is required`);
};

const ensureAllowed = (value: string, allowed: readonly string[], fieldLabel: string): void => {
  if (!allowed.includes(value)) throw new BadRequestError(`${fieldLabel} is invalid`);
};

const statusCodeToLabel = (value: string): SupportTicketStatus => {
  if (value === "OPEN") return "Open";
  if (value === "UNDER_REVIEW") return "Under Review";
  if (value === "RESOLVED") return "Resolved";
  if (value === "CLOSED") return "Closed";
  if (value === "CANCELLED_BY_CLIENT") return "Cancelled by Client";
  return "Draft";
};

const statusLabelToCode = (value: string): "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED" | "DRAFT" | "CANCELLED_BY_CLIENT" => {
  if (value === "Open") return "OPEN";
  if (value === "Under Review") return "UNDER_REVIEW";
  if (value === "Resolved") return "RESOLVED";
  if (value === "Closed") return "CLOSED";
  if (value === "Cancelled by Client") return "CANCELLED_BY_CLIENT";
  return "DRAFT";
};

const statusToProgress = (status: string): string => {
  if (status === "Open") return "NEW";
  if (status === "Under Review") return "IN_PROGRESS";
  if (status === "Resolved") return "RESOLVED";
  if (status === "Closed") return "CLOSED";
  return "NEW";
};

const progressToWorkflowStage = (progress: string): string => {
  if (progress === "IN_PROGRESS") return "In Progress";
  if (progress === "CLIENT_REVIEW") return "Client Review";
  if (progress === "RESOLVED") return "Resolved";
  if (progress === "CLOSED") return "Closed";
  return "New";
};

const sanitizeClientCreatePayload = (payload: {
  title: unknown;
  category: unknown;
  priority: unknown;
  affected: unknown;
  attachments: unknown;
  description: unknown;
  saveAsDraft?: unknown;
}) => {
  const saveAsDraft = Boolean(payload.saveAsDraft);
  const title = normalizeString(payload.title);
  const category = normalizeString(payload.category);
  const priority = normalizeString(payload.priority);
  const affected = normalizeString(payload.affected);
  const description = normalizeString(payload.description);
  const attachments = asStringArray(payload.attachments);

  if (!saveAsDraft) {
    ensureRequired(title, "Title");
    ensureRequired(category, "Issue category");
    ensureRequired(affected, "Affected");
    ensureRequired(description, "Description");
    ensureAllowed(priority, ALLOWED_PRIORITIES, "Priority");
  }

  return {
    saveAsDraft,
    title: title || "Untitled draft",
    category: category || "Other",
    priority: (priority || "Medium") as string,
    affected: affected || "TBD",
    description: description || "Draft ticket",
    attachments,
  };
};

const formatTicketDateTime = (value: Date): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(value);

const mapTicketForClient = (ticket: SupportTicketInstance): {
  id: string;
  title: string;
  code: string;
  createdBy: string;
  category: string;
  priority: string;
  status: string;
  progress: string;
  workflowStage: string;
  createdDate: string;
  lastUpdated: string;
  slaDeadline: string;
  attachments: string;
  attachmentFiles: string[];
  affected: string;
  description: string;
  canClientResolve: boolean;
  canClientCancel: boolean;
} => {
  const user = (ticket as unknown as { User?: UserInstance | null }).User;
  const attachments = asStringArray(ticket.attachments);
  const normalizedStatus = STATUS_LABELS.has(ticket.status as SupportTicketStatus) ? ticket.status : "Under Review";
  const normalizedProgress = normalizeString(ticket.progress || statusToProgress(normalizedStatus));
  const canClientResolve = normalizedProgress === "CLIENT_REVIEW" && normalizedStatus !== "Cancelled by Client";
  const canClientCancel = !["Closed", "Cancelled by Client"].includes(normalizedStatus);

  return {
    id: String(ticket.id),
    title: ticket.title,
    code: ticket.ticketCode,
    createdBy: user?.fullName ?? "Client",
    category: ticket.issueCategory,
    priority: ticket.priority,
    status: normalizedStatus,
    progress: normalizedProgress,
    workflowStage: ticket.workflowStage,
    createdDate: formatTicketDateTime(ticket.createdAt ?? new Date()),
    lastUpdated: formatTicketDateTime(ticket.lastUpdatedAt ?? ticket.updatedAt ?? new Date()),
    slaDeadline: ticket.slaDeadlineAt ? formatTicketDateTime(ticket.slaDeadlineAt) : "--",
    attachments: attachments.length > 0 ? `${attachments.length} file(s)` : "None",
    attachmentFiles: attachments,
    affected: ticket.affected,
    description: ticket.description,
    canClientResolve,
    canClientCancel,
  };
};

const mapTicketForAdmin = (ticket: SupportTicketInstance): {
  id: string;
  ticket_code: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED" | "DRAFT" | "CANCELLED_BY_CLIENT";
  progress: string;
  created_at: string;
  updated_at: string;
  client_responded_at: string | null;
  client: { name: string; email: string | null };
  issue: {
    title: string;
    category: string;
    priority: string;
    description: string;
    attachments: string[];
    assigned_team: string | null;
    sla_deadline: string | null;
  };
} => {
  const user = (ticket as unknown as { User?: UserInstance | null }).User;
  const tenant = (ticket as unknown as { Tenant?: TenantInstance | null }).Tenant;

  return {
    id: String(ticket.id),
    ticket_code: ticket.ticketCode,
    status: statusLabelToCode(ticket.status),
    progress: ticket.progress || statusToProgress(ticket.status),
    created_at: (ticket.createdAt ?? new Date()).toISOString(),
    updated_at: (ticket.lastUpdatedAt ?? ticket.updatedAt ?? new Date()).toISOString(),
    client_responded_at: ticket.clientRespondedAt ? ticket.clientRespondedAt.toISOString() : null,
    client: {
      name: tenant?.name || user?.fullName || "Client",
      email: user?.email ?? null,
    },
    issue: {
      title: ticket.title,
      category: ticket.issueCategory,
      priority: ticket.priority,
      description: ticket.description,
      attachments: asStringArray(ticket.attachments),
      assigned_team: ticket.assignedTeam ?? null,
      sla_deadline: ticket.slaDeadlineAt ? ticket.slaDeadlineAt.toISOString() : null,
    },
  };
};

const mapMessageForAdmin = (message: SupportTicketMessageInstance): {
  id: string;
  sender_type: string;
  sender_name: string | null;
  message: string;
  created_at: string;
} => ({
  id: String(message.id),
  sender_type: message.senderType,
  sender_name: message.senderName,
  message: message.message,
  created_at: (message.createdAt ?? new Date()).toISOString(),
});

const generateTicketCode = (): string => {
  const randomPart = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `TIC-${randomPart}`;
};

const getTicketOrThrow = async (ticketId: string): Promise<SupportTicketInstance> => {
  const ticket = await SupportTicket.findByPk(ticketId, {
    include: [
      { model: User, attributes: ["id", "fullName", "email"] },
      { model: Tenant, attributes: ["id", "name"] },
    ],
  });
  if (!ticket) throw new NotFoundError("Support ticket not found");
  return ticket as SupportTicketInstance;
};

const getClientTicketOrThrow = async (params: {
  ticketId: string;
  tenantId: string;
}): Promise<SupportTicketInstance> => {
  const ticket = await getTicketOrThrow(params.ticketId);
  if (String(ticket.tenantId) !== String(params.tenantId)) {
    throw new NotFoundError("Support ticket not found");
  }
  return ticket;
};

export async function getClientSupportTickets(params: {
  tenantId: string;
}): Promise<{ tickets: ReturnType<typeof mapTicketForClient>[] }> {
  const tickets = await SupportTicket.findAll({
    where: { tenantId: params.tenantId },
    include: [{ model: User, attributes: ["id", "fullName", "email"] }],
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });
  return { tickets: tickets.map((ticket) => mapTicketForClient(ticket as SupportTicketInstance)) };
}

export async function getClientSupportTicketDetail(params: {
  tenantId: string;
  ticketId: string;
}): Promise<{ ticket: ReturnType<typeof mapTicketForClient> }> {
  const ticket = await getClientTicketOrThrow(params);
  return { ticket: mapTicketForClient(ticket) };
}

export async function getClientSupportTicketMessages(params: {
  tenantId: string;
  ticketId: string;
}): Promise<{ messages: ReturnType<typeof mapMessageForAdmin>[] }> {
  await getClientTicketOrThrow(params);
  const messages = await SupportTicketMessage.findAll({
    where: { ticketId: params.ticketId },
    order: [["createdAt", "ASC"], ["id", "ASC"]],
  });
  return { messages: messages.map((message) => mapMessageForAdmin(message as SupportTicketMessageInstance)) };
}

export async function createClientSupportTicket(params: {
  tenantId: string;
  userId: string;
  payload: {
    title: unknown;
    category: unknown;
    priority: unknown;
    affected: unknown;
    attachments: unknown;
    description: unknown;
    saveAsDraft?: unknown;
  };
}): Promise<{ ticket: ReturnType<typeof mapTicketForClient> }> {
  const normalized = sanitizeClientCreatePayload(params.payload);
  ensureAllowed(normalized.priority, ALLOWED_PRIORITIES, "Priority");

  let code = generateTicketCode();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const exists = await SupportTicket.findOne({ where: { ticketCode: code }, attributes: ["id"] });
    if (!exists) break;
    code = generateTicketCode();
  }

  const created = await SupportTicket.create({
    tenantId: params.tenantId,
    createdBy: params.userId,
    ticketCode: code,
    title: normalized.title,
    issueCategory: normalized.category,
    priority: normalized.priority,
    affected: normalized.affected,
    attachments: normalized.attachments,
    description: normalized.description,
    status: normalized.saveAsDraft ? "Draft" : "Under Review",
    progress: "NEW",
    workflowStage: normalized.saveAsDraft ? "Draft Saved" : "Submitted to KCX",
    lastUpdatedAt: new Date(),
  });

  const ticket = await SupportTicket.findByPk(created.id, {
    include: [{ model: User, attributes: ["id", "fullName", "email"] }],
  });
  if (!ticket) throw new NotFoundError("Ticket not found after creation");
  return { ticket: mapTicketForClient(ticket as SupportTicketInstance) };
}

export async function getAdminSupportTickets(query: {
  status?: unknown;
  search?: unknown;
  tenantId?: unknown;
}): Promise<ReturnType<typeof mapTicketForAdmin>[]> {
  const status = normalizeString(query.status);
  const search = normalizeString(query.search);
  const tenantId = normalizeString(query.tenantId);

  const where: WhereOptions = {};
  if (tenantId.length > 0) where.tenantId = tenantId;
  if (status.length > 0) {
    const mappedStatus = statusCodeToLabel(status);
    where.status = mappedStatus;
  }
  if (search.length > 0) {
    Object.assign(where, {
      [Op.or]: [
        { ticketCode: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } },
        { issueCategory: { [Op.iLike]: `%${search}%` } },
        { affected: { [Op.iLike]: `%${search}%` } },
      ],
    });
  }

  const tickets = await SupportTicket.findAll({
    where,
    include: [
      { model: User, attributes: ["id", "fullName", "email"] },
      { model: Tenant, attributes: ["id", "name"] },
    ],
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });

  return tickets.map((ticket) => mapTicketForAdmin(ticket as SupportTicketInstance));
}

export async function getAdminSupportTicketDetail(ticketId: string): Promise<ReturnType<typeof mapTicketForAdmin>> {
  const ticket = await getTicketOrThrow(ticketId);
  return mapTicketForAdmin(ticket);
}

export async function updateAdminSupportTicket(params: {
  ticketId: string;
  payload: {
    status?: unknown;
    progress?: unknown;
    assignedTeam?: unknown;
    slaDeadline?: unknown;
    workflowStage?: unknown;
    slaDeadlineAt?: unknown;
  };
}): Promise<ReturnType<typeof mapTicketForAdmin>> {
  const ticket = await getTicketOrThrow(params.ticketId);

  const nextStatusCode = normalizeString(params.payload.status);
  const nextProgress = normalizeString(params.payload.progress);
  const assignedTeam = normalizeString(params.payload.assignedTeam);
  const workflowStage = normalizeString(params.payload.workflowStage);
  const deadlineInput = normalizeString(params.payload.slaDeadline || params.payload.slaDeadlineAt);

  if (nextStatusCode.length > 0) {
    ticket.status = statusCodeToLabel(nextStatusCode);
  }
  if (nextProgress.length > 0) {
    ensureAllowed(nextProgress, ALLOWED_PROGRESS, "Progress");
    ticket.progress = nextProgress;
    ticket.workflowStage = progressToWorkflowStage(nextProgress);
  }
  if (workflowStage.length > 0) {
    ticket.workflowStage = workflowStage;
  }
  if (typeof params.payload.assignedTeam !== "undefined") {
    ticket.assignedTeam = assignedTeam.length > 0 ? assignedTeam : null;
  }
  if (deadlineInput.length > 0) {
    const parsed = new Date(deadlineInput);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestError("slaDeadline must be a valid date");
    ticket.slaDeadlineAt = parsed;
  } else if (typeof params.payload.slaDeadline !== "undefined" || typeof params.payload.slaDeadlineAt !== "undefined") {
    ticket.slaDeadlineAt = null;
  }

  if (ticket.status === "Closed") {
    ticket.closedAt = new Date();
  } else {
    ticket.closedAt = null;
  }

  ticket.lastUpdatedAt = new Date();
  await ticket.save();
  await ticket.reload({
    include: [
      { model: User, attributes: ["id", "fullName", "email"] },
      { model: Tenant, attributes: ["id", "name"] },
    ],
  });

  return mapTicketForAdmin(ticket as SupportTicketInstance);
}

export async function deleteAdminSupportTicket(ticketId: string): Promise<void> {
  const ticket = await SupportTicket.findByPk(ticketId);
  if (!ticket) throw new NotFoundError("Support ticket not found");
  await ticket.destroy();
}

export async function sendClientSupportTicketMessage(params: {
  tenantId: string;
  ticketId: string;
  message: unknown;
  senderUserId: string;
  senderName: string;
}): Promise<ReturnType<typeof mapMessageForAdmin>> {
  const message = normalizeString(params.message);
  ensureRequired(message, "Message");
  if (message.length > 2000) throw new BadRequestError("Message exceeds max length");

  const ticket = await getClientTicketOrThrow({ tenantId: params.tenantId, ticketId: params.ticketId });
  const created = await SupportTicketMessage.create({
    ticketId: params.ticketId,
    senderType: "CLIENT",
    senderUserId: params.senderUserId,
    senderName: params.senderName,
    message,
  });

  ticket.clientRespondedAt = new Date();
  ticket.lastUpdatedAt = new Date();
  if (ticket.status === "Open") {
    ticket.status = "Under Review";
  }
  await ticket.save();

  return mapMessageForAdmin(created as SupportTicketMessageInstance);
}

export async function applyClientSupportTicketAction(params: {
  tenantId: string;
  ticketId: string;
  action: unknown;
}): Promise<{ ticket: ReturnType<typeof mapTicketForClient> }> {
  const action = normalizeString(params.action).toUpperCase();
  const ticket = await getClientTicketOrThrow({ tenantId: params.tenantId, ticketId: params.ticketId });

  if (action === "RESOLVED") {
    if (ticket.progress !== "CLIENT_REVIEW") {
      throw new BadRequestError("Resolved action is only available in Client Review stage");
    }
    ticket.status = "Resolved";
    ticket.progress = "RESOLVED";
    ticket.workflowStage = "Client Confirmed Resolved";
    ticket.closedAt = new Date();
  } else if (action === "UNRESOLVED") {
    if (ticket.progress !== "CLIENT_REVIEW") {
      throw new BadRequestError("Unresolved action is only available in Client Review stage");
    }
    ticket.status = "Under Review";
    ticket.progress = "IN_PROGRESS";
    ticket.workflowStage = "Client Marked Unresolved";
    ticket.closedAt = null;
  } else if (action === "CANCEL") {
    if (ticket.status === "Closed" || ticket.status === "Cancelled by Client") {
      throw new BadRequestError("This ticket cannot be cancelled");
    }
    ticket.status = "Cancelled by Client";
    ticket.progress = "CLOSED";
    ticket.workflowStage = "Cancelled by Client";
    ticket.closedAt = new Date();
  } else {
    throw new BadRequestError("Invalid ticket action");
  }

  ticket.lastUpdatedAt = new Date();
  await ticket.save();
  await ticket.reload({
    include: [{ model: User, attributes: ["id", "fullName", "email"] }],
  });

  return { ticket: mapTicketForClient(ticket as SupportTicketInstance) };
}

export async function getAdminSupportTicketMessages(ticketId: string): Promise<ReturnType<typeof mapMessageForAdmin>[]> {
  await getTicketOrThrow(ticketId);
  const messages = await SupportTicketMessage.findAll({
    where: { ticketId },
    order: [["createdAt", "ASC"], ["id", "ASC"]],
  });
  return messages.map((message) => mapMessageForAdmin(message as SupportTicketMessageInstance));
}

export async function clearAdminSupportTicketMessages(ticketId: string): Promise<{ ticketId: string; deletedCount: number }> {
  const ticket = await getTicketOrThrow(ticketId);
  const deletedCount = await SupportTicketMessage.destroy({ where: { ticketId } });
  ticket.lastUpdatedAt = new Date();
  await ticket.save();
  return { ticketId, deletedCount };
}

export async function sendAdminSupportTicketMessage(params: {
  ticketId: string;
  message: unknown;
  senderUserId: string | null;
  senderName: string;
}): Promise<ReturnType<typeof mapMessageForAdmin>> {
  const message = normalizeString(params.message);
  ensureRequired(message, "Message");
  if (message.length > 2000) throw new BadRequestError("Message exceeds max length");

  const ticket = await getTicketOrThrow(params.ticketId);
  const created = await SupportTicketMessage.create({
    ticketId: params.ticketId,
    senderType: "ADMIN",
    senderUserId: params.senderUserId,
    senderName: params.senderName,
    message,
  });

  ticket.lastUpdatedAt = new Date();
  if (ticket.status === "Open") {
    ticket.status = "Under Review";
  }
  await ticket.save();

  return mapMessageForAdmin(created as SupportTicketMessageInstance);
}
