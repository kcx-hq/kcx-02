# Load Balancer Functional Requirements Document 

## 1. Document Overview
- Document Title: Load Balancer Module FRD
- Product: KCX FinOps Platform
- Audience: Product Manager, Designers, Frontend Team, Backend Team, QA Team
- Version: 2.0 (business + UX enhanced)
- Purpose: Define why the Load Balancer module exists, how users work through it, and what functionality and APIs are required.

## 2. Module Purpose
The Load Balancer module helps teams understand traffic-driven cloud cost and service health by connecting cost trends, usage trends, and target health signals to actionable optimization workflows.

## 3. Business Goal
- Improve visibility into load-balancer-specific spend drivers.
- Reduce time to identify expensive, underused, or unhealthy load balancers.
- Enable FinOps and CloudOps teams to collaborate on optimization decisions.
- Ensure module ownership is independent from EC2 to avoid mixed responsibilities.

## 4. User Roles
- FinOps Analyst
  - Detects high-cost and low-efficiency load balancers.
- Cloud Operations Engineer
  - Investigates health, listener config, target group behavior, and traffic patterns.
- Platform/Infra Manager
  - Prioritizes remediation and tracks optimization progress.
- QA Team
  - Validates flows from Explorer to Detail to Recommendations with status transitions.

## 5. Scope
In scope pages:
- Load Balancer Overview
- Load Balancer Explorer
- Load Balancer List
- Load Balancer Detail
- Load Balancer Recommendations

In scope capabilities:
- LB-specific KPI and metric analysis
- Drilldowns from trends to resource-level detail
- LB-focused recommendation workflow and status lifecycle
- Clear API and data source mapping for implementation/testing

## 6. Out of Scope
- EC2 module optimization behavior.
- S3/Database/non-LB services.
- Real-action execution orchestration (for example auto-delete) beyond recommendation status workflow.

## 7. Navigation Sitemap
- `Services > Load Balancer`
  - Explorer -> `/dashboard/load-balancer/explorer`
  - List -> `/dashboard/inventory/aws/load-balancer/list`
  - Optimization -> `/dashboard/load-balancer/optimization`
- Detail route
  - `/dashboard/inventory/aws/load-balancer/list/:loadBalancerId`

## 8. Page-by-Page Functional Requirements

### 8.1 Load Balancer Overview
#### 1. Business Purpose
Provide a quick operational and financial pulse check for the load balancer estate.
#### 2. User Problem Solved
Users need to know where to investigate first without scanning raw inventory tables.
#### 3. User Workflow
Open Load Balancer module -> review summary KPIs -> identify suspicious movement -> drill into Explorer/List.
#### 4. Why This Navigation Exists
Overview is the entry point that reduces cognitive load and helps users choose the next investigation path.
#### 5. Expected User Outcome
User quickly identifies if there is cost pressure, usage inefficiency, or health risk.
#### 6. UX Behavior
- KPI cards with trend context
- Compact chart summary
- Filter chips and clear actions
- Loading, error, and empty placeholders
#### 7. Functional Behavior
- Summarizes total LB cost and component mix.
- Highlights LB count/type distribution and high-level utilization posture.
#### 8. Technical/API Notes
- Route context currently represented by Explorer page baseline.
- APIs:
  - `GET /dashboard/load-balancer/explorer/summary`
  - `GET /dashboard/load-balancer/explorer/trend`

### 8.2 Load Balancer Explorer
#### 1. Business Purpose
Enable analytical exploration of LB cost, usage, and footprint trends.
#### 2. User Problem Solved
Users need to explain why cost changed and whether traffic/health patterns justify that spend.
#### 3. User Workflow
Select metric -> apply filters/grouping -> inspect chart and table -> drill down into filtered list/detail.
#### 4. Why This Navigation Exists
Users need one-click transitions from aggregate patterns to concrete assets causing those patterns.
#### 5. Expected User Outcome
User isolates problematic groups (for example region/type/account/tag) and moves to resource-level validation.
#### 6. UX Behavior
- Metric switcher
- Usage type switcher
- Group-by controls
- Filter panel/chips
- Chart type toggle
- Interactive chart/table drilldowns
#### 7. Functional Behavior
- Supports metric-based rendering and grouped trend/table output.
- Chart click and row click pass scoped filters to list/detail pages.
#### 8. Technical/API Notes
- Route: `/dashboard/load-balancer/explorer`
- APIs:
  - `GET /dashboard/load-balancer/explorer/summary`
  - `GET /dashboard/load-balancer/explorer/trend`
  - `GET /dashboard/load-balancer/explorer/group-by`
- Query params include dates, metric, usageType, groupBy, and scope filters.

### 8.3 Load Balancer List
#### 1. Business Purpose
Provide a sortable and searchable LB inventory with cost signals for operational triage.
#### 2. User Problem Solved
After identifying a costly group, users need a concrete list of candidate load balancers.
#### 3. User Workflow
Arrive from Explorer with filters -> validate top resources -> open specific LB detail.
#### 4. Why This Navigation Exists
List view is the bridge from group-level analysis to resource-level diagnosis.
#### 5. Expected User Outcome
User quickly identifies which load balancers require deeper investigation.
#### 6. UX Behavior
- Search box
- Type/scheme/state quick filters
- Region/tag filter drawer
- Sort + pagination
- Row click to detail
#### 7. Functional Behavior
- Displays inventory plus cost component columns.
- Preserves drilldown context from Explorer.
#### 8. Technical/API Notes
- Route: `/dashboard/inventory/aws/load-balancer/list`
- API: `GET /inventory/aws/load-balancers`

### 8.4 Load Balancer Detail
#### 1. Business Purpose
Provide complete technical and FinOps context for one load balancer before action.
#### 2. User Problem Solved
Users cannot make safe optimization decisions from summary/list pages alone.
#### 3. User Workflow
Open detail -> review cost trends + traffic trends + health -> inspect target groups/listeners/instances -> decide operational next step.
#### 4. Why This Navigation Exists
Users need deep context to avoid risky cost-cutting that harms availability or latency.
#### 5. Expected User Outcome
User can confidently decide: keep as-is, tune config, migrate, or decommission.
#### 6. UX Behavior
- Structured sections
- Cost and usage trend panels
- Target group health table
- Listener information table
- Tags and recommendation context panels
#### 7. Functional Behavior
- Shows linked target groups.
- Shows linked instances (directly or derived via target group membership).
- Shows traffic trends and cost trends for selected range.
- Shows health status and listener configuration.
#### 8. Technical/API Notes
- Route: `/dashboard/inventory/aws/load-balancer/list/:loadBalancerId`
- APIs:
  - `GET /inventory/aws/load-balancers/:loadBalancerId`
  - `GET /dashboard/load-balancer/explorer/summary` (scoped)
  - `GET /dashboard/load-balancer/explorer/trend` (scoped)

### 8.5 Load Balancer Recommendations
#### 1. Business Purpose
Turn LB insights into an actionable backlog with lifecycle tracking.
#### 2. User Problem Solved
Without status workflow, recommendations remain informational and are not operationalized.
#### 3. User Workflow
Open recommendations -> filter by severity/type/status -> open recommendation detail -> update status -> assign/follow-up operational action.
#### 4. Why This Navigation Exists
It closes the loop between analysis and execution for FinOps + CloudOps collaboration.
#### 5. Expected User Outcome
Teams can prioritize optimization opportunities and track progress to completion.
#### 6. UX Behavior
- Recommendation KPI summaries
- Filterable recommendation table/cards
- Recommendation detail modal/panel
- Status action controls
#### 7. Functional Behavior
- Lists LB recommendations by scope.
- Supports recommendation detail view.
- Supports status lifecycle updates.
- Supports navigation to impacted LB detail page.
#### 8. Technical/API Notes
- Route: `/dashboard/load-balancer/optimization`
- Current implementation gap: dedicated LB recommendation APIs required (see Sections 16 and Required Workflow).

## 9. Filters
Shared filters:
- Date range
- Account
- Region
- Type
- Scheme
- State
- Tags

Explorer filters:
- Metric
- Usage type
- Group-by
- Group values

List filters:
- Search
- Sort/pagination

Recommendation filters:
- Recommendation type
- Status
- Severity/risk
- Search

## 10. KPIs / Metrics
Supported load balancer types:
- ALB
- NLB
- Classic ELB

Metrics:
- Cost
- LCU Usage
- Requests
- Processed Bytes
- Active Connections
- Load Balancer Count

Common KPI outputs:
- Total cost
- Cost components (fixed, LCU, data processing)
- LB count by type/scheme
- Health posture indicators

## 11. Explorer Behavior
- Explorer is metric-driven and filter-sensitive.
- Cost and usage views should be interpretable side-by-side to explain spend behavior.
- Group-by should support business and operational dimensions (account, region, type, scheme, tag, LB).
- Drilldown controls should preserve context automatically, avoiding manual rework.

## 12. Drilldown Behavior
- Graph click -> filtered Load Balancer List
- Table row click -> filtered Load Balancer List
- Load balancer row click -> Load Balancer Detail
- Recommendation click -> recommendation detail/modal

Why this matters:
Drilldowns convert �interesting trend� into �actionable resource investigation,� which is essential for fast cost, traffic, and health troubleshooting.

## 13. Recommendation System
Recommendation types:
- Unused Load Balancer
- Low Traffic Load Balancer
- High LCU Cost
- No Healthy Targets
- Old Classic Load Balancer

Status lifecycle needed:
- `open`
- `in_progress`
- `snoozed`
- `dismissed`
- `completed`

Operational value:
- FinOps can prioritize savings.
- CloudOps can validate risk and execute safe changes.
- Managers can monitor closure velocity.

## 14. Table Definitions
Explorer group-by table:
- Group
- Load Balancer Count
- Total Cost
- Fixed Cost
- LCU Cost
- Data Processing Cost
- Usage columns (requests/bytes/connections as applicable)

List table:
- Name/ARN
- Type
- Scheme
- State
- Region
- Total Cost
- Fixed Cost
- LCU Cost
- Data Processing Cost

Detail tables:
- Target groups: name, protocol, port, target type, healthy/unhealthy targets, health status
- Listeners: protocol, port, SSL policy, default actions
- Tags: key/value

Recommendation table:
- Type
- Resource
- Estimated impact
- Severity/risk
- Status
- Evidence summary
- Updated time

## 15. Detail Page Behavior
Must include:
- Linked target groups
- Linked instances
- Traffic trends
- Cost trends
- Health status
- Listener information

Design intent:
This page should answer �Is this load balancer expensive for a valid reason, or is there an optimization risk/opportunity?�

## 16. Backend API Mapping
Current implemented APIs:
- Explorer:
  - `GET /dashboard/load-balancer/explorer/summary`
  - `GET /dashboard/load-balancer/explorer/trend`
  - `GET /dashboard/load-balancer/explorer/group-by`
- Inventory:
  - `GET /inventory/aws/load-balancers`
  - `GET /inventory/aws/load-balancers/:loadBalancerId`

Required missing APIs for recommendation workflow:
- `GET /dashboard/load-balancer/recommendations`
- `GET /dashboard/load-balancer/recommendations/:recommendationId`
- `POST /dashboard/load-balancer/recommendations/refresh`
- `PATCH /dashboard/load-balancer/recommendations/:recommendationId/status`
- `GET /dashboard/load-balancer/recommendations/summary`

## 17. Database/Data Sources
Primary LB data sources:
- `load_balancers`
- `load_balancer_target_groups`
- `load_balancer_listeners`
- `load_balancer_cost_daily`
- `load_balancer_metrics_daily`

Recommendation generation exists in service layer today, but API exposure is incomplete for a full product workflow.

## 18. Loading/Error/Empty States
Loading:
- Explorer: summary/chart/table skeletons
- List: table skeleton
- Detail: section skeletons
- Recommendations: table/cards skeleton

Error:
- Section-level error with retry action

Empty:
- No load balancers for selected scope
- No trend data in selected range
- No target groups/listeners
- No recommendations for active filters

## 19. Performance Expectations
- Explorer interactions should remain responsive for common date ranges.
- List must use server-side pagination/sorting.
- Detail should render core data first, then secondary sections.
- Recommendation filtering/status updates should support efficient refresh behavior.

## 20. Acceptance Criteria
- Users can start in Explorer and reach resource-level detail with context preserved.
- Cost/usage/health drilldowns are intuitive and one-click.
- Detail page contains cost, traffic, target, listener, instance, and health context.
- Recommendation workflow is available as LB-owned experience (not EC2-owned).
- Loading/error/empty states are present and testable across pages.

## End-to-End User Journey
1. A FinOps user starts in Load Balancer Explorer.
2. The user identifies high cost, high LCU, or low traffic patterns.
3. The user drills into the Load Balancer List with pre-applied filters.
4. The user opens a specific Load Balancer Detail page.
5. The user reviews target groups, listeners, linked instances, traffic trends, cost trends, and health signals.
6. The user reviews recommendations for that load balancer.
7. The user updates recommendation status or takes an operational decision with CloudOps.

## Why Load Balancer is a Separate Service
- Load Balancer has its own cost model.
- LCU, requests, processed bytes, and target health are fundamentally different from EC2 instance metrics.
- Separate navigation avoids mixing compute optimization and traffic/load-balancing optimization.
- Recommendation ownership becomes clearer.
- PM, frontend, backend, and QA teams can plan, build, and test this module independently.

## Required Load Balancer Recommendation Workflow
Current gap:
- LB recommendations currently do not have a complete LB-owned API/UI lifecycle.
- Some current flows rely on EC2 recommendation pathways, which creates ownership confusion.

Expected future behavior:
- LB recommendations must not depend on EC2 recommendation APIs.
- LB module needs:
  - Its own recommendation list API
  - Its own recommendation detail/modal
  - Its own status update API
  - Its own summary/refresh flow

### Recommendation Type: Unused Load Balancer
- Why it exists
  - Detect direct waste where LB cost exists without meaningful traffic.
- What problem it detects
  - Paying for load balancing capacity that provides little/no business value.
- What user should review
  - Request volume, active connections, processed bytes, dependency/ownership.
- Expected action
  - Decommission or consolidate where safe.
- Status workflow needed
  - `open -> in_progress -> completed` with optional `snoozed/dismissed`.

### Recommendation Type: Low Traffic Load Balancer
- Why it exists
  - Surface over-provisioned LB footprint.
- What problem it detects
  - Traffic too low to justify standalone LB cost profile.
- What user should review
  - Traffic trend stability, architectural need, environment criticality.
- Expected action
  - Consolidate traffic paths, optimize architecture, or right-size.
- Status workflow needed
  - Full lifecycle with clear ownership and rationale comments.

### Recommendation Type: High LCU Cost
- Why it exists
  - LCU often drives variable cost spikes.
- What problem it detects
  - Cost inefficiency from traffic pattern or configuration behavior.
- What user should review
  - LCU drivers, listener rules, connection behavior, byte/request patterns.
- Expected action
  - Tune rules/routing, optimize traffic shaping, reduce wasteful patterns.
- Status workflow needed
  - Track analysis and remediation phases distinctly (`open`, `in_progress`, `completed`).

### Recommendation Type: No Healthy Targets
- Why it exists
  - Connect optimization with reliability risk.
- What problem it detects
  - Load balancer running without healthy backend targets.
- What user should review
  - Target group health checks, backend readiness, deployment incidents.
- Expected action
  - Restore healthy targets before cost-only actions.
- Status workflow needed
  - Fast escalation path with risk-aware workflow (typically high priority).

### Recommendation Type: Old Classic Load Balancer
- Why it exists
  - Classic ELB may represent legacy architecture and modernization opportunity.
- What problem it detects
  - Potentially outdated, less efficient or less feature-rich deployment patterns.
- What user should review
  - Business dependency, migration risk, feature parity needs.
- Expected action
  - Plan migration to ALB/NLB where appropriate.
- Status workflow needed
  - Longer-cycle workflow with planning states and audit trail.

## Frontend UI Reference Pack (Load Balancer)

### Load Balancer Explorer
### Frontend Reference
[Insert Screenshot Here]

### Key UI Sections
1. Metric + Group-By Control Area
- Controls cost/usage/count perspective and segmentation.
- Exists so users can move from high-level trend to meaningful contributor groups.
2. Summary KPI Cards
- Shows top-level LB cost and usage posture.
- Exists to give immediate decision context before drilldown.
3. Trend Chart + Grouped Table
- Combines visual trend recognition with exact grouped values.
- Exists to support both anomaly detection and precise investigation.

### Load Balancer List
### Frontend Reference
[Insert Screenshot Here]

### Key UI Sections
1. Search + Filter Toolbar
- Filters by type/scheme/state/region/tags and search term.
- Exists to quickly isolate candidate load balancers from Explorer findings.
2. Inventory Cost Table
- Displays LB rows with total/fixed/LCU/data-processing costs.
- Exists as the main triage workspace for deciding which asset to inspect.
3. Row-to-Detail Navigation
- Clicking a row opens LB detail.
- Exists to connect cost anomaly signals to operational root cause context.

### Load Balancer Detail
### Frontend Reference
[Insert Screenshot Here]

### Key UI Sections
1. Overview + Cost/Traffic Trend Panels
- Presents identity plus financial/traffic behavior over time.
- Exists to answer “is cost justified by load profile?”
2. Target Groups + Health Section
- Shows healthy/unhealthy target counts and health posture.
- Exists to connect optimization decisions with reliability risk.
3. Listener + Linked Context + Recommendations
- Shows listener config and related optimization items.
- Exists to support safe, actionable remediation decisions.

### Load Balancer Recommendation Page
### Frontend Reference
[Insert Screenshot Here]

### Key UI Sections
1. Recommendation KPI Summary
- Shows total opportunities and impact at a glance.
- Exists to guide prioritization for FinOps and CloudOps.
2. Recommendation Filter + Table View
- Supports sorting/filtering by type/status/severity/scope.
- Exists to operationalize backlog management.
3. Recommendation Detail + Status Action Panel
- Provides evidence and status update controls.
- Exists to track real execution progress, not just static insights.

## Navigation Flow Diagrams (Load Balancer)

### Explorer-to-Detail Investigation Flow
```text
Load Balancer Explorer
  -> (Chart/Table Click)
Load Balancer List (Pre-filtered)
  -> (Row Click)
Load Balancer Detail
  -> Review Cost/Traffic/Health/Listeners/Target Groups
```

### Recommendation Workflow Flow
```text
Load Balancer Recommendations
  -> Filter by Type/Status/Severity
  -> Open Recommendation Detail
  -> Update Status (open/in_progress/snoozed/dismissed/completed)
  -> Navigate to Load Balancer Detail (if validation is needed)
```
