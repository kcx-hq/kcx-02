import type { AwsDatabaseClientContext, AwsDatabaseRegion } from "../types/db-aws.types.js";

export const DEFAULT_AWS_DB_REGION: AwsDatabaseRegion = "us-east-1";

const normalizeRegion = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const resolveAwsDatabaseRegion = (context: {
  region?: string | null;
  connectionRegion?: string | null;
  connectionExportRegion?: string | null;
}): AwsDatabaseRegion => {
  return (
    normalizeRegion(context.region) ??
    normalizeRegion(context.connectionRegion) ??
    normalizeRegion(context.connectionExportRegion) ??
    DEFAULT_AWS_DB_REGION
  );
};

export const resolveAwsDatabaseRegionFromClientContext = (
  context: AwsDatabaseClientContext,
): AwsDatabaseRegion => {
  return resolveAwsDatabaseRegion({
    region: context.region,
    connectionRegion: context.connectionRegion,
    connectionExportRegion: context.connectionExportRegion,
  });
};
