import { BillingIngestionRunFile, RawBillingFile } from "../../../models/index.js";

export type IngestionRunFileRole = "manifest" | "data";

export type IngestionRunFileLink = {
  ingestionRunId: string;
  rawBillingFileId: string;
  fileRole: IngestionRunFileRole;
  processingOrder: number;
};

export async function linkFilesToIngestionRun(links: IngestionRunFileLink[]): Promise<void> {
  if (!Array.isArray(links) || links.length === 0) {
    return;
  }

  await BillingIngestionRunFile.bulkCreate(
    links.map((link) => ({
      ingestionRunId: String(link.ingestionRunId),
      rawBillingFileId: String(link.rawBillingFileId),
      fileRole: link.fileRole,
      processingOrder: Number(link.processingOrder),
    })),
  );
}

export async function getIngestionRunFiles(ingestionRunId: string): Promise<
  Array<{
    id: string;
    ingestionRunId: string;
    rawBillingFileId: string;
    fileRole: string;
    processingOrder: number;
    RawBillingFile?: InstanceType<typeof RawBillingFile>;
  }>
> {
  const records = await BillingIngestionRunFile.findAll({
    where: { ingestionRunId: String(ingestionRunId) },
    include: [{ model: RawBillingFile, required: true }],
    order: [
      ["fileRole", "ASC"],
      ["processingOrder", "ASC"],
      ["id", "ASC"],
    ],
  });

  return records as Array<{
    id: string;
    ingestionRunId: string;
    rawBillingFileId: string;
    fileRole: string;
    processingOrder: number;
    RawBillingFile?: InstanceType<typeof RawBillingFile>;
  }>;
}
