import { Tenant, User } from "../../models/index.js";

type UserInstance = InstanceType<typeof User>;
type TenantInstance = InstanceType<typeof Tenant>;

export type AdminClientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  status: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const getTenant = (user: UserInstance): TenantInstance | null => {
  return (user as unknown as { Tenant?: TenantInstance }).Tenant ?? null;
};

const toClientSummary = (user: UserInstance): AdminClientSummary => {
  const { firstName, lastName } = splitFullName(user.fullName);
  const tenant = getTenant(user);
  return {
    id: user.id,
    firstName,
    lastName,
    email: user.email,
    companyName: tenant?.name ?? null,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
};

export async function getAdminClients(): Promise<AdminClientSummary[]> {
  const users = await User.findAll({
    order: [["createdAt", "DESC"]],
    include: [{ model: Tenant }],
  });

  return users.map((user) => toClientSummary(user));
}
