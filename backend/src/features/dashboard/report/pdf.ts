import puppeteer from "puppeteer";
import type { CloudCostAnomalyReportResponse } from "./report.types.js";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTrendPoints(report: CloudCostAnomalyReportResponse): {
  polyline: string;
  maxPoint: { x: number; y: number; date: string } | null;
} {
  const width = 700;
  const height = 220;
  const padding = 24;
  const values = report.trendData.map((item) => item.cost);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = Math.max(max - min, 1);

  const points = report.trendData.map((item, index) => {
    const x =
      report.trendData.length <= 1
        ? width / 2
        : padding + (index / (report.trendData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((item.cost - min) / span) * (height - padding * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const maxIndex = report.trendData.reduce((bestIndex, current, index, list) => {
    if (bestIndex < 0 || current.cost > list[bestIndex].cost) {
      return index;
    }
    return bestIndex;
  }, -1);

  const finalMaxPoint =
    maxIndex >= 0
      ? (() => {
          const item = report.trendData[maxIndex];
          const x =
            report.trendData.length <= 1
              ? width / 2
              : padding + (maxIndex / (report.trendData.length - 1)) * (width - padding * 2);
          const y = height - padding - ((item.cost - min) / span) * (height - padding * 2);
          return { x, y, date: item.date };
        })()
      : null;

  return {
    polyline: points.join(" "),
    maxPoint: finalMaxPoint,
  };
}

function buildPieStops(report: CloudCostAnomalyReportResponse): string {
  const palette = ["#1d4ed8", "#0ea5e9", "#14b8a6", "#94a3b8"];
  let running = 0;
  const stops: string[] = [];
  report.breakdownData.forEach((item, index) => {
    const start = running;
    running += item.percentage;
    stops.push(`${palette[index % palette.length]} ${start.toFixed(2)}% ${running.toFixed(2)}%`);
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function buildHtml(report: CloudCostAnomalyReportResponse): string {
  const trend = buildTrendPoints(report);
  const pieBackground = buildPieStops(report);
  const generatedAt = new Date(report.generatedAt).toLocaleString("en-US", { timeZone: "UTC" });
  const trendLabelDate = trend.maxPoint
    ? new Date(`${trend.maxPoint.date}T00:00:00.000Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.title)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Inter", Arial, sans-serif;
        color: #0f172a;
        background: #f8fafc;
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 16mm 14mm;
        background: #ffffff;
      }
      .header-title {
        text-align: center;
        font-size: 26px;
        margin: 8px 0 12px;
      }
      .meta-row {
        display: flex;
        justify-content: space-between;
        color: #475569;
        font-size: 12px;
        border-top: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
        padding: 10px 0;
      }
      .summary-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin-top: 16px;
      }
      .card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px;
        background: #f8fafc;
      }
      .card .label { color: #64748b; font-size: 12px; }
      .card .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
      .card .hint { color: #64748b; font-size: 11px; margin-top: 6px; }
      .section {
        margin-top: 16px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px;
      }
      .section h2 {
        margin: 0 0 10px;
        font-size: 14px;
        letter-spacing: 0.02em;
      }
      .split {
        display: grid;
        gap: 12px;
        grid-template-columns: 1fr 1fr;
      }
      .pie {
        width: 180px;
        height: 180px;
        border-radius: 999px;
        margin: 10px auto;
        background: ${pieBackground};
      }
      .legend { margin-top: 8px; font-size: 12px; }
      .legend-item {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed #e2e8f0;
        padding: 4px 0;
      }
      .contributors ol {
        margin: 0;
        padding-left: 18px;
      }
      .contributors li {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed #e2e8f0;
        padding: 8px 0;
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th, td {
        text-align: left;
        padding: 8px 6px;
        border-bottom: 1px solid #e2e8f0;
      }
      th {
        color: #475569;
        background: #f8fafc;
      }
      ul { margin: 0; padding-left: 20px; font-size: 12px; color: #334155; }
      li { margin-bottom: 5px; }
      .footer {
        margin-top: 18px;
        text-align: center;
        color: #94a3b8;
        font-size: 11px;
      }
      .positive { color: #15803d; }
      .negative { color: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="page">
      <h1 class="header-title">${escapeHtml(report.title)}</h1>
      <div class="meta-row">
        <div>Period: ${escapeHtml(report.period)}</div>
        <div>Generated: ${escapeHtml(generatedAt)} (UTC)</div>
      </div>

      <div class="summary-grid">
        <div class="card">
          <div class="label">Total Cost</div>
          <div class="value">${escapeHtml(currency.format(report.summary.totalCost))}</div>
        </div>
        <div class="card">
          <div class="label">Cost Change</div>
          <div class="value ${report.summary.costChangePercentage >= 0 ? "positive" : "negative"}">
            ${escapeHtml(`${report.summary.costChangePercentage >= 0 ? "+" : ""}${report.summary.costChangePercentage.toFixed(1)}%`)}
          </div>
          <div class="hint">vs Last Period</div>
        </div>
        <div class="card">
          <div class="label">Anomalies Detected</div>
          <div class="value">${escapeHtml(String(report.summary.anomalyCount))}</div>
        </div>
        <div class="card">
          <div class="label">Top Service</div>
          <div class="value">${escapeHtml(report.summary.topService)}</div>
          <div class="hint">${escapeHtml(`${report.summary.topServicePercentage.toFixed(1)}% of Cost`)}</div>
        </div>
      </div>

      <section class="section">
        <h2>Cost Trend</h2>
        <svg width="100%" viewBox="0 0 700 220" preserveAspectRatio="none">
          <rect x="0" y="0" width="700" height="220" fill="#ffffff" />
          <line x1="24" y1="196" x2="676" y2="196" stroke="#e2e8f0" />
          <line x1="24" y1="24" x2="24" y2="196" stroke="#e2e8f0" />
          <polyline points="${trend.polyline}" fill="none" stroke="#2563eb" stroke-width="2.5" />
          ${
            trend.maxPoint && trendLabelDate
              ? `<circle cx="${trend.maxPoint.x.toFixed(2)}" cy="${trend.maxPoint.y.toFixed(2)}" r="4.5" fill="#dc2626" />
                 <text x="${(trend.maxPoint.x + 10).toFixed(2)}" y="${Math.max(trend.maxPoint.y - 12, 20).toFixed(2)}"
                    font-size="11" fill="#dc2626">Spike on ${escapeHtml(trendLabelDate)}</text>`
              : ""
          }
        </svg>
      </section>

      <section class="section split">
        <div>
          <h2>Cost Breakdown</h2>
          <div class="pie"></div>
          <div class="legend">
            ${report.breakdownData
              .map(
                (item) =>
                  `<div class="legend-item"><span>${escapeHtml(item.service)}</span><strong>${escapeHtml(
                    `${item.percentage.toFixed(1)}%`,
                  )}</strong></div>`,
              )
              .join("")}
          </div>
        </div>
        <div class="contributors">
          <h2>Top Contributors</h2>
          <ol>
            ${report.topContributors
              .map(
                (item) =>
                  `<li><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(currency.format(item.amount))}</strong></li>`,
              )
              .join("")}
          </ol>
        </div>
      </section>

      <section class="section">
        <h2>Anomalies</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Service</th>
              <th>Actual Cost</th>
              <th>Expected Cost</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            ${report.anomalies
              .map(
                (row) => `<tr>
                  <td>${escapeHtml(row.date)}</td>
                  <td>${escapeHtml(row.service)}</td>
                  <td>${escapeHtml(currency.format(row.actualCost))}</td>
                  <td>${escapeHtml(currency.format(row.expectedCost))}</td>
                  <td class="${row.impact >= 0 ? "negative" : "positive"}">${escapeHtml(currency.format(row.impact))}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Insights</h2>
        <ul>
          ${report.insights.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      </section>

      <div class="footer">Generated by XYZ Cloud Analytics</div>
    </div>
  </body>
</html>`;
}

export function buildCloudCostReportFileName(startDate: string, endDate: string): string {
  return `cloud-cost-anomaly-report-${startDate}_to_${endDate}.pdf`;
}

export async function generateCloudCostReportPdf(report: CloudCostAnomalyReportResponse): Promise<Buffer> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    await page.setContent(buildHtml(report), { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");

    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        bottom: "10mm",
        left: "8mm",
        right: "8mm",
      },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
