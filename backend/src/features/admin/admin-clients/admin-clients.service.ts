import { DemoRequest, Tenant, User } from "../../../models/index.js";

type UserInstance = InstanceType<typeof User>;
type TenantInstance = InstanceType<typeof Tenant>;

export type AdminClientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  heardAboutUs: string | null;
  status: string;
  source: string;
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

const toClientSummary = (
  user: UserInstance,
  latestDemoRequestByUserId: Map<string, InstanceType<typeof DemoRequest>>,
): AdminClientSummary => {
  const { firstName, lastName } = splitFullName(user.fullName);
  const tenant = getTenant(user);
  const latestDemoRequest = latestDemoRequestByUserId.get(user.id);
  return {
    id: user.id,
    firstName,
    lastName,
    email: user.email,
    companyName: tenant?.name ?? null,
    heardAboutUs: latestDemoRequest?.heardAboutUs ?? null,
    status: user.status,
    source: latestDemoRequest ? "Schedule Demo" : "Direct",
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

  const userIds = users.map((user) => user.id);
  const latestDemoRequestByUserId = new Map<string, InstanceType<typeof DemoRequest>>();

  if (userIds.length > 0) {
    const demoRequests = await DemoRequest.findAll({
      where: { userId: userIds },
      order: [["updatedAt", "DESC"]],
    });

    for (const demoRequest of demoRequests) {
      if (!latestDemoRequestByUserId.has(demoRequest.userId)) {
        latestDemoRequestByUserId.set(demoRequest.userId, demoRequest);
      }
    }
  }

  return users.map((user) => toClientSummary(user, latestDemoRequestByUserId));
}
