import { createS3Client, getObject, listObjects, type ListedS3Object } from "./aws-s3.service.js";
import { assumeRole } from "./aws-sts.service.js";

type ListExportFilesParams = {
  roleArn: string;
  externalId?: string | null;
  region: string;
  bucket: string;
  prefix?: string;
};

type DownloadExportFileParams = {
  roleArn: string;
  externalId?: string | null;
  region: string;
  bucket: string;
  key: string;
};

export async function listExportFiles({
  roleArn,
  externalId,
  region,
  bucket,
  prefix,
}: ListExportFilesParams): Promise<ListedS3Object[]> {
  const credentials = await assumeRole(roleArn, externalId);
  const s3Client = createS3Client(region, credentials);
  return listObjects({
    client: s3Client,
    bucket,
    prefix,
  });
}

export async function downloadExportFile({
  roleArn,
  externalId,
  region,
  bucket,
  key,
}: DownloadExportFileParams): Promise<string> {
  const credentials = await assumeRole(roleArn, externalId);
  const s3Client = createS3Client(region, credentials);
  return getObject({
    client: s3Client,
    bucket,
    key,
  });
}
