import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../../constants/http-status.js";
import { UnauthorizedError } from "../../../../errors/http-errors.js";
import { sendError, sendSuccess } from "../../../../utils/api-response.js";
import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import {
  ec2InstanceActionBodySchema,
  listEc2InstancesQuerySchema,
} from "./ec2.schema.js";
import {
  AwsEc2Error,
  listInstances,
  rebootInstance,
  startInstance,
  stopInstance,
} from "./ec2.service.js";

const requireTenantId = (req: Request): string => {
  const tenantId = req.auth?.user.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    throw new UnauthorizedError("Tenant context required");
  }
  return tenantId;
};

const sendEc2ServiceError = (req: Request, res: Response, error: AwsEc2Error): void => {
  sendError({
    res,
    req,
    statusCode: error.statusCode,
    message: error.message,
    error: {
      code: error.errorCode,
      ...(error.details ? { details: error.details } : {}),
    },
  });
};

export async function handleListEc2Instances(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const query = parseWithSchema(listEc2InstancesQuerySchema, req.query);

  try {
    const instances = await listInstances({
      tenantId,
      connectionId: query.connectionId,
    });

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "EC2 instances loaded",
      data: instances,
    });
  } catch (error) {
    if (error instanceof AwsEc2Error) {
      sendEc2ServiceError(req, res, error);
      return;
    }
    throw error;
  }
}

export async function handleStartEc2Instance(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const body = parseWithSchema(ec2InstanceActionBodySchema, req.body);

  try {
    const result = await startInstance({
      tenantId,
      connectionId: body.connectionId,
      instanceId: body.instanceId,
    });

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "EC2 start request accepted",
      data: result,
    });
  } catch (error) {
    if (error instanceof AwsEc2Error) {
      sendEc2ServiceError(req, res, error);
      return;
    }
    throw error;
  }
}

export async function handleStopEc2Instance(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const body = parseWithSchema(ec2InstanceActionBodySchema, req.body);

  try {
    const result = await stopInstance({
      tenantId,
      connectionId: body.connectionId,
      instanceId: body.instanceId,
    });

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "EC2 stop request accepted",
      data: result,
    });
  } catch (error) {
    if (error instanceof AwsEc2Error) {
      sendEc2ServiceError(req, res, error);
      return;
    }
    throw error;
  }
}

export async function handleRebootEc2Instance(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenantId(req);
  const body = parseWithSchema(ec2InstanceActionBodySchema, req.body);

  try {
    const result = await rebootInstance({
      tenantId,
      connectionId: body.connectionId,
      instanceId: body.instanceId,
    });

    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: "EC2 reboot request accepted",
      data: result,
    });
  } catch (error) {
    if (error instanceof AwsEc2Error) {
      sendEc2ServiceError(req, res, error);
      return;
    }
    throw error;
  }
}
