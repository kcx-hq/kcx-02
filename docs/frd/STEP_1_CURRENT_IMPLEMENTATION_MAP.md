# STEP 1: Current Implementation Map (EC2 + Load Balancer)

## 1. Existing EC2 frontend pages/routes
- `/dashboard/ec2/explorer` -> `frontend/src/features/dashboard/pages/ec2/EC2ExplorerPage.tsx`
- `/dashboard/ec2/optimization` -> `frontend/src/features/dashboard/pages/ec2/EC2OptimizationPage.tsx`
- `/dashboard/inventory/aws/ec2/instances` -> `frontend/src/features/dashboard/pages/ec2/EC2InstancesPage.tsx`
- `/dashboard/inventory/aws/ec2/instances/:instanceId` -> `frontend/src/features/dashboard/pages/ec2/EC2InstanceDetailPage.tsx`
- `/dashboard/inventory/aws/ec2/volumes` -> `frontend/src/features/dashboard/pages/ec2/EC2VolumesPage.tsx`
- `/dashboard/inventory/aws/ec2/volumes/:volumeId` -> `frontend/src/features/dashboard/pages/ec2/EC2VolumeDetailPage.tsx`
- `/dashboard/inventory/aws/ec2/snapshots` -> `frontend/src/features/dashboard/pages/ec2/EC2SnapshotsPage.tsx`
- `/dashboard/inventory/aws/ec2/elastic-ip` -> `frontend/src/features/dashboard/pages/ec2/EC2EipPage.tsx`

## 2. Existing Load Balancer frontend pages/routes
- `/dashboard/load-balancer/explorer` -> `frontend/src/features/dashboard/pages/load-balancer/LoadBalancerExplorerPage.tsx`
- `/dashboard/load-balancer/optimization` -> `frontend/src/features/dashboard/pages/load-balancer/LoadBalancerOptimizationPage.tsx`
- `/dashboard/inventory/aws/load-balancer/list` -> `frontend/src/features/dashboard/pages/load-balancer/LoadBalancerListPage.tsx`
- `/dashboard/inventory/aws/load-balancer/list/:loadBalancerId` -> `frontend/src/features/dashboard/pages/load-balancer/LoadBalancerDetailPage.tsx`

## 3. Existing sidebar/navigation structure
- Defined in `frontend/src/features/dashboard/common/navigation.ts`.
- EC2 appears under `Services > EC2`:
  - Instances
  - Volumes
  - Snapshots
  - Optimization
  - Elastic IP
- Load Balancer appears under `Services > Load Balancer`:
  - Explorer
  - List
  - Optimization
- Sidebar behavior/rendering in `frontend/src/features/dashboard/components/DashboardSidebar.tsx`.

## 4. Existing EC2 backend APIs
- Router aggregation: `backend/src/features/_app/app.routes.ts`
- Explorer v1:
  - `GET /ec2/explorer`
  - `GET /dashboard/ec2/explorer`
  - `GET /ec2/explorer/network-breakdown`
  - `GET /dashboard/ec2/explorer/network-breakdown`
  - File: `backend/src/features/ec2/explorer/ec2-explorer.routes.ts`
- Explorer v2:
  - `GET|POST /ec2/explorer/cost`
  - `GET|POST /ec2/explorer/usage`
  - `GET|POST /ec2/explorer/data-transfer`
  - Files:
    - `backend/src/features/ec2/explorer-cost-v2/ec2-cost-explorer.routes.ts`
    - `backend/src/features/ec2/explorer-usage-v2/ec2-usage-explorer.routes.ts`
    - `backend/src/features/ec2/explorer-data-transfer-v2/ec2-data-transfer-explorer.routes.ts`
- Optimization + recommendations:
  - `GET /dashboard/ec2/optimization/summary`
  - `GET /dashboard/ec2/optimization/instances`
  - `GET /dashboard/ec2/optimization/instances/:optimizationType`
  - `GET /dashboard/ec2/recommendations`
  - `POST /dashboard/ec2/recommendations/refresh`
  - `PATCH /dashboard/ec2/recommendations/:id/status`
  - File: `backend/src/features/ec2/optimization/ec2-optimization.routes.ts`
- Inventory/detail endpoints:
  - Instances: `/inventory/aws/ec2/instances` (+ performance, + `:instanceId/details`)
  - Volumes: `/inventory/aws/ec2/volumes` (+ performance, + `:volumeId/details`)
  - Snapshots: `/inventory/aws/ec2/snapshots`
  - Elastic IP: `/dashboard/ec2/elastic-ips`
  - Data transfer: `/dashboard/ec2/data-transfer`

## 5. Existing Load Balancer backend APIs
- Explorer:
  - `GET /dashboard/load-balancer/explorer/summary`
  - `GET /dashboard/load-balancer/explorer/trend`
  - `GET /dashboard/load-balancer/explorer/group-by`
  - File: `backend/src/features/load-balancer/explorer/load-balancer-explorer.routes.ts`
- Inventory:
  - `GET /inventory/aws/load-balancers`
  - `GET /inventory/aws/load-balancers/:loadBalancerId`
  - File: `backend/src/features/load-balancer/inventory/load-balancer-inventory.routes.ts`
- Recommendation generation service exists internally:
  - `backend/src/features/load-balancer/recommendations/load-balancer-recommendations.service.ts`
  - No dedicated LB recommendation API route set yet.

## 6. Existing database tables/models
- EC2-related models (`backend/src/models/ec2`):
  - `ec2_instance_inventory_snapshots`
  - `ec2_volume_inventory_snapshots`
  - `ec2_snapshot_inventory_snapshots`
  - `ec2_eip_inventory_snapshots`
  - `ec2_instance_utilization_hourly`, `ec2_instance_utilization_daily`
  - `fact_ec2_instance_daily`, `fact_ec2_instance_cost_daily`, `fact_ec2_instance_coverage_daily`
  - `fact_ebs_volume_daily`, `ebs_volume_utilization_hourly`, `ebs_volume_utilization_daily`
  - `ec2_load_balancer_inventory_snapshots`, `ec2_target_group_inventory_snapshots`
- Load Balancer models (`backend/src/models/load_balancers`):
  - `load_balancers`
  - `load_balancer_target_groups`
  - `load_balancer_listeners`
  - `load_balancer_cost_daily`
  - `load_balancer_metrics_daily`
- Shared recommendation persistence:
  - `fact_recommendations` (`backend/src/models/billing/fact_recommendations.ts`)

## 7. Current navigation flows
- EC2 flow today:
  - Sidebar -> EC2 Explorer -> drill-down to instances/volumes/EIP/detail pages.
  - Explorer interactions route users by selected metric/group to inventory pages.
- Load Balancer flow today:
  - Sidebar -> LB Explorer -> drill-down to LB List -> LB Detail.
  - LB Detail links to LB Optimization context using query params.
- Route definitions are spread across:
  - `frontend/src/features/dashboard/routes/DashboardRoutes.tsx`
  - `frontend/src/features/dashboard/common/navigation.ts`

## 8. Current recommendation flow
- EC2 recommendation lifecycle is API-backed:
  - List, refresh, status update via `/dashboard/ec2/recommendations*`.
- LB recommendation generation exists in backend service layer, but API/UI ownership is mixed:
  - LB recommendation types are recognized in EC2 recommendation service (`ec2-recommendations.service.ts`).
  - LB detail/optimization UI uses EC2 recommendations query hooks for related items.
- Result: recommendation domain boundary between EC2 and LB is currently blurred.

## 9. EC2 gaps
- Two active Explorer stacks (v1 and v2) exist simultaneously; canonical EC2 Explorer contract is not yet finalized.
- EC2 recommendation domain currently includes LB recommendation types, creating service-boundary leakage.
- FRD-level API source-of-truth (which endpoints are strategic vs transitional) is not explicitly documented.

## 10. Load Balancer gaps
- LB recommendation APIs are missing as first-class endpoints (list/detail/refresh/status update lifecycle).
- LB recommendation status workflow is not isolated as an LB-owned flow.
- LB optimization behavior currently depends on mixed EC2 recommendation pathways.
- Path naming mismatch risk (UI uses `/load-balancer/...`, inventory API uses `/load-balancers`) should be explicitly standardized.

## 11. FRD decisions needed before implementation
- Load Balancer must be treated as a separate service domain, not mixed inside EC2 service ownership.
- EC2 recommendations must not own Load Balancer recommendations.
- EC2 FRD must define canonical Explorer APIs and migration/deprecation plan because both v1 and v2 currently exist.
- Load Balancer FRD must define dedicated recommendation APIs and status update flow.
- Navigation paths must be documented page-by-page in the next FRD step, including source page, target page, and required query/route params.
- Recommendation table/domain strategy decision required:
  - keep shared `fact_recommendations` with strict domain partitioning, or
  - introduce LB-specific recommendation storage surface.
- API naming/versioning decision required for cross-domain consistency (`/load-balancer` vs `/load-balancers`, and v1/v2 explorer path policy).
