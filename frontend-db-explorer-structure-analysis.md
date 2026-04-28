# KCX Services -> Database -> Explorer v1.1 Frontend Structure Analysis

This report summarizes the existing frontend architecture patterns relevant to implementing the Database Explorer v1.1 frontend. It is analysis only: no UI, route, backend, or schema changes were made.

## 1. Current Frontend Folder Structure Summary

Relevant frontend areas:

- `frontend/src/App.tsx`
  - Top-level app route gate. Dashboard routes only render when `DASHBOARD_ROUTE_REGEX` matches the current path.
  - Also handles auth checks and redirects unauthenticated dashboard/client users.

- `frontend/src/main.tsx`
  - App bootstrap.
  - Registers AG Grid modules.
  - Wraps the app in `QueryClientProvider` and `BrowserRouter`.

- `frontend/src/lib/api.ts`
  - Shared authenticated HTTP client helpers: `apiGet`, `apiPost`, `apiPatch`, `apiPostForm`.
  - Adds `Authorization: Bearer <token>` from `frontend/src/lib/auth.ts`.
  - Expects backend responses in the shared `{ success, data, message, error, meta }` envelope.

- `frontend/src/lib/auth.ts`
  - Local storage auth session utilities.
  - Provides the token used by `api.ts`.

- `frontend/src/features/dashboard/routes/DashboardRoutes.tsx`
  - Main React Router route registry for `/dashboard/*`.
  - Imports dashboard pages and dashboard CSS/token files.

- `frontend/src/features/dashboard/layout/DashboardLayout.tsx`
  - Dashboard shell composition.
  - Renders `DashboardSidebar`, `DashboardGlobalHeader`, `DashboardScopeProvider`, `DashboardPageContainer`, and nested route content via `Outlet`.

- `frontend/src/features/dashboard/components/`
  - Dashboard shell components such as `DashboardSidebar`, `DashboardGlobalHeader`, `DashboardPageContainer`, `DashboardPageHeader`, and icon rendering.

- `frontend/src/features/dashboard/common/`
  - Reusable dashboard building blocks:
    - `charts/`: ECharts wrappers and chart primitives.
    - `components/`: KPI cards, widget shells, page sections, empty states.
    - `filters/`: older template-style filter panel controls.
    - `tables/`: AG Grid table wrapper and table shells.
    - `navigation.ts`: dashboard nav model.

- `frontend/src/features/dashboard/api/`
  - `dashboardApi.ts`: typed dashboard API client methods.
  - `dashboardTypes.ts`: dashboard API response and filter types.

- `frontend/src/features/dashboard/hooks/`
  - `useDashboardQueries.ts`: React Query hooks for dashboard pages.
  - `useDashboardScope.ts`: access to resolved dashboard scope.

- `frontend/src/features/dashboard/context/DashboardScopeContext.tsx`
  - Parses URL search params into dashboard scope input.
  - Resolves tenant/date/provider/billing scope through `/dashboard/scope`.

- `frontend/src/features/dashboard/pages/`
  - Existing dashboard pages.
  - Most relevant references are `cost-explorer`, `ec2`, and `s3`.

- `frontend/src/features/dashboard/styles/tokens.css`
  - Dashboard scoped CSS variables for spacing, color, radius, surfaces, and sidebar.

- `frontend/src/features/dashboard/styles/dashboard.css`
  - Main dashboard CSS, including shell, sidebar, KPI cards, widgets, tables, Cost Explorer controls, S3 overview controls, and EC2 overview styles.

## 2. Routing Analysis

Dashboard routing has two layers:

- `frontend/src/App.tsx`
  - `DASHBOARD_ROUTE_REGEX` decides whether `<DashboardRoutes />` is rendered at all.
  - Any future Database route must be added to this regex, or React Router will never receive it.

- `frontend/src/features/dashboard/routes/DashboardRoutes.tsx`
  - Defines nested routes under `<Route path="/dashboard" element={<DashboardLayout />}>`.
  - Existing Services-style routes include:
    - `/dashboard/ec2`
    - `/dashboard/ec2/cost`
    - `/dashboard/ec2/usage`
    - `/dashboard/ec2/instance-hours`
    - `/dashboard/ec2/performance`
    - `/dashboard/ec2/volumes`
    - `/dashboard/s3`
    - `/dashboard/s3/cost`
    - `/dashboard/s3/usage`
    - `/dashboard/inventory/aws/ec2/instances`
    - `/dashboard/inventory/aws/ec2/volumes`
    - `/dashboard/inventory/aws/ec2/snapshots`

Recommended route for Database Explorer v1.1:

- `/dashboard/services/database`

Reasoning:

- The product model says Database lives under Services.
- Clicking Database should open Explorer directly.
- Explorer should not appear as a visible submenu.
- A route named `/dashboard/services/database` keeps the URL aligned to Services without exposing `/explorer` in the visible nav.

Later implementation should add:

- A route regex allowance in `App.tsx` for `/dashboard/services/database`.
- A route in `DashboardRoutes.tsx`, likely:
  - `<Route path="services/database" element={<DatabaseExplorerPage />} />`

## 3. Navigation / Sidebar Analysis

Services navigation lives in:

- `frontend/src/features/dashboard/common/navigation.ts`

It is rendered by:

- `frontend/src/features/dashboard/components/DashboardSidebar.tsx`

Current model:

- `Services` is a top-level `kind: "link"` with `path: "/dashboard/inventory"` and `children`.
- Services children are `DashboardNavGroup[]`.
- Existing child groups:
  - `EC2`, with submenu items for instances, volumes, snapshots, cost, usage, instance hours, and performance.
  - `S3`, with submenu items for cost and usage.

Important sidebar behavior:

- Nested groups render as expandable group buttons.
- `S3` has a hardcoded direct navigation exception:
  - If `group.path && group.label === "S3"`, clicking the S3 group navigates to `group.path`.
- Other nested groups toggle open/closed instead of navigating.

How Database should be added later:

- Add a `Database` entry under Services.
- The visible nav label should be `Database`.
- The click target should be `/dashboard/services/database`.
- Do not add `Explorer` as a visible submenu item.

Navigation caveat for implementation:

- The current nav type expects Services children to be groups with `items`.
- A direct-click Database group with no visible submenu is not cleanly supported yet.
- Later implementation should make nested group path-click behavior generic enough for Database, or add a small explicit Database case. Keep the visible result as a single Database entry.

Breadcrumb caveat:

- `DashboardGlobalHeader.tsx` has explicit breadcrumb branches for EC2 and S3.
- Later implementation should add a branch for `/dashboard/services/database` returning:
  - `Dashboard > Services > Database`

## 4. Existing Reference Patterns

Closest page patterns:

- `frontend/src/features/dashboard/pages/cost-explorer/CostExplorerPage.tsx`
  - Best reference for a filterable explorer page.
  - Uses local UI state, React Query hooks, typed API responses, ECharts options, loading/error/empty states, filter popovers, chart mode controls, and breakdown presentation.

- `frontend/src/features/dashboard/pages/ec2/EC2OverviewPage.tsx`
  - Best reference for a service overview using KPI cards and service-specific charts.
  - Reads URL query params, calls a service-specific query hook, renders `KpiCard`, `WidgetShell`, and `BaseEChart`.
  - Contains clickable KPI behavior, but Database v1.1 should not adopt drilldown navigation yet.

- `frontend/src/features/dashboard/pages/s3/S3OverviewPage.tsx`
  - Useful reference for service-level filter controls and a service overview chart using Cost Explorer CSS classes.
  - Uses local filter state and `useS3CostInsightsQuery`.

Reusable component patterns:

- KPI/cards:
  - `common/components/KpiCard.tsx`
  - `common/components/KpiGrid.tsx`
  - Existing pages also use dashboard CSS classes such as `overview-kpi-strip` and `overview-kpi-row`.

- Chart:
  - `common/charts/BaseEChart.tsx`
  - Uses `echarts` directly and accepts `EChartsOption`.
  - `common/charts/StackedBarChart.tsx`, `LineTrendChart.tsx`, and `ChartPlaceholder.tsx` exist, but current richer pages often build `EChartsOption` directly and pass it to `BaseEChart`.

- Table:
  - `common/tables/BaseDataTable.tsx`
  - Wraps `AgGridReact` with the shared `themeQuartz`.
  - Returns `TableEmptyState` when there are no rows.
  - `common/tables/TableShell.tsx` provides a standard table container.

- Loading/error/empty:
  - Simple dashboard pages use `dashboard-note`.
  - Cost Explorer uses skeleton classes and `EmptyStateBlock`.
  - Tables use `TableEmptyState`.

- Styling:
  - Dashboard uses scoped CSS classes and CSS variables rather than page-local CSS modules.
  - Existing Cost Explorer/S3 controls already define filter popover, segmented, chip, chart, and skeleton classes in `dashboard.css`.

## 5. API Integration Pattern

Shared API client:

- `frontend/src/lib/api.ts`
  - `apiGet<T>(path)` is the standard GET helper.
  - It prefixes `appEnv.apiBaseUrl`.
  - It attaches auth headers automatically.
  - It unwraps the backend envelope and returns `data`.

Dashboard API methods:

- `frontend/src/features/dashboard/api/dashboardApi.ts`
  - Central dashboard API object.
  - Builds query strings with `URLSearchParams`.
  - Uses helper functions such as `withDashboardQuery`, `withCostExplorerFilters`, `withEc2OverviewFilters`, and `withS3CostInsightsFilters`.

Scope/query params:

- `frontend/src/features/dashboard/utils/buildDashboardQueryParams.ts`
  - Converts dashboard scope into URL query params.
  - Existing dashboard scope params include `tenantId`, `from`, `to`, `providerId`, `billingSourceId(s)`, `subAccountKey`, `serviceKey`, and `regionKey`.

React Query hooks:

- `frontend/src/features/dashboard/hooks/useDashboardQueries.ts`
  - Uses `useQuery`.
  - Query keys are structured arrays, usually `["dashboard", feature, scope, filters]`.
  - Hooks are enabled only when dashboard scope is resolved.

Recommended API addition for Database Explorer v1.1:

- Add response/filter types to `dashboardTypes.ts`, for example:
  - `DatabaseExplorerMetric = "cost" | "usage"`
  - `DatabaseExplorerGroupBy = "db_service" | "db_engine" | "region"`
  - `DatabaseExplorerFiltersQuery`
  - `DatabaseExplorerResponse`

- Add a query builder in `dashboardApi.ts`, for example:
  - `withDatabaseExplorerFilters("/services/database/explorer", scope, filters)`

- Add an API method:
  - `dashboardApi.getDatabaseExplorer(scope, filters)`

- Add a hook:
  - `useDatabaseExplorerQuery(filters)`
  - Query key: `["dashboard", "services", "database", "explorer", scope, filters]`

Endpoint target:

- Backend endpoint is `GET /services/database/explorer`.
- Query params should map frontend camelCase state to backend snake_case params:
  - `start_date`
  - `end_date`
  - `region_key`
  - `db_service`
  - `db_engine`
  - `metric`
  - `group_by`

Date range recommendation:

- Prefer deriving `start_date` and `end_date` from dashboard scope `from` and `to` unless the Database Explorer page introduces page-specific date params.
- Preserve existing dashboard `from` and `to` query params when navigating.

## 6. State Management Pattern

Current app state patterns:

- Server state:
  - React Query via `@tanstack/react-query`.
  - `QueryClientProvider` is configured in `frontend/src/main.tsx`.

- Dashboard scope:
  - `DashboardScopeContext` parses URL search params and resolves scope through `/dashboard/scope`.
  - Pages call `useDashboardScope()` or dashboard query hooks that use it internally.

- Page UI state:
  - Existing explorer-like pages mostly use local React state for filters, menus, selected metrics, chart mode, rows per page, and pagination.
  - Cost Explorer keeps several controls local rather than pushing all filter state into global stores.

- URL state:
  - Existing EC2 overview reads filters from `location.search`.
  - Global date/provider/account/region scope is URL-backed through dashboard scope params.

- Zustand:
  - Present in the frontend dependencies.
  - Usage found only in `frontend/src/features/client-home/stores/uploadHistorySelection.store.ts`.
  - Not a dashboard pattern for explorer pages.

Recommended state handling for Database Explorer v1.1:

- Time range:
  - Use dashboard scope `from` and `to` as the primary source.
  - The global header already owns date range changes through URL params.

- Metric toggle:
  - Page-local React state, default `"cost"`.
  - Include in React Query filters.
  - Optionally mirror to URL later if deep-linking is desired.

- Group by:
  - Page-local React state, default `"db_service"`.
  - Include in React Query filters.

- Filters:
  - `region_key` should come from dashboard scope if present, and can be overridden by page controls if v1.1 needs a page-local region filter.
  - `db_service` and `db_engine` should be page-local controls for v1.1.
  - Keep filter state in one object passed to `useDatabaseExplorerQuery`.

## 7. UI Component Recommendation

Proposed component tree:

```text
DatabaseExplorerPage
  DashboardPageHeader
  DatabaseExplorerFilters
  DatabaseExplorerCards
    KpiCard x 6
  DatabaseExplorerTrend
    WidgetShell
      BaseEChart
  DatabaseExplorerGroupedTable
    TableShell
      BaseDataTable
```

Suggested file location:

- `frontend/src/features/dashboard/pages/database/DatabaseExplorerPage.tsx`
- `frontend/src/features/dashboard/pages/database/databaseExplorer.types.ts`
- `frontend/src/features/dashboard/pages/database/databaseExplorer.utils.ts`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerFilters.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerCards.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerTrend.tsx`
- `frontend/src/features/dashboard/pages/database/components/DatabaseExplorerGroupedTable.tsx`
- `frontend/src/features/dashboard/pages/database/components/index.ts`

Component mapping:

- `DatabaseExplorerPage`
  - Follow page structure from `CostExplorerPage` and `S3OverviewPage`.
  - Use `dashboard-page database-explorer-page` class naming.

- `DatabaseExplorerFilters`
  - Reuse Cost Explorer control CSS classes where practical:
    - `cost-explorer-control-surface`
    - `cost-explorer-toolbar-row`
    - `cost-explorer-toolbar-trigger`
    - `cost-explorer-filter-popover`
    - `cost-explorer-chip-bar`
  - Include controls for metric, group by, DB service, DB engine, and optional region.

- `DatabaseExplorerCards`
  - Use `KpiCard`.
  - Cards:
    - Total Cost
    - Cost Trend %
    - Active DB Resources
    - Data Footprint
    - Avg Load
    - Connections
  - Do not wrap cards in navigation buttons for v1.1.

- `DatabaseExplorerTrend`
  - Use `WidgetShell` and `BaseEChart`.
  - Cost mode: stacked bar chart for compute/storage/io/backup and total tooltip.
  - Usage mode: line chart for load and connections.

- `DatabaseExplorerGroupedTable`
  - Use `TableShell` and `BaseDataTable`.
  - Columns should map to backend `table` rows:
    - Group
    - Total Cost
    - Compute
    - Storage
    - IO
    - Backup
    - Resource Count
    - Avg Load
    - Connections
  - Do not attach row click navigation in v1.1.

- Empty/loading/error:
  - Use `dashboard-note` for simple page-level loading/error.
  - Use `EmptyStateBlock` for chart-level or page-level no-data states.
  - Use `TableEmptyState` through `BaseDataTable`.

## 8. Implementation Constraints

Must not be changed during this analysis task:

- Backend code.
- DB schema.
- Existing routes.
- Existing navigation.
- Existing EC2/S3/inventory behavior.
- Existing shared API behavior.
- Existing dashboard CSS behavior.

Files likely safe to edit later for v1.1 implementation:

- `frontend/src/App.tsx`
  - Add `/dashboard/services/database` to `DASHBOARD_ROUTE_REGEX`.

- `frontend/src/features/dashboard/routes/DashboardRoutes.tsx`
  - Register `services/database`.

- `frontend/src/features/dashboard/common/navigation.ts`
  - Add Database under Services.

- `frontend/src/features/dashboard/components/DashboardSidebar.tsx`
  - Only if needed to support a direct-click nested Services entry without an Explorer submenu.

- `frontend/src/features/dashboard/components/DashboardGlobalHeader.tsx`
  - Add breadcrumbs for `/dashboard/services/database`.

- `frontend/src/features/dashboard/api/dashboardTypes.ts`
  - Add Database Explorer types.

- `frontend/src/features/dashboard/api/dashboardApi.ts`
  - Add Database Explorer API method and query-string builder.

- `frontend/src/features/dashboard/hooks/useDashboardQueries.ts`
  - Add `useDatabaseExplorerQuery`.

- `frontend/src/features/dashboard/pages/database/*`
  - New Database Explorer page and page-local components.

- `frontend/src/features/dashboard/styles/dashboard.css`
  - Add narrowly scoped Database Explorer classes only if existing dashboard/Cost Explorer classes are insufficient.

Files to avoid:

- Backend files under `backend/`.
- Phase 1 DB schema/model/migration files.
- Existing EC2 table/schema code.
- Existing EC2/S3 pages except as references.
- `frontend/dist`, `frontend/node_modules`, lock files, and generated output.
- Marketing/landing pages under `frontend/src/features/landing` unless a shell-level component is truly reused.

## 9. Final Recommendation

Implementation plan for Database Explorer v1.1:

1. Add frontend types for the backend `GET /services/database/explorer` response in `dashboardTypes.ts`.
2. Add `dashboardApi.getDatabaseExplorer(scope, filters)` using `apiGet` and `URLSearchParams`.
3. Add `useDatabaseExplorerQuery(filters)` in `useDashboardQueries.ts`.
4. Create `frontend/src/features/dashboard/pages/database/DatabaseExplorerPage.tsx` plus small page-local components for filters, cards, trend, and grouped table.
5. Register `/dashboard/services/database` in `App.tsx` and `DashboardRoutes.tsx`.
6. Add a single `Database` entry under Services navigation pointing to `/dashboard/services/database`.
7. Add Database breadcrumbs in `DashboardGlobalHeader.tsx`.
8. Render v1.1 with filters, metric toggle, group-by control, six cards, chart, and grouped table.
9. Do not add chart/table row click navigation, drilldown CTAs, or detail-page links until v1.2.

Recommended implementation route:

- `/dashboard/services/database`

Recommended backend request:

- `GET /services/database/explorer`

Recommended initial query params:

- `start_date`: from dashboard scope `from`
- `end_date`: from dashboard scope `to`
- `region_key`: dashboard/page region filter when present
- `db_service`: page DB service filter when present
- `db_engine`: page DB engine filter when present
- `metric`: `"cost"` or `"usage"`, default `"cost"`
- `group_by`: `"db_service"`, `"db_engine"`, or `"region"`, default `"db_service"`

## Validation Summary

Sections included:

- Current frontend folder structure summary
- Routing analysis
- Navigation/sidebar analysis
- Existing reference patterns
- API integration pattern
- State management pattern
- UI component recommendation
- Implementation constraints
- Final recommendation

Key frontend patterns discovered:

- Dashboard routing is gated by `App.tsx` regex and nested in `DashboardRoutes.tsx`.
- Dashboard pages run inside `DashboardLayout` with `DashboardScopeProvider`.
- API calls use `apiGet` and typed dashboard API methods.
- Server data uses React Query.
- Explorer-like pages use local React state for controls.
- Charts use ECharts through `BaseEChart`.
- Tables use AG Grid through `BaseDataTable`.
- KPI cards, widget shells, empty states, and table shells already exist.
- Services navigation is custom and needs careful handling for a direct-click Database entry without an Explorer submenu.
