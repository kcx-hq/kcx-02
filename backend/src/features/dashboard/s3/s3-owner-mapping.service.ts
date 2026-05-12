import type { S3CostBucketTableInsight, S3FinopsBucketBase } from "./s3-cost-insights.types.js";

type OwnerMapping = {
  ownerTeam: string;
  applicationName: string;
  businessUnit: string;
  environment: string;
  costCenter: string;
  technicalOwner: string | null;
  financeOwner: string | null;
  criticality: string;
  supportChannel: string | null;
};

export class S3OwnerMappingService {
  buildOwnerMap(
    buckets: S3FinopsBucketBase[],
    bucketTable: S3CostBucketTableInsight[],
  ): Map<string, OwnerMapping> {
    const map = new Map<string, OwnerMapping>();
    const rowByBucket = new Map(bucketTable.map((row) => [row.bucketName, row]));

    for (const bucket of buckets) {
      const row = rowByBucket.get(bucket.bucketName);
      const ownerRaw = String(row?.owner ?? bucket.owner ?? "Unassigned");
      const driverRaw = String(row?.driver ?? bucket.applicationName ?? "Unspecified");
      const ownerTeam = ownerRaw.trim().length > 0 && ownerRaw !== "Unassigned" ? ownerRaw : "UNMAPPED";
      const applicationName = driverRaw.trim().length > 0 && driverRaw !== "Other" ? driverRaw : "UNMAPPED";
      const businessUnit = this.deriveBusinessUnit(ownerTeam, applicationName);

      map.set(bucket.bucketName, {
        ownerTeam,
        applicationName,
        businessUnit,
        environment: this.deriveEnvironment(bucket.bucketName),
        costCenter: this.deriveCostCenter(ownerTeam, businessUnit),
        technicalOwner: ownerTeam === "UNMAPPED" ? null : ownerTeam,
        financeOwner: ownerTeam === "UNMAPPED" ? null : `${businessUnit}-finance`,
        criticality: bucket.cost >= 500 ? "high" : bucket.cost >= 100 ? "medium" : "low",
        supportChannel: ownerTeam === "UNMAPPED" ? null : `#finops-${ownerTeam.toLowerCase().replace(/\s+/g, "-")}`,
      });
    }

    return map;
  }

  private deriveBusinessUnit(ownerTeam: string, applicationName: string): string {
    const normalized = `${ownerTeam} ${applicationName}`.toLowerCase();
    if (normalized.includes("data") || normalized.includes("analytics")) return "Data";
    if (normalized.includes("ml") || normalized.includes("ai")) return "AI";
    if (normalized.includes("platform") || normalized.includes("core")) return "Platform";
    if (ownerTeam === "UNMAPPED") return "UNMAPPED";
    return "Product";
  }

  private deriveEnvironment(bucketName: string): string {
    const normalized = bucketName.toLowerCase();
    if (normalized.includes("prod")) return "prod";
    if (normalized.includes("stage") || normalized.includes("stg")) return "stage";
    if (normalized.includes("dev") || normalized.includes("test")) return "non-prod";
    return "unknown";
  }

  private deriveCostCenter(ownerTeam: string, businessUnit: string): string {
    if (ownerTeam === "UNMAPPED") return "UNMAPPED";
    return `${businessUnit.toUpperCase()}-${ownerTeam.toUpperCase().replace(/[^A-Z0-9]/g, "")}`.slice(0, 32);
  }
}

export type { OwnerMapping };
