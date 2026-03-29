import { Client } from "../../models/index.js";

type ClientInstance = InstanceType<typeof Client>;

export type AdminClientSummary = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string | null;
  heardAboutUs: string | null;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

const toClientSummary = (client: ClientInstance): AdminClientSummary => {
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    companyName: client.companyName,
    heardAboutUs: client.heardAboutUs,
    status: client.status,
    source: client.source,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
};

export async function getAdminClients(): Promise<AdminClientSummary[]> {
  const clients = await Client.findAll({
    order: [["createdAt", "DESC"]],
  });

  return clients.map((client) => toClientSummary(client));
}
