export type IngestionRunId = string | number;

export type RawFileLocation = {
  bucket: string;
  key: string;
};

export declare function processIngestionRun(ingestionRunId: IngestionRunId): Promise<void>;
export declare function loadIngestionRunOrThrow(ingestionRunId: IngestionRunId): Promise<unknown>;
export declare function loadRawBillingFileOrThrow(rawBillingFileId: string | number): Promise<unknown>;
export declare function verifyRawFileExistsInS3(location: RawFileLocation): Promise<void>;
export declare function markRunRunning(runId: IngestionRunId): Promise<void>;
export declare function markRunCompleted(runId: IngestionRunId): Promise<void>;
export declare function markRunFailed(runId: IngestionRunId, error: unknown): Promise<void>;

export declare const ingestionOrchestrator: {
  processIngestionRun: typeof processIngestionRun;
  loadIngestionRunOrThrow: typeof loadIngestionRunOrThrow;
  loadRawBillingFileOrThrow: typeof loadRawBillingFileOrThrow;
  verifyRawFileExistsInS3: typeof verifyRawFileExistsInS3;
  markRunRunning: typeof markRunRunning;
  markRunCompleted: typeof markRunCompleted;
  markRunFailed: typeof markRunFailed;
};
