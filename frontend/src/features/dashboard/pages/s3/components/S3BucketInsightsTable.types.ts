export type S3BucketTableRow = {
  bucketName: string;
  account: string;
  cost: number;
  storage: number;
  requests: number;
  transfer: number;
  region: string;
  owner: string;
  driver: string;
  retrieval: number;
  other: number;
  replicationStatus?: string | null;
  versioningStatus?: string | null;
  encryptionStatus?: string | null;
  publicAccessStatus?: "Public" | "Private" | "Unknown";
  trendPct: number;
  storageLens?: {
    usageDate: string;
    objectCount: number | null;
    currentVersionBytes: number | null;
    avgObjectSizeBytes: number | null;
    accessCount: number | null;
    percentInGlacier: number;
    storageClassDistribution: Array<{
      name: string;
      bytes: number;
      percent: number;
    }>;
  } | null;
};
