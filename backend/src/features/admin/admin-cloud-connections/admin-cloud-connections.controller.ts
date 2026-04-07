import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import {
  parseAdminCloudConnectionIntegrationId,
  parseAdminCloudConnectionsListQuery,
} from "./admin-cloud-connections.schema.js";
import {
  getCloudConnectionDetail,
  listCloudConnections,
} from "./admin-cloud-connections.service.js";
import type { AdminCloudConnectionsListQuery } from "./admin-cloud-connections.types.js";

export async function handleAdminGetCloudConnections(req: Request, res: Response): Promise<void> {
  const parsedQuery = parseAdminCloudConnectionsListQuery(req.query as AdminCloudConnectionsListQuery);
  const data = await listCloudConnections(parsedQuery);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud connections fetched",
    data,
  });
}

export async function handleAdminGetCloudConnectionByIntegrationId(
  req: Request,
  res: Response,
): Promise<void> {
  const integrationId = parseAdminCloudConnectionIntegrationId(req.params.integrationId);
  const data = await getCloudConnectionDetail(integrationId);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud connection details fetched",
    data,
  });
}

