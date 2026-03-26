import type { Request, Response } from "express";
import type { ApiResponse, ResponseMeta } from "../types/api.js";

type SuccessResponseParams<T> = {
  res: Response;
  req?: Request;
  statusCode?: number;
  message: string;
  data?: T;
};

type ErrorResponseParams = {
  res: Response;
  req?: Request;
  statusCode: number;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
};

const buildMeta = (req?: Request): ResponseMeta => ({
  timestamp: new Date().toISOString(),
  ...(req?.requestId ? { requestId: req.requestId } : {}),
});

export const sendSuccess = <T>({
  res,
  req,
  statusCode = 200,
  message,
  data = null as T,
}: SuccessResponseParams<T>): Response<ApiResponse<T>> => {
  const payload: ApiResponse<T> = {
    success: true,
    message,
    data,
    error: null,
    meta: buildMeta(req),
  };

  return res.status(statusCode).json(payload);
};

export const sendError = ({
  res,
  req,
  statusCode,
  message,
  error,
}: ErrorResponseParams): Response<ApiResponse<null>> => {
  const payload: ApiResponse<null> = {
    success: false,
    message,
    data: null,
    error,
    meta: buildMeta(req),
  };

  return res.status(statusCode).json(payload);
};
