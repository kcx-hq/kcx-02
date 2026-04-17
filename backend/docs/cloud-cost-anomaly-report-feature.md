# Cloud Cost & Anomaly Report Feature

## What Was Implemented

### Backend
- `GET /api/reports/cloud-cost-anomaly`
- `GET /api/reports/cloud-cost-anomaly/pdf`
- `POST /api/reports/cloud-cost-anomaly/generate`
- Compatibility aliases (same handlers):
  - `GET /reports/cloud-cost-anomaly`
  - `GET /reports/cloud-cost-anomaly/pdf`
  - `POST /reports/cloud-cost-anomaly/generate`
- Existing `GET /dashboard/report` now returns a real summary from the new report service.

### Frontend
- Dashboard route: `/dashboard/report`
- Standalone route: `/reports/cloud-cost-anomaly`
- Date range and billing source filters
- Polished finance-style preview layout
- Recharts line + pie visualizations
- PDF download button calling backend endpoint
- Loading, error, and empty-state handling

## New Backend Files
- `src/features/dashboard/report/report.types.ts`
- `src/features/dashboard/report/dateRange.ts`
- `src/features/dashboard/report/reportInsights.ts`
- `src/features/dashboard/report/report.repository.ts` (mock data layer, DB-replaceable)
- `src/features/dashboard/report/report.service.ts`
- `src/features/dashboard/report/pdf.ts`
- `src/features/dashboard/report/report.controller.ts`
- `src/features/dashboard/report/report.routes.ts`

## New Frontend Files
- `src/features/dashboard/pages/report/report.types.ts`
- `src/features/dashboard/pages/report/report.api.ts`
- `src/features/dashboard/pages/report/CloudCostAnomalyReportContent.tsx`
- `src/features/dashboard/pages/report/CloudCostAnomalyReportStandalonePage.tsx`

## Packages Required

Install in each app after pulling changes:

- Backend:
  - `puppeteer`
- Frontend:
  - `recharts`

## Local Run Instructions

1. Install dependencies
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
2. Configure env files
   - Backend `.env` must include valid `DB_URL`
   - Backend should include `FRONTEND_BASE_URL=http://localhost:5173` for local docs/report links
   - Optional for custom Chromium: `PUPPETEER_EXECUTABLE_PATH=...`
   - Frontend `.env` should include:
     - `VITE_API_BASE_URL=http://localhost:5000`
     - `VITE_FRONTEND_URL=http://localhost:5173`
3. Start servers
   - `cd backend && npm run dev`
   - `cd frontend && npm run dev`
4. Open:
   - `http://localhost:5173/reports/cloud-cost-anomaly`

## Example JSON Response Payload

```json
{
  "title": "Cloud Cost & Anomaly Report",
  "period": "Mar 01, 2026 - Mar 31, 2026",
  "generatedAt": "2026-04-14T07:16:27.284Z",
  "summary": {
    "totalCost": 12430.16,
    "costChangePercentage": 18.37,
    "anomalyCount": 3,
    "topService": "EC2",
    "topServicePercentage": 45.12
  },
  "trendData": [{ "date": "2026-03-01", "cost": 402.13 }],
  "breakdownData": [{ "service": "EC2", "cost": 5600.12, "percentage": 45.12 }],
  "topContributors": [{ "rank": 1, "name": "Prod Compute Cluster", "amount": 5140.11 }],
  "anomalies": [
    {
      "date": "2026-03-12",
      "service": "EC2",
      "actualCost": 1560,
      "expectedCost": 690,
      "impact": 870
    }
  ],
  "insights": [
    "Total cloud spend increased by 18.4% period-over-period to $12,430.",
    "3 anomalies were detected, with the largest impact on 2026-03-12 (EC2, +$870).",
    "EC2 remained the dominant cost driver (45.1%), while RDS was the next-largest service category."
  ],
  "billingSources": [{ "id": 1, "name": "AWS Production" }]
}
```

## Where To Plug Real PostgreSQL Queries

Replace only repository methods in:
- `src/features/dashboard/report/report.repository.ts`

Methods to swap with SQL/Sequelize-backed implementations:
- `getBillingSources()`
- `getDailyServiceCosts(query)`
- `getAnomalies(query)`

Keep `report.service.ts` unchanged so business logic remains stable while data source changes.

