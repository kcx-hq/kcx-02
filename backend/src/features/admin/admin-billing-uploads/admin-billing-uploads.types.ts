export type AdminBillingUploadNormalizedStatus =
  | "queued"
  | "processing"
  | "completed"
  | "warning"
  | "failed";

export type AdminBillingUploadStatusLabel = "Queued" | "Processing" | "Completed" | "Warning" | "Failed";

export type AdminBillingUploadsListQuery = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  status?: unknown;
  sourceType?: unknown;
  clientId?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
};

export type AdminBillingUploadsListQueryParsed = {
  page: number;
  limit: number;
  search: string | null;
  status: string | null;
  sourceType: string | null;
  clientId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  sortBy: "created_at" | "started_at" | "finished_at" | "status";
  sortOrder: "asc" | "desc";
};

export type AdminBillingUploadsListRow = {
  runId: number;
  client: {
    id: string;
    name: string;
  };
  source: {
    type: string;
    label: string;
  };
  file: {
    name: string;
    format: string;
  };
  status: {
    raw: string;
    normalized: AdminBillingUploadNormalizedStatus;
    label: AdminBillingUploadStatusLabel;
  };
  progress: {
    percent: number;
  };
  startedAt: string | null;
  finishedAt: string | null;
  hasErrors: boolean;
};

export type AdminBillingUploadsListResult = {
  data: AdminBillingUploadsListRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    status: string | null;
    sourceType: string | null;
    clientId: string | null;
    search: string | null;
  };
  sort: {
    sortBy: "created_at" | "started_at" | "finished_at" | "status";
    sortOrder: "asc" | "desc";
  };
};

export type AdminBillingUploadDetails = {
  runOverview: {
    runId: number;
    status: {
      raw: string;
      normalized: AdminBillingUploadNormalizedStatus;
      label: AdminBillingUploadStatusLabel;
    };
    currentStep: string | null;
    progressPercent: number;
    statusMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    lastHeartbeatAt: string | null;
  };
  client: {
    id: string;
    name: string;
  };
  sourceContext: {
    billingSourceId: number;
    sourceName: string;
    sourceType: string;
    setupMode: string;
    isTemporary: boolean;
    sourceStatus: string;
    cloudProvider: {
      id: number;
      code: string;
      name: string;
    };
    cloudConnectionId: string | null;
  };
  fileContext: {
    rawBillingFileId: number;
    originalFileName: string;
    originalFilePath: string | null;
    fileFormat: string;
    fileSizeBytes: number | null;
    checksum: string | null;
    uploadedAt: string;
    uploadedBy: {
      id: string;
      fullName: string;
      email: string;
    } | null;
  };
  rawStorageContext: {
    bucket: string;
    key: string;
    status: string;
    persistedToRawStorage: boolean;
  };
  processingMetrics: {
    rowsRead: number;
    rowsLoaded: number;
    rowsFailed: number;
    totalRowsEstimated: number | null;
  };
  failureDetails: {
    errorMessage: string | null;
    rowErrorCount: number;
    sampleRowErrors: Array<{
      id: number;
      rowNumber: number | null;
      errorCode: string | null;
      errorMessage: string;
      createdAt: string;
    }>;
  };
  relatedFiles: Array<{
    rawBillingFileId: number;
    fileRole: string;
    processingOrder: number;
    originalFileName: string;
    fileFormat: string;
    status: string;
  }>;
};