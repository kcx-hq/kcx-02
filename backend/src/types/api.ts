export type ErrorPayload = {
  code: string;
  details?: unknown;
};

export type ResponseMeta = {
  timestamp: string;
  requestId?: string;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data: T | null;
  error: ErrorPayload | null;
  meta: ResponseMeta;
};
