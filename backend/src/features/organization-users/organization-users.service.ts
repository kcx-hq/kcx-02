import { Op } from "sequelize";

import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/http-errors.js";
import { User } from "../../models/index.js";
import { generateTemporaryPassword, hashPassword } from "../../utils/password.js";
import { sendOrganizationInviteEmail } from "../_shared/mail/organization-user-email.service.js";

type UserInstance = InstanceType<typeof User>;

const ADMIN_ROLES = new Set(["admin"]);

type OrganizationUserView = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  invitedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isPrimaryAdmin: boolean;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, " ");

const mapUser = (user: UserInstance, primaryAdminId: string | null): OrganizationUserView => ({
  id: String(user.id),
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  invitedAt: user.invitedAt ? user.invitedAt.toISOString() : null,
  approvedAt: user.approvedAt ? user.approvedAt.toISOString() : null,
  createdAt: (user.createdAt ?? new Date()).toISOString(),
  updatedAt: (user.updatedAt ?? new Date()).toISOString(),
  isPrimaryAdmin: Boolean(primaryAdminId) && String(user.id) === String(primaryAdminId),
});

async function assertTenantAdmin(params: { actorUserId: string; tenantId: string }): Promise<UserInstance> {
  const actor = await User.findOne({
    where: {
      id: params.actorUserId,
      tenantId: params.tenantId,
      status: "active",
    },
  });

  if (!actor) {
    throw new ForbiddenError("Only organization administrators can manage users.");
  }

  if (!ADMIN_ROLES.has(actor.role)) {
    throw new ForbiddenError("Only organization administrators can manage users.");
  }

  return actor;
}

async function getPrimaryAdminId(tenantId: string): Promise<string | null> {
  const primaryAdmin = await User.findOne({
    where: {
      tenantId,
      role: { [Op.in]: [...ADMIN_ROLES] },
      status: "active",
    },
    order: [["createdAt", "ASC"]],
    attributes: ["id"],
  });

  return primaryAdmin ? String(primaryAdmin.id) : null;
}

async function getTenantUserOrThrow(params: { tenantId: string; userId: string }): Promise<UserInstance> {
  const user = await User.findOne({
    where: {
      id: params.userId,
      tenantId: params.tenantId,
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
}

export async function getOrganizationUsers(params: {
  tenantId: string;
  actorUserId: string;
}): Promise<{ users: OrganizationUserView[] }> {
  await assertTenantAdmin(params);
  const primaryAdminId = await getPrimaryAdminId(params.tenantId);

  const users = await User.findAll({
    where: { tenantId: params.tenantId },
    order: [["createdAt", "ASC"]],
  });

  return { users: users.map((user) => mapUser(user, primaryAdminId)) };
}

export async function inviteOrganizationUser(params: {
  tenantId: string;
  actorUserId: string;
  payload: {
    fullName: string;
    email: string;
    role: "member" | "admin";
  };
}): Promise<{ user: OrganizationUserView; invited: boolean }> {
  const actor = await assertTenantAdmin(params);
  const primaryAdminId = await getPrimaryAdminId(params.tenantId);
  const now = new Date();
  const normalizedEmail = normalizeEmail(params.payload.email);
  const normalizedName = normalizeName(params.payload.fullName);

  const existingByEmail = await User.findOne({
    where: { email: normalizedEmail },
  });

  if (existingByEmail && String(existingByEmail.tenantId) !== String(params.tenantId)) {
    throw new ConflictError("This email is already associated with another organization.");
  }

  let user: UserInstance;
  if (existingByEmail) {
    user = existingByEmail;
    if (user.status === "active") {
      throw new ConflictError("User already has active access.");
    }

    user.fullName = normalizedName;
    user.role = params.payload.role;
    user.status = "invited";
    user.invitedByUserId = actor.id;
    user.invitedAt = now;
    user.approvedByUserId = null;
    user.approvedAt = null;
    await user.save();
  } else {
    user = await User.create({
      tenantId: params.tenantId,
      fullName: normalizedName,
      email: normalizedEmail,
      passwordHash: await hashPassword(generateTemporaryPassword()),
      role: params.payload.role,
      status: "invited",
      invitedByUserId: actor.id,
      invitedAt: now,
      approvedByUserId: null,
      approvedAt: null,
    });
  }

  await sendOrganizationInviteEmail({
    email: user.email,
    inviteeName: user.fullName,
    invitedByName: actor.fullName,
    role: params.payload.role,
  });

  return {
    user: mapUser(user, primaryAdminId),
    invited: true,
  };
}

export async function approveOrganizationUser(params: {
  tenantId: string;
  actorUserId: string;
  targetUserId: string;
}): Promise<{ user: OrganizationUserView; approved: boolean }> {
  const actor = await assertTenantAdmin(params);
  const primaryAdminId = await getPrimaryAdminId(params.tenantId);
  const user = await getTenantUserOrThrow({ tenantId: params.tenantId, userId: params.targetUserId });

  if (user.status === "active") {
    return { user: mapUser(user, primaryAdminId), approved: true };
  }

  user.status = "active";
  user.approvedByUserId = actor.id;
  user.approvedAt = new Date();
  await user.save();

  return { user: mapUser(user, primaryAdminId), approved: true };
}

export async function updateOrganizationUserStatus(params: {
  tenantId: string;
  actorUserId: string;
  targetUserId: string;
  status: "active" | "inactive";
}): Promise<{ user: OrganizationUserView; updated: boolean }> {
  const actor = await assertTenantAdmin(params);
  const primaryAdminId = await getPrimaryAdminId(params.tenantId);
  const user = await getTenantUserOrThrow({ tenantId: params.tenantId, userId: params.targetUserId });

  if (String(user.id) === String(actor.id) && params.status === "inactive") {
    throw new BadRequestError("You cannot deactivate your own account.");
  }

  if (primaryAdminId && String(user.id) === String(primaryAdminId) && params.status === "inactive") {
    throw new BadRequestError("Primary administrator cannot be deactivated.");
  }

  user.status = params.status;
  if (params.status === "active") {
    user.approvedByUserId = actor.id;
    user.approvedAt = new Date();
  }
  await user.save();

  return { user: mapUser(user, primaryAdminId), updated: true };
}
