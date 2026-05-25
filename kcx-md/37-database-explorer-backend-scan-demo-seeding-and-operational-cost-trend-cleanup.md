# 37 - Database Explorer Backend Scan, Demo Seeding, and Operational Cost Trend Cleanup

## Context
This chat focused entirely on the **KCX Database Explorer** backend and its demo-data readiness.

Primary goals:
- Perform a read-only end-to-end backend scan of the Database Explorer contract.
- Identify the exact backend fields, tables, and values that drive the Explorer UI.
- Determine minimum realistic dummy/dev data requirements to avoid empty cards, charts, tables, and filters.
- Extend the existing backend demo-data seeding architecture properly for Database Explorer.
- Seed realistic enterprise-style Explorer data across the correct backend tables.
- Remove negative accounting-adjustment categories from the Database Explorer cost-category trend graph.

---

## Phase 1: Read-Only Backend Contract Scan

### What was requested
- Scan only the **Database Explorer** backend flow.
- Do not modify code, insert data, change frontend, or refactor anything.
- Identify:
  - route path
  - controller
  - service method
  - accepted query params
  - response shape
  - UI section dependencies
  - table/column dependencies
  - groupBy behavior
  - filter behavior
  - minimum dummy data needs
  - likely current data gaps

### What was inspected
- Backend route/controller/service/repository chain under:
  - `backend/src/features/database/explorer/...`
- Route mount:
  - `GET /services/database/explorer`
- Frontend consumer path:
  - `frontend/src/features/dashboard/pages/database/...`
  - `frontend/src/features/dashboard/api/dashboardApi.ts`
  - `frontend/src/features/dashboard/api/dashboardTypes.ts`

### Main backend contract findings
- The Explorer backend returns:
  - `filters`
  - `filterOptions`
  - `cards`
  - `trend`
  - `trendGrouped`
  - `table`
- Backend-supported groupBy dimensions:
  - `db_service`
  - `db_engine`
  - `region`
  - `resource_type`
  - `instance_class`
  - `cluster`
  - `cost_category`
- Backend-driven scope filtering uses `database_scope`, mapped internally to supported `db_service` families.

### Core dependency findings
- `fact_db_resource_daily` is the Explorer backbone.
- `db_cost_history_daily` is required for `groupBy=cost_category`.
- `db_resource_inventory_snapshots` is required for:
  - `instance_class`
  - inventory-backed cluster realism
- `dim_region` must resolve valid region keys for clean region grouping.
- `db_utilization_daily` exists, but the current Explorer reads usage metrics from `fact_db_resource_daily`, not directly from `db_utilization_daily`.

---

## Phase 2: Current Data Gap Analysis

### Read-only DB verification
Live read-only aggregate checks were run against the configured backend database.

### Key findings before seeding
- `fact_db_resource_daily` had only sparse data.
- `db_cost_history_daily` had some rows, but not enough for a realistic enterprise Explorer.
- `db_resource_inventory_snapshots` was empty.
- `db_utilization_daily` was empty.
- `load_avg` and `connections_avg` were effectively unusable for Explorer behavior.

### UX risks identified
- `avgLoad` KPI could be null.
- Usage charts could be empty or misleading.
- `instance_class` grouping would collapse into unknown/empty behavior.
- `cluster` grouping would not feel realistic.
- Database scope hierarchy would not fully light up.
- `cost_category` grouping needed fuller category coverage.
- Current dev seed path was too narrow because it only seeded the fact table.

---

## Phase 3: Proper Backend Demo Seeder Extension

### Constraints followed
- No frontend changes for this task.
- No Explorer logic redesign.
- No ad-hoc SQL paste script.
- No bypassing the backend’s existing seeding flow.
- The existing backend demo seed architecture was extended directly.

### Existing seed path reused
- `backend/scripts/seed/dev/seed-database-explorer-dev.ts`
- Existing entrypoint kept:
  - `npm run seed:database-explorer:dev`

### Seeder architecture upgrade
The previous Database Explorer dev seed only populated:
- `fact_db_resource_daily`

The upgraded version now seeds coordinated, internally consistent Explorer data across:
- `fact_db_resource_daily`
- `db_cost_history_daily`
- `db_resource_inventory_snapshots`
- `dim_region` only when needed to ensure valid region resolution

### Enterprise environment modeled
The seeded data was shaped to resemble a realistic enterprise database estate with:
- production and staging workloads
- relational systems
- key-value systems
- in-memory systems
- document systems
- graph systems
- wide-column systems
- time-series systems
- multi-region deployment
- clustered and standalone resources
- believable cost distributions
- non-null operational metrics

---

## Phase 4: Seeded Database Service and Engine Coverage

### Services represented
- `AmazonRDS`
- `Aurora`
- `DynamoDB`
- `ElastiCache`
- `MemoryDB`
- `DocumentDB`
- `Neptune`
- `Keyspaces`
- `Timestream`

### Engines represented
- `PostgreSQL`
- `MySQL`
- `Aurora PostgreSQL`
- `Aurora MySQL`
- `DynamoDB`
- `Redis OSS`
- `Valkey`
- `MongoDB-compatible`
- `Neptune Graph`
- `Apache Cassandra-compatible`
- `Timestream LiveAnalytics`

### Resource-type realism included
- `cluster`
- `instance`
- `node`
- `table`
- `cache`
- `graph`
- `stream`

### Region coverage included
- `us-east-1`
- `us-west-2`
- `eu-west-1`
- `ap-south-1`

### Cluster realism included
- Aurora writer/reader clusters
- ElastiCache primary/replica grouping
- MemoryDB clustered nodes
- standalone RDS instances
- standalone service types where appropriate

---

## Phase 5: Cost and Usage Modeling

### Seed design principles used
- Avoid flat or toy cost patterns.
- Include workload-specific behavior:
  - transactional
  - analytics
  - cache-heavy
  - graph
  - wide-column
  - time-series
- Include:
  - region multipliers
  - weekend behavior
  - spike days
  - month-end/month-start behavior
  - service-appropriate cost category mix

### Cost categories seeded
- `compute`
- `storage`
- `io`
- `backup`
- `data_transfer`
- `tax`
- `credit`
- `refund`

### Operational metrics seeded in fact rows
- `load_avg`
- `connections_avg`
- `data_footprint_gb`
- additional realistic throughput / IO support values

### Time span seeded
- `2026-03-01` through `2026-05-10`
- This included both current-window and previous-period coverage so KPI trend calculations and grouped trends had enough historical depth.

---

## Phase 6: Seeder Validation Outcomes

### Build + seed verification
- Backend build passed.
- Existing seed command succeeded.

### Final seeded counts
- `fact_db_resource_daily`: `1207` rows
- `db_cost_history_daily`: `6207` rows
- `db_resource_inventory_snapshots`: `17` rows
- resource count: `17`
- seeded date window: `71` days

### Verified Explorer-facing coverage after seed
- `9` distinct `db_service`
- `11` distinct `db_engine`
- `7` distinct `resource_type`
- non-empty cluster grouping
- non-empty instance class grouping
- non-empty region grouping
- non-empty cost-category grouping
- `0` null `load_avg`
- `0` null `connections_avg`

### Resulting Explorer areas now populated
- database scope hierarchy
- KPI cards
- cost charts
- usage charts
- grouped charts
- grouped table rows
- region grouping
- engine grouping
- cost-category grouping
- cluster grouping
- inventory-backed grouping

---

## Phase 7: Cost-Category Trend Graph Cleanup

### Product direction
The user clarified that the main Database Explorer cost-category trend graph should behave like an **operational DB cost explorer**, not a full billing ledger.

Desired graph focus:
- `compute`
- `storage`
- `io`
- `backup`
- `data_transfer`

Desired exclusions from the main trend visualization:
- `credit`
- `refund`
- `tax`

### Backend change applied
The grouped trend query path for:
- `groupBy=cost_category`

was updated so the returned trend visualization series now include only:
- `compute`
- `storage`
- `io`
- `backup`
- `data_transfer`

### Effect
- Negative accounting-adjustment bars were removed from the graph.
- The main cost-category trend now starts from operational cost categories only.
- Credits, refunds, and tax remain seeded in backend data for broader realism, but they are excluded from the main grouped trend chart payload.

---

## Files Updated in This Chat

### Backend scan / verification work
- `backend/src/features/database/explorer/explorer.repository.ts`
- read-only scans across:
  - `explorer.routes/controller/service/validators/types`
  - dashboard API/query types
  - frontend Database Explorer components

### Seeder implementation
- `backend/scripts/seed/dev/seed-database-explorer-dev.ts`

### Archive update
- `kcx-md/00-index.md`
- `kcx-md/37-database-explorer-backend-scan-demo-seeding-and-operational-cost-trend-cleanup.md`

---

## Final Outcome
This chat produced three major outcomes:

1. A complete backend contract scan for Database Explorer, including route, response shape, UI dependency mapping, table usage, and data-gap analysis.
2. A proper extension of the existing KCX backend demo-data seeding mechanism so Database Explorer now has realistic enterprise-scale backend demo data across all key tables.
3. A cleanup of the `cost_category` grouped trend so the graph now emphasizes positive operational database costs instead of accounting-adjustment noise.
