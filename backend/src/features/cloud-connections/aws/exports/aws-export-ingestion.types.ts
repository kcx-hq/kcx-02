export type AwsManifestPayload = {
  callbackToken: string;
  accountId: string;
  region: string;
  roleArn: string;
  bucketName: string;
  manifestKey: string;
};

export type ParsedManifestFile = {
  key: string;
  sizeBytes: number | null;
  checksum: string | null;
};

export type ParsedManifest = {
  manifestKey: string;
  manifestVersion: string | null;
  exportArn: string | null;
  createdAt: string | null;
  files: ParsedManifestFile[];
  rawManifest: Record<string, unknown>;
};

export type QueueManifestResult = {
  queued: boolean;
  skipped: boolean;
  reason?: string;
  ingestionRunId?: string;
  manifestRawBillingFileId?: string;
  parquetRawBillingFileIds?: string[];
  parquetFileCount?: number;
};

export type AwsParquetSchemaValidationResult = {
  success: boolean;
  rawBillingFileId: string;
  key: string;
  matchedCanonicalColumns: string[];
  missingRequiredColumns: string[];
  unknownColumns: string[];
  ambiguousColumns: Array<{
    header: string;
    candidates: string[];
  }>;
};
