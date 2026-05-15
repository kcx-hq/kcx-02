import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";

import { DbAwsMissingSdkClientError } from "../errors/db-aws.errors.js";
import { normalizeDbAwsError } from "../errors/db-aws-error-normalizer.js";
import {
  AWS_DATABASE_CLIENT_KIND_MODULE,
  type AwsDatabaseClientContext,
  type AwsDatabaseClientKind,
  type AwsDatabaseCredentialsContext,
} from "../types/db-aws.types.js";
import { resolveAwsDatabaseCredentialsContext } from "../credentials/db-aws-credentials.resolver.js";

type DynamicClientCtor = new (input: {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}) => unknown;

const CLIENT_EXPORT_NAME_BY_KIND: Readonly<Record<AwsDatabaseClientKind, string>> = {
  rds: "RDSClient",
  aurora: "RDSClient",
  dynamodb: "DynamoDBClient",
  elasticache: "ElastiCacheClient",
  memorydb: "MemoryDBClient",
  documentdb: "DocDBClient",
  neptune: "NeptuneClient",
  keyspaces: "KeyspacesClient",
  timestream: "TimestreamWriteClient",
  cloudwatch: "CloudWatchClient",
};

const KIND_TO_MODULE_KEY: Readonly<Record<AwsDatabaseClientKind, AwsDatabaseClientKind | "rds">> = {
  rds: "rds",
  aurora: "rds",
  dynamodb: "dynamodb",
  elasticache: "elasticache",
  memorydb: "memorydb",
  documentdb: "documentdb",
  neptune: "neptune",
  keyspaces: "keyspaces",
  timestream: "timestream",
  cloudwatch: "cloudwatch",
};

const buildClientFromContext = (ClientCtor: DynamicClientCtor, context: AwsDatabaseCredentialsContext): unknown => {
  const sessionToken = typeof context.sessionToken === "string" && context.sessionToken.trim()
    ? context.sessionToken
    : undefined;

  return new ClientCtor({
    region: context.region,
    credentials: {
      accessKeyId: context.accessKeyId,
      secretAccessKey: context.secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    },
  });
};

const resolveModuleNameForKind = (kind: AwsDatabaseClientKind): string | null => {
  const moduleKey = KIND_TO_MODULE_KEY[kind];
  return AWS_DATABASE_CLIENT_KIND_MODULE[moduleKey] ?? null;
};

const loadDynamicClientCtor = async (kind: AwsDatabaseClientKind): Promise<DynamicClientCtor> => {
  const moduleName = resolveModuleNameForKind(kind);
  if (!moduleName) {
    throw new DbAwsMissingSdkClientError(kind, "<unknown>", {
      reason: "No SDK module mapping found for client kind",
    });
  }

  let sdkModule: Record<string, unknown>;
  try {
    sdkModule = (await import(moduleName)) as Record<string, unknown>;
  } catch (error) {
    throw new DbAwsMissingSdkClientError(kind, moduleName, {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  const exportName = CLIENT_EXPORT_NAME_BY_KIND[kind];
  const maybeCtor = sdkModule[exportName];
  if (typeof maybeCtor !== "function") {
    throw new DbAwsMissingSdkClientError(kind, moduleName, {
      reason: `Expected export '${exportName}' was not found`,
    });
  }

  return maybeCtor as DynamicClientCtor;
};

export const createAwsDatabaseClientFromCredentials = async <TClient = unknown>(input: {
  kind: AwsDatabaseClientKind;
  credentialsContext: AwsDatabaseCredentialsContext;
}): Promise<TClient> => {
  const { kind, credentialsContext } = input;

  try {
    if (kind === "cloudwatch") {
      return buildClientFromContext(CloudWatchClient as unknown as DynamicClientCtor, credentialsContext) as TClient;
    }

    const ClientCtor = await loadDynamicClientCtor(kind);
    return buildClientFromContext(ClientCtor, credentialsContext) as TClient;
  } catch (error) {
    if (error instanceof DbAwsMissingSdkClientError) throw error;
    throw normalizeDbAwsError(error, {
      kind,
      tenantId: credentialsContext.tenantId,
      cloudConnectionId: credentialsContext.cloudConnectionId,
      region: credentialsContext.region,
    });
  }
};

export const createAwsDatabaseClient = async <TClient = unknown>(input: {
  kind: AwsDatabaseClientKind;
  context: AwsDatabaseClientContext;
}): Promise<TClient> => {
  const credentialsContext = await resolveAwsDatabaseCredentialsContext({
    roleArn: input.context.roleArn,
    externalId: input.context.externalId ?? null,
    region: input.context.region ?? null,
    connectionRegion: input.context.connectionRegion ?? null,
    connectionExportRegion: input.context.connectionExportRegion ?? null,
    tenantId: input.context.tenantId,
    cloudConnectionId: input.context.cloudConnectionId,
  });

  return createAwsDatabaseClientFromCredentials<TClient>({
    kind: input.kind,
    credentialsContext,
  });
};

export const createAwsRdsClient = async <TClient = unknown>(
  context: AwsDatabaseClientContext,
): Promise<TClient> => {
  return createAwsDatabaseClient<TClient>({ kind: "rds", context });
};

export const createAwsAuroraClient = async <TClient = unknown>(
  context: AwsDatabaseClientContext,
): Promise<TClient> => {
  return createAwsDatabaseClient<TClient>({ kind: "aurora", context });
};

export const createAwsCloudWatchClient = async <TClient = unknown>(
  context: AwsDatabaseClientContext,
): Promise<TClient> => {
  return createAwsDatabaseClient<TClient>({ kind: "cloudwatch", context });
};
