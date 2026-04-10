# Client Management System Understanding

## 1. Executive Summary

- KCX Admin `Client Management` currently lists client accounts by reading from `users` and joining `tenants`.
- The current backend endpoint is read-only: `GET /admin/clients`; no create/update/block/delete actions exist in this module yet.
- The business concept of a "client" has shifted from legacy `Clients` table to the newer `tenants` + `users` model.
- Some UI columns in the current panel (`heardAboutUs`, `source`) are not fully backed by the current `admin-clients` service response, so this module is still a skeleton.
- Demo onboarding (`schedule demo`) is the practical source of initial client identity data today (tenant + first user + demo request metadata).
- For deeper admin implementation, this module should become a cross-entity read model (user + tenant + latest demo request + usage signals) rather than only a direct `users` table dump.

---

## 2. What "Client Management" Means in KCX

- In current implementation, "client" is effectively a user account inside a tenant:
  - `users` = person/login identity,
  - `tenants` = organization/account container.
- Admin `Client Management` is intended to provide account-level operational visibility (who the client is, org, status, onboarding provenance, and freshness).
- The current page already has the correct direction for admin visibility (table + status + timestamps), but underlying data mapping is minimal.
- "Client source" and "heard about us" are onboarding attributes, not core user attributes; they come from demo flow (`DemoRequests`) in current schema, not from `users`.

---

## 3. Source of Truth: Tables / Models / Entities

### `users` (`User`)
- Purpose: end-user identity records.
- Key fields: `id`, `tenant_id`, `full_name`, `email`, `role`, `status`, `created_at`, `updated_at`.
- Persistence type: persistent.
- Admin visibility: very high.
- Notes: currently the primary feed for `/admin/clients`.

### `tenants` (`Tenant`)
- Purpose: organization/account container.
- Key fields: `id`, `name`, `slug`, `status`, `created_at`, `updated_at`.
- Persistence type: persistent.
- Admin visibility: very high.
- Notes: currently joined to users to expose `companyName`.

### `DemoRequests` (`DemoRequest`)
- Purpose: pre/onboarding request trail (scheduling, intent, and metadata).
- Key fields: `userId`, `heardAboutUs`, `status`, `slotStart`, `slotEnd`, `calcom*`, timestamps.
- Persistence type: persistent.
- Admin visibility: high (especially for onboarding context).
- Notes: this is the only clear current source for `heardAboutUs`.

### Legacy `Clients` table (historical)
- Purpose: previous single-table client model (`firstName`, `lastName`, `source`, etc.).
- Current state: dropped in migration path; replaced by `users` + `tenants`.
- Admin visibility: none in current runtime.
- Notes: some admin UI expectations still reflect this legacy shape.

---

## 4. Current Client Management Scope (Implemented vs Intended)

### Implemented now
- Authenticated admin endpoint: `GET /admin/clients`.
- Backend service fetches all users ordered by `createdAt DESC` and includes tenant relation.
- Mapping currently returns:
  - `id`, `firstName`, `lastName` (split from `fullName`),
  - `email`, `companyName`,
  - `status`, `role`,
  - `createdAt`, `updatedAt`.
- Admin frontend page:
  - loads list on mount,
  - shows basic table,
  - supports manual refresh,
  - has loading/empty/error states.

### Not implemented yet (but implied by UI/needs)
- No filters/search/sort/pagination at API level.
- No client actions (activate/deactivate/block/invite/reset/etc.).
- No robust source attribution model exposed to admin.
- No full onboarding summary stitched into this endpoint (latest demo request, stage, etc.).

---

## 5. Lifecycle of a Client Record (Current Reality)

1. Prospect submits schedule-demo form.
2. Backend creates or reuses a `tenant` (slug inferred from email domain).
3. Backend creates or reuses a `user` under that tenant.
4. Backend creates a `DemoRequest` row with `heardAboutUs` and slot metadata.
5. Admin panel later lists the user via `/admin/clients` with tenant name and status.

Important behavior:
- `user.email` is unique globally.
- Existing users can be re-linked to a tenant in schedule-demo flow if needed.
- `fullName` is stored as one field and split for admin display.

---

## 6. Backend Implementation Map

### Routes
- `GET /admin/clients` (admin auth required).

### Controllers
- `admin-clients.controller.ts`
  - delegates to service and wraps result with success envelope.

### Services
- `admin-clients.service.ts`
  - reads `User.findAll({ include: Tenant, order: createdAt DESC })`,
  - maps user+tenant into admin list DTO.

### Auth and access
- `requireAdminAuth` middleware protects admin-clients route.

### Data-contract note
- Route currently returns user/tenant-centered summary, not a dedicated denormalized admin client aggregate.

---

## 7. Frontend Implementation Map

### Module
- `admin/src/modules/clients/pages/ClientsPage.tsx`
- `admin/src/modules/clients/admin-clients.api.ts`

### Behavior
- Fetches `/admin/clients` using admin token.
- Renders table columns: client, email, company, heard about us, status, source, updated.
- Status badge variant:
  - `ACTIVE` -> subtle,
  - `BLOCKED` -> warning,
  - otherwise outline.

### Current mismatch to backend
- Frontend type includes `heardAboutUs` and `source`.
- Backend service currently does not map/provide these fields.
- This indicates scaffold-first UI with partial backend alignment.

---

## 8. Business Rules and Operational Constraints

- Client list is currently "all users," not restricted to one role/type in admin-clients service.
- `role` exists and is returned by backend, but UI currently does not display it.
- Company shown in client list is derived from `tenant.name`.
- User status and tenant status are separate fields at model level; only user status is currently surfaced in this module.
- Onboarding metadata (`heardAboutUs`) lives with demo request lifecycle, not user core profile.

---

## 9. Relationship to Adjacent Admin Modules

- `Client Management` and `Demo Requests` are tightly related:
  - client identity lives in user/tenant,
  - onboarding funnel metadata lives in demo requests.
- For true "client management depth," this module should likely consume a joined/admin projection:
  - user + tenant + latest demo request + onboarding stage.
- Without that projection, admin context is fragmented across modules.

---

## 10. Admin-Relevant Reality Extraction

- Primary list entity today: `users` joined with `tenants`.
- Practical drill-down context needed next:
  - onboarding source / heard-about-us,
  - latest demo request status,
  - tenant status and lifecycle markers,
  - cloud connection and billing upload onboarding state (cross-module).
- Current panel is a usable skeleton, not a complete management console.
- Best next evolution is to define an explicit admin client read model instead of incrementally patching field-by-field.

---

## 11. Gaps / Partial Areas / Ambiguities

- DTO mismatch: frontend expects fields not currently supplied by backend (`heardAboutUs`, `source`).
- No `source` canonical field in current user/tenant schema after migration away from legacy `Clients`.
- No pagination/search/filtering in `/admin/clients`; scalability risk as user volume grows.
- No dedicated client actions API surface (status update, role change, etc.) in this module.
- `fullName` split into first/last is heuristic and can be lossy for complex names.
- Role scoping ambiguity: endpoint returns all users; business definition of "client" may need stricter filtering.

---

## 12. Final System Understanding Snapshot

- Current truth: Client Management is a read-only admin listing over `users + tenants`.
- Onboarding-enriched fields shown in UI are partially disconnected from actual response shape.
- The module is correctly positioned as a skeleton for deeper admin operations.
- To move in-depth, introduce a dedicated admin client aggregate contract and map all UI fields from stable backend sources.
- Key design principle: separate core identity (user/tenant) from onboarding metadata (demo requests), but present both in one admin-centric projection.
