import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../../constants/http-status.js";
import { sendSuccess } from "../../../utils/api-response.js";
import { formatIsoDate, parseCloudCostReportQuery } from "./dateRange.js";
import { buildCloudCostReportFileName, generateCloudCostReportPdf } from "./pdf.js";
import { CloudCostAnomalyReportService } from "./report.service.js";

const reportService = new CloudCostAnomalyReportService();

function resolveDefaultRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return {
    startDate: formatIsoDate(previousMonthStart),
    endDate: formatIsoDate(previousMonthEnd),
  };
}

function getQueryWithDefaults(req: Request): {
  startDate: string;
  endDate: string;
  billingSourceId?: number;
} {
  const defaults = resolveDefaultRange();
  return parseCloudCostReportQuery({
    startDate: req.query.startDate ?? defaults.startDate,
    endDate: req.query.endDate ?? defaults.endDate,
    billingSourceId: req.query.billingSourceId,
  });
}

export async function handleGetCloudCostAnomalyReport(req: Request, res: Response): Promise<void> {
  const query = getQueryWithDefaults(req);
  const report = await reportService.getReport(query);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud cost & anomaly report fetched successfully",
    data: report,
  });
}

export async function handleGetCloudCostAnomalyReportPdf(req: Request, res: Response): Promise<void> {
  const query = getQueryWithDefaults(req);
  const report = await reportService.getReport(query);
  const pdfBuffer = await generateCloudCostReportPdf(report);
  const fileName = buildCloudCostReportFileName(query.startDate, query.endDate);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", String(pdfBuffer.length));
  res.status(HTTP_STATUS.OK).send(pdfBuffer);
}

export async function handleGenerateCloudCostAnomalyReport(req: Request, res: Response): Promise<void> {
  const query = getQueryWithDefaults(req);
  const report = await reportService.getReport(query);
  const pdfBuffer = await generateCloudCostReportPdf(report);
  const fileName = buildCloudCostReportFileName(query.startDate, query.endDate);

  const outputDir = join(tmpdir(), "kcx-generated-reports");
  await mkdir(outputDir, { recursive: true });
  const tempFilePath = join(outputDir, fileName);
  await writeFile(tempFilePath, pdfBuffer);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Cloud cost & anomaly report generated successfully",
    data: {
      filename: fileName,
      generatedAt: report.generatedAt,
      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      tempFilePath,
    },
  });
}

export async function handleGetReportDashboard(req: Request, res: Response): Promise<void> {
  const dashboardSummary = await reportService.getLegacyDashboardSummary();
  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Report dashboard data fetched successfully",
    data: dashboardSummary,
  });
}

