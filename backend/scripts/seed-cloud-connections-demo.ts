import { CloudConnectionV2, sequelize } from "../src/models/index.js";
import util from "node:util";

type CloudConnectionSeedRow = {
  id: string;
  tenantId: string;
  connectionName: string;
  accountType: "payer" | "member";
  status: "draft" | "connecting" | "awaiting_validation" | "active" | "active_with_warnings" | "failed" | "suspended";
  region: string | null;
  externalId: string | null;
  callbackToken: string | null;
  stackName: string | null;
  stackId: string | null;
  cloudAccountId: string | null;
  payerAccountId: string | null;
  billingRoleArn: string | null;
  actionRoleArn: string | null;
  exportName: string | null;
  exportBucket: string | null;
  exportPrefix: string | null;
  exportRegion: string | null;
  exportArn: string | null;
  createdBy: string | null;
  connectedAt: Date | null;
  lastValidatedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  providerId: string;
};

const rows: CloudConnectionSeedRow[] = [
 
  {
    id: "56c5b1c4-2906-469a-9027-7d2ff46dc138",
    tenantId: "afb79228-f0e1-48d6-856e-fb8a1f7884d5",
    connectionName: "kcx-123",
    accountType: "payer",
    status: "active",
    region: "us-east-1",
    externalId: "kcx-3426eead-90f4-4310-b277-30e78dfb50e1",
    callbackToken: "bbccad5d156ad9951bbd6cd9f174ab5c719255af95405b8ca4ac09ebe38670c6",
    stackName: "kcx-56c5b1c4",
    stackId:
      "arn:aws:cloudformation:us-east-1:231016597055:stack/kcx-56c5b1c4-BillingExportStack-C4JEHUT7C1EK/3dc439b0-3c7b-11f1-9d5b-12b05513a495",
    cloudAccountId: "231016597055",
    payerAccountId: null,
    billingRoleArn: "arn:aws:iam::231016597055:role/kcx-kcx-123-billing-role",
    actionRoleArn: "arn:aws:iam::231016597055:role/kcx-kcx-123-action-role",
    exportName: "KCX-CUR2-56c5b1c429",
    exportBucket: "kcx-billing-export-231016597055-us-east-1-kcx-123",
    exportPrefix: "kcx/data-exports/cur2",
    exportRegion: "us-east-1",
    exportArn: "arn:aws:bcm-data-exports:us-east-1:231016597055:export/KCX-CUR2-56c5b1c429-04a05279-c83f-429f-b7f9-42c954fad071",
    createdBy: "42e34836-df13-4079-bdd8-6f2ab0e51ae8",
    connectedAt: new Date("2026-04-20T05:40:25.855Z"),
    lastValidatedAt: new Date("2026-04-20T05:40:28.984Z"),
    errorMessage: null,
    createdAt: new Date("2026-04-20T05:36:45.655Z"),
    updatedAt: new Date("2026-04-20T05:40:31.809Z"),
    providerId: "6",
  },

];

async function main(): Promise<void> {
  console.info("Seeding cloud connection rows", { count: rows.length });

  let insertedOrUpdated = 0;
  for (const row of rows) {
    try {
      await CloudConnectionV2.upsert(row as any);
      insertedOrUpdated += 1;
    } catch (error) {
      console.error("Upsert failed for cloud connection row", {
        id: row.id,
        tenantId: row.tenantId,
        providerId: row.providerId,
        status: row.status,
        error,
      });
      throw error;
    }
  }

  console.info("Cloud connection seed completed", {
    insertedOrUpdated,
    ids: rows.map((row) => row.id),
  });
}

main()
  .catch((error) => {
    console.error("Cloud connection seed failed:", util.inspect(error, { depth: 10, colors: false }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
