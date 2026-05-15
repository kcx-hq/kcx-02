export type AwsDatabaseFamily =
  | "relational"
  | "key_value"
  | "in_memory"
  | "document"
  | "graph"
  | "wide_column"
  | "time_series";

export type AwsDatabaseService =
  | "rds"
  | "aurora"
  | "dynamodb"
  | "elasticache"
  | "memorydb"
  | "documentdb"
  | "neptune"
  | "keyspaces"
  | "timestream";

export type AwsDatabaseClientKind = AwsDatabaseService | "cloudwatch";

export type AwsDatabaseRegion = string;

export type AwsDatabaseCredentialsContext = {
  tenantId: string;
  cloudConnectionId: string;
  roleArn: string;
  externalId: string | null;
  region: AwsDatabaseRegion;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | null;
};

export type AwsDatabaseClientContext = {
  tenantId: string;
  cloudConnectionId: string;
  roleArn: string;
  externalId?: string | null;
  region?: AwsDatabaseRegion | null;
  connectionRegion?: AwsDatabaseRegion | null;
  connectionExportRegion?: AwsDatabaseRegion | null;
};

export const AWS_DATABASE_FAMILY_SERVICES: Readonly<Record<AwsDatabaseFamily, readonly AwsDatabaseService[]>> = {
  relational: ["rds", "aurora"],
  key_value: ["dynamodb"],
  in_memory: ["elasticache", "memorydb"],
  document: ["documentdb"],
  graph: ["neptune"],
  wide_column: ["keyspaces"],
  time_series: ["timestream"],
};

export const AWS_DATABASE_SERVICE_FAMILY: Readonly<Record<AwsDatabaseService, AwsDatabaseFamily>> = {
  rds: "relational",
  aurora: "relational",
  dynamodb: "key_value",
  elasticache: "in_memory",
  memorydb: "in_memory",
  documentdb: "document",
  neptune: "graph",
  keyspaces: "wide_column",
  timestream: "time_series",
};

export const AWS_DATABASE_CLIENT_KIND_MODULE: Readonly<
  Partial<Record<AwsDatabaseClientKind, string>>
> = {
  rds: "@aws-sdk/client-rds",
  dynamodb: "@aws-sdk/client-dynamodb",
  elasticache: "@aws-sdk/client-elasticache",
  memorydb: "@aws-sdk/client-memorydb",
  documentdb: "@aws-sdk/client-docdb",
  neptune: "@aws-sdk/client-neptune",
  keyspaces: "@aws-sdk/client-keyspaces",
  timestream: "@aws-sdk/client-timestream-write",
};
