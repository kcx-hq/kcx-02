export type AdminCloudIntegrationMode = "manual" | "automatic";

export type AdminCloudIntegrationStatus =
  | "draft"
  | "connecting"
  | "awaiting_validation"
  | "active"
  | "active_with_warnings"
  | "failed"
  | "suspended";

export type AdminCloudConnectionsListQuery = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  provider?: unknown;
  mode?: unknown;
  status?: unknown;
  billingSourceLinked?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
};

export type AdminCloudConnectionsListQueryParsed = {
  page: number;
  limit: number;
  search: string | null;
  provider: string | null;
  mode: AdminCloudIntegrationMode | null;
  status: AdminCloudIntegrationStatus | null;
  billingSourceLinked: boolean | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  sortBy:
    | "displayName"
    | "status"
    | "mode"
    | "cloudAccountId"
    | "lastValidatedAt"
    | "connectedAt"
    | "createdAt"
    | "updatedAt";
  sortOrder: "asc" | "desc";
};

export type AdminCloudConnectionListItem = {
  id: string;
  displayName: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  provider: {
    id: number;
    code: string;
    name: string;
  };
  mode: AdminCloudIntegrationMode;
  status: AdminCloudIntegrationStatus;
  statusMessage: string | null;
  errorMessage: string | null;
  cloudAccountId: string | null;
  payerAccountId: string | null;
  detailRecordType: string;
  detailRecordId: string;
  billingSource: {
    linked: boolean;
    id: number | null;
    sourceType: string | null;
    setupMode: string | null;
    status: string | null;
  };
  timestamps: {
    connectedAt: string | null;
    lastValidatedAt: string | null;
    lastSuccessAt: string | null;
    lastCheckedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  latestIngestion: {
    hasData: boolean;
    lastFileReceivedAt: string | null;
    lastIngestedAt: string | null;
    latestRunId: number | null;
    latestRunStatus: string | null;
  };
};

export type AdminCloudConnectionListResponse = {
  data: AdminCloudConnectionListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    draft: number;
    connecting: number;
    awaitingValidation: number;
    active: number;
    activeWithWarnings: number;
    failed: number;
    suspended: number;
    billingSourceMissing: number;
  };
};

export type AutomaticConnectionDetail = {
  kind: "automatic";
  id: string;
  connectionName: string;
  accountType: string;
  region: string | null;
  externalId: string | null;
  callbackToken: string | null;
  stackName: string | null;
  stackId: string | null;
  roleArn: string | null;
  cloudAccountId: string | null;
  payerAccountId: string | null;
  export: {
    name: string | null;
    bucket: string | null;
    prefix: string | null;
    region: string | null;
    arn: string | null;
  };
  connectedAt: string | null;
  lastValidatedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ManualConnectionDetail = {
  kind: "manual";
  id: string;
  connectionName: string;
  awsAccountId: string;
  roleArn: string;
  externalId: string;
  bucketName: string;
  prefix: string | null;
  reportName: string | null;
  validationStatus: string;
  assumeRoleSuccess: boolean;
  status: string;
  lastValidatedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCloudConnectionDetailResponse = {
  data: {
    integration: {
      id: string;
      displayName: string;
      mode: AdminCloudIntegrationMode;
      status: AdminCloudIntegrationStatus;
      statusMessage: string | null;
      errorMessage: string | null;
      cloudAccountId: string | null;
      payerAccountId: string | null;
      detailRecordType: string;
      detailRecordId: string;
      detailRecordMissing: boolean;
      timestamps: {
        connectedAt: string | null;
        lastValidatedAt: string | null;
        lastSuccessAt: string | null;
        lastCheckedAt: string | null;
        createdAt: string;
        updatedAt: string;
      };
    };
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
    provider: {
      id: number;
      code: string;
      name: string;
    };
    connectionDetail: AutomaticConnectionDetail | ManualConnectionDetail | null;
    billingSource: {
      linked: boolean;
      id: number | null;
      sourceName: string | null;
      sourceType: string | null;
      setupMode: string | null;
      format: string | null;
      schemaType: string | null;
      bucketName: string | null;
      pathPrefix: string | null;
      filePattern: string | null;
      cadence: string | null;
      status: string | null;
      isTemporary: boolean | null;
      lastValidatedAt: string | null;
      lastFileReceivedAt: string | null;
      lastIngestedAt: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
    latestIngestion: {
      hasData: boolean;
      latestRun: {
        id: number;
        status: string;
        currentStep: string | null;
        progressPercent: number;
        statusMessage: string | null;
        rowsRead: number;
        rowsLoaded: number;
        rowsFailed: number;
        startedAt: string | null;
        finishedAt: string | null;
        createdAt: string;
        updatedAt: string;
      } | null;
      latestRawFile: {
        id: number;
        originalFileName: string;
        fileFormat: string;
        status: string;
        rawStorageBucket: string;
        rawStorageKey: string;
        createdAt: string;
      } | null;
    };
  };
};

