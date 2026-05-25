# Functional Requirements Document (FRD)
**Project:** Cloud Cost Management Dashboard  
**Version:** 1.0  
**Date:** May 21, 2026

## 1. Document Overview

| Item | Details |
|---|---|
| Project Name | Cloud Cost Management Dashboard |
| Purpose | Define functional and non-functional requirements for the already built dashboard to support operations, QA, enhancements, and stakeholder governance. |
| Intended Audience | Product Managers, Business Analysts, Developers, QA Testers, Cloud Operations, Finance Stakeholders, Security/Governance Teams |
| Document Version | v1.0 |
| Assumptions | AWS is primary cloud source; role-based access is implemented via enterprise auth; cost data ingestion is periodic (not real-time); historical data may include deleted resources; export and notifications are enabled per role permissions. |

---

## 2. Product Overview
The Cloud Cost Management Dashboard enables users to monitor, analyze, and control cloud spending across services, accounts/projects, and regions. It also provides visibility into S3 storage costs, anomaly detection, policy-driven governance, and budget planning/monitoring to improve cost efficiency and financial accountability.

---

## 3. Scope

### In Scope
1. Overview Dashboard
2. Cost Explorer
3. Cost History
4. S3 Section
5. Anomalies
6. Policies
7. Budgets
8. Global filtering, export, search, pagination, and RBAC
9. Notifications for key events (anomalies, budget thresholds, policy violations)

### Out of Scope
1. Direct resource lifecycle actions in cloud (e.g., deleting resources from dashboard)
2. Billing payments/invoice settlement
3. Multi-cloud support beyond configured providers
4. Manual correction of source billing records
5. Advanced predictive ML model training interface

---

## 4. User Roles

| Role | Permissions | Accessible Modules |
|---|---|---|
| Admin | Full access: view/create/edit/delete/configure policies, budgets, exports, notifications, role mapping | All |
| Finance User | View all cost/budget data, create/manage budgets, export reports, review anomalies | Overview, Cost Explorer, Cost History, Anomalies, Budgets, S3 (view), Policies (view) |
| Cloud Engineer | Deep technical view, anomaly/policy remediation workflow, S3 optimization analysis | Overview, Cost Explorer, Cost History, S3, Anomalies, Policies, Budgets (view) |
| Read-only Viewer | View-only access, no create/edit/resolve actions, limited export as configured | Overview, Cost Explorer, Cost History, S3, Anomalies (view), Policies (view), Budgets (view) |

---

## 5. Functional Requirements

## A. Overview Dashboard

| Req ID | Title | Description | Role | Preconditions | Input Data | System Behavior | Output | Validation | Error Handling | Priority | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| OV-001 | Total Cloud Cost Summary | Show total cost for selected period | All | Data source connected | Date range/filter | Aggregate total cost | KPI card | Numeric, currency format | Show fallback + retry | High | Card loads in <3s with correct total |
| OV-002 | Month-to-Date Cost | Display MTD spend | All | Current month data exists | Account/service filters | Compute from month start to today | MTD KPI | Date boundary = calendar month | Graceful “no data” | High | Matches source within tolerance |
| OV-003 | Forecasted Cost | Show projected month-end spend | Admin/Finance/Engineer | Forecast model/data available | Historical + current run rate | Generate forecast amount | Forecast KPI | Forecast confidence not null | Flag unavailable forecast | High | Forecast shown with timestamp |
| OV-004 | Cost Trend Cards | Show trend delta vs previous period | All | Prior period data exists | Current vs prior period | Calculate % change | Up/down trend indicators | Division-by-zero handling | N/A state if no baseline | High | Trend sign and value accurate |
| OV-005 | Top Services by Cost | Rank services by spend | All | Service-level data exists | Filters | Sort by cost desc, top N | Ranked list/chart | N configurable | Empty list message | High | Correct top ranking shown |
| OV-006 | Top Accounts/Projects | Rank accounts/projects by spend | All | Account mapping exists | Filters | Aggregate + rank | Ranked widget | Account IDs valid | Unknown mapped as “Unassigned” | High | Ranking aligns with source totals |
| OV-007 | Region-wise Summary | Show cost by region | All | Region metadata exists | Filters | Aggregate by region | Region chart/table | Region code normalization | Unknown region bucket | Medium | Region totals reconcile |
| OV-008 | Quick Navigation | Jump to module details | All | Modules enabled | Click action | Route with preserved filters | Target module view | Valid route check | Route error toast | Medium | Navigation works with context retained |
| OV-009 | Overview Filters | Filter by date/account/service/region | All | Filter controls available | User selections | Apply global query params | Filtered widgets | Date range valid | Invalid filter message | High | All widgets refresh consistently |

## B. Cost Explorer

| Req ID | Title | Description | Role | Preconditions | Input Data | System Behavior | Output | Validation | Error Handling | Priority | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CE-001 | Interactive Cost Analysis | Dynamic exploration canvas | All | Cost dataset loaded | Filter/group selections | Query/aggregate interactively | Updated chart/table | Parameter schema valid | Recoverable query error | High | Results update without page reload |
| CE-002 | Advanced Filters | Date/service/account/region/tag/environment | All | Metadata dictionary loaded | Multi-filter values | Apply intersection logic | Filtered dataset | Allowed values only | Invalid value rejected | High | Correct filtered result set |
| CE-003 | Group By | Group by service/account/region/tag | All | Group dimension available | Selected dimension | Aggregate by key | Grouped chart/table | Single or multi group constraints | Clear error for invalid combo | High | Grouping matches selected dimension |
| CE-004 | Period Comparison | Compare periods | All | Two comparable periods | Period A/B | Compute delta + % change | Comparison view | Comparable granularity | Inform if incompatible | High | Delta values accurate |
| CE-005 | Chart & Table Views | Toggle visualization modes | All | Data returned | View mode selection | Render selected mode | Chart or table | Supported chart types only | Fallback to table | Medium | Toggle preserves filters |
| CE-006 | Export Cost Data | Export visible or full result | Admin/Finance/Engineer | Export permission | Format + scope | Generate file | CSV/PDF | Row/column limits enforced | Export failure notification | Medium | Exported data matches current filters |
| CE-007 | Drill-down | Open lower-level breakdown | All | Drill dimension available | Click datapoint | Query detail slice | Detail panel/page | Valid key existence | Missing key warning | High | Drill path traceable and accurate |
| CE-008 | Reset Filters | Revert to defaults | All | Filters active | Reset action | Clear filters and reload | Default dataset | Defaults predefined | If reset fails, retain prior state | Medium | One-click reset works |

## C. Cost History

| Req ID | Title | Description | Role | Preconditions | Input Data | System Behavior | Output | Validation | Error Handling | Priority | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CH-001 | Historical Trend | Visualize long-term spend trends | All | Historical data present | Time range | Build trend series | Line/area chart | Date continuity checks | Gaps marked visually | High | Correct trend rendering |
| CH-002 | Granularity View | Daily/weekly/monthly toggle | All | Aggregation engine available | Granularity selection | Re-aggregate time series | Updated chart/table | Granularity enum check | Revert to prior valid option | High | Correct bucket rollups |
| CH-003 | Previous Period Comparison | Compare with previous window | All | Prior window exists | Current period | Auto-select prior period | Comparison metric | Equal-length periods | Show “insufficient history” | Medium | Accurate previous-period delta |
| CH-004 | YoY / MoM | Year-over-year or month-over-month | All | >=13 months data for YoY | Comparison mode | Compute YoY/MoM | Growth indicators | Baseline existence required | N/A when missing baseline | Medium | Growth rates correctly computed |
| CH-005 | Growth Percentage | Show % increase/decrease | All | Baseline non-null | Current & baseline | Calculate % growth | KPI/stat | Zero-baseline rule | Display absolute delta only if needed | High | Formula correctness verified |
| CH-006 | Historical Table | Tabular historical costs | All | Time series exists | Range + filters | Render rows by period | Data table | Sort/format validation | Empty state row | Medium | Table aligns with chart |
| CH-007 | Export History Report | Export historical report | Admin/Finance/Engineer | Export permission | Format + filters | Generate report file | CSV/PDF | Header consistency | Error toast + retry | Medium | Export includes selected granularity |

## D. S3 Section

| Req ID | Title | Description | Role | Preconditions | Input Data | System Behavior | Output | Validation | Error Handling | Priority | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S3-001 | Total S3 Cost | Show total S3 spend | All | S3 billing data available | Date/filter | Aggregate S3 costs | KPI | Cost categories mapped | Unavailable state | High | Total equals source subset |
| S3-002 | Bucket-wise Cost | Show cost by bucket | All | Bucket tags/IDs ingested | Filters | Group by bucket | Ranked table/chart | Bucket ID normalization | Unknown bucket bucketized | High | Bucket ranking accurate |
| S3-003 | Storage Class Breakdown | Cost split by class | All | Class-level metrics available | Filters | Aggregate by storage class | Breakdown chart | Known class mapping | Unknown class labeled | High | Percentages sum to ~100% |
| S3-004 | Object Count | Show objects per bucket | All | Inventory metrics available | Bucket filter | Display object counts | Count table | Non-negative integer | Missing metrics noted | Medium | Counts align with inventory |
| S3-005 | Bucket Size Trend | Historical size trend | All | Time-series size data | Bucket/date | Plot bucket size history | Trend chart | Unit consistency (GB/TB) | Gaps marked | Medium | Trend reflects source data |
| S3-006 | Low-access Detection | Identify unused/low-access buckets | Admin/Engineer | Access metrics available | Threshold settings | Classify low-access buckets | Optimization list | Threshold bounds | If no access logs, mark unknown | High | Buckets classified by rule |
| S3-007 | Lifecycle Visibility | Show lifecycle policy status | All | Policy metadata available | Bucket | Fetch and display policy | Status field/details | Policy schema validation | “No policy” state | Medium | Lifecycle status shown per bucket |
| S3-008 | Public Bucket Indicator | Flag public exposure risk | Admin/Engineer/Finance(view) | Security metadata ingested | Bucket ACL/public access block | Determine public status | Risk badge | Boolean derivation rules | Unknown security state shown | High | Public buckets correctly flagged |
| S3-009 | Optimization Recommendations | Suggest cost-saving actions | Admin/Engineer | Recommendation engine/rules | Bucket metrics | Generate recommendation list | Actionable suggestions | Deduplicate suggestions | If unavailable, show rationale | Medium | Recommendations map to observed patterns |

## E. Anomalies

| Req ID | Title | Description | Role | Preconditions | Input Data | System Behavior | Output | Validation | Error Handling | Priority | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AN-001 | Detect Cost Spikes | Identify unusual spend | Admin/Finance/Engineer | Detection job active | Time-series spend | Detect outliers | Anomaly list | Sensitivity bounds valid | Detection job failure alert | High | Known test anomalies detected |
| AN-002 | Severity Display | Show severity level | All | Severity scoring configured | Anomaly score | Map score to level | Severity badge | Enum: Low/Med/High/Critical | Unknown severity fallback | High | Correct severity mapping |
| AN-003 | Impacted Dimensions | Service/account/region affected | All | Attribution data present | Anomaly record | Display impacted entities | Detail fields | Non-empty impacted key | Show “insufficient metadata” | High | Entity attribution visible |
| AN-004 | Start Date & Impact | Show onset and financial impact | All | Time & delta data present | Anomaly record | Calculate incremental impact | Date + amount | Date parsing/currency format | Null-safe fields | High | Impact amount reproducible |
| AN-005 | Anomaly Filters | Filter by severity/status/date | All | Filter UI active | Filter values | Apply filter predicates | Filtered anomaly list | Date/status validity | Invalid filter warning | Medium | Filter logic correct |
| AN-006 | Review/Resolve Workflow | Mark anomaly reviewed/resolved | Admin/Finance/Engineer | Edit permission | Status update + notes | Persist status and actor | Updated status timeline | Allowed transitions only | Conflict/version error handling | High | Status audit trail recorded |
| AN-007 | Root Cause Hints | Provide likely cause suggestions | Admin/Engineer | Correlated telemetry present | Anomaly context | Generate hint set | Root cause hints | Confidence threshold | “No confident hint” state | Medium | Hints displayed with confidence |
| AN-008 | Critical Notifications | Notify for critical anomalies | Admin/Finance/Engineer | Notification channels configured | Critical anomaly event | Trigger notifications | Email/Slack/Teams alerts | Channel config validation | Retry/backoff for failed sends | High | Alert sent within SLA |

## F. Policies

| Req ID | Title | Description | Role | Preconditions | Input Data | System Behavior | Output | Validation | Error Handling | Priority | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PO-001 | Policy List | View all governance policies | All (view), Admin/Engineer (manage) | Policy store available | Search/filter | Retrieve and render list | Policy table | Status/type enums valid | Empty list state | High | Policies displayed with metadata |
| PO-002 | Create Policy | Create new policy | Admin/Engineer | Create permission | Policy form | Validate and persist policy | Created policy record | Required fields, unique name | Form-level error messages | High | Policy saved and enabled per setting |
| PO-003 | Edit Policy | Modify existing policy | Admin/Engineer | Policy exists | Updated form fields | Versioned update | Updated policy | Immutable field protection | Conflict resolution prompt | High | Changes reflected post-save |
| PO-004 | Enable/Disable Policy | Toggle enforcement status | Admin/Engineer | Policy exists | Toggle action | Update active state | New status | Allowed state transitions | Rollback on failure | High | Status toggles without data loss |
| PO-005 | Policy Types | Support threshold/unused/public/tagging | Admin/Engineer | Type templates configured | Type + params | Apply type-specific rules | Valid policy definitions | Type-param validation | Reject invalid param set | High | Each type validates correctly |
| PO-006 | Violation List | Show policy violations | All (view), Admin/Engineer (act) | Evaluation jobs running | Filters | Retrieve violations | Violation table | Severity/status enums | If stale data, show timestamp | High | Violations align with evaluations |
| PO-007 | Severity/Status Tracking | Track violation lifecycle | Admin/Engineer | Violation exists | Status updates | Persist lifecycle | Timeline/status fields | Valid transitions only | Concurrent update guard | Medium | Status history auditable |
| PO-008 | Assign Policy Owners | Map owner to policy | Admin | User directory available | Owner selection | Save owner mapping | Owner field | Owner must be valid user/group | Invalid owner rejection | Medium | Owner displayed and notified |
| PO-009 | Policy Recommendations | Show remediation recommendations | Admin/Engineer | Rule mappings available | Violation context | Generate recommendations | Recommendation panel | Recommendation relevance check | Fallback generic guidance | Medium | Suggestions match violation type |
| PO-010 | Policy Audit Log | Log policy changes | Admin/Audit | Audit logging enabled | Any CRUD/toggle action | Write immutable audit event | Audit log entries | Actor/time/action mandatory | Log write failure alert | High | Every policy change is logged |

## G. Budgets

| Req ID | Title | Description | Role | Preconditions | Input Data | System Behavior | Output | Validation | Error Handling | Priority | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BU-001 | Create/Manage Budgets | CRUD budgets | Admin/Finance | Budget module enabled | Budget form | Validate and save budget | Budget record | Name unique in scope | Validation errors surfaced | High | Budget lifecycle works end-to-end |
| BU-002 | Budget Dimensions | Budget by account/service/project/team/tag | Admin/Finance | Dimension metadata available | Scope selections | Bind budget to scope | Scoped budget | Scope not empty | Reject invalid scope | High | Scope filter applies correctly |
| BU-003 | Budget Period | Monthly/Quarterly/Yearly | Admin/Finance | Calendar rules configured | Period selection | Configure schedule windows | Periodized budget | Period enum + date bounds | Invalid period range error | High | Budget calculations follow period |
| BU-004 | Threshold Alerts | Alert at threshold % | Admin/Finance | Notification channel set | Threshold values | Trigger on threshold crossing | Alert events | 0<%<=100 | Duplicate alert suppression | High | Alert fires once per threshold rule |
| BU-005 | Actual vs Budget Comparison | Show spend vs plan | All (view), Admin/Finance (manage) | Budget + actual data available | Date/scope | Calculate variance | Comparison chart/KPI | Currency & scope alignment | Missing actuals warning | High | Variance values accurate |
| BU-006 | Forecasted Breach | Predict likely breach | Admin/Finance | Forecast engine active | Current burn + budget limit | Estimate breach probability/date | Breach warning | Confidence threshold | “Unable to forecast” state | High | Breach prediction shown when confident |
| BU-007 | Utilization % | Show budget utilization | All | Budget amount >0 | Actual + limit | Compute utilization | Utilization KPI | Divide-by-zero protection | N/A for zero budget | High | Correct % displayed |
| BU-008 | Status Indicators | On-track/At-risk/Exceeded | All | Threshold model configured | Utilization + forecast | Determine status class | Status badge | Rule precedence defined | Unknown status fallback | Medium | Status aligns with rule set |
| BU-009 | Export Budget Report | Export budget performance | Admin/Finance | Export permission | Format/scope | Generate report | CSV/PDF | Column completeness | Export failure message | Medium | Export reflects selected filters |

---

## 6. Common Dashboard Requirements

| Req ID | Requirement | Description |
|---|---|---|
| CM-001 | Global Filters | Common filters propagate across modules where applicable |
| CM-002 | Search | Full-text/module-specific search for accounts, services, buckets, policies, budgets |
| CM-003 | Sorting | Sort tables by key fields with asc/desc |
| CM-004 | Pagination | Paginate large datasets with page size controls |
| CM-005 | Data Refresh | Manual and scheduled refresh indicators with last-updated timestamp |
| CM-006 | Export CSV/PDF | Standardized export format across modules |
| CM-007 | Responsive UI | Usable on desktop/tablet/mobile breakpoints |
| CM-008 | Empty States | Clear messages and next actions when no data |
| CM-009 | Loading States | Skeleton/spinner with non-blocking UX |
| CM-010 | Access Control | RBAC at module, action, and data-scope level |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Primary dashboards load within 3 seconds for standard filter ranges; drilldowns within 5 seconds |
| Security | SSO integration, RBAC, encryption in transit/at rest, secure secrets handling |
| Data Accuracy | Reconciliation tolerance defined; timestamps and source lineage visible |
| Scalability | Support growth in accounts, services, buckets, and historical records without major redesign |
| Availability | Target uptime 99.9% for dashboard services |
| Usability | Consistent design patterns, accessibility-ready controls, readable financial formatting |
| Auditability | Immutable logs for policy/budget/anomaly status changes and exports |

---

## 8. Data Requirements

| Domain | Required Fields |
|---|---|
| Cost Data | date, amount, currency, service, account_id, project_id, region, usage_type, tag_key, tag_value |
| Account/Project | account_id, account_name, project_id, project_name, owner, environment |
| Service | service_code, service_name, category |
| Region | region_code, region_name, geo |
| S3 Bucket | bucket_name, account_id, region, storage_class, size_gb, object_count, monthly_cost, public_flag, lifecycle_policy_status |
| Anomaly | anomaly_id, detected_at, start_date, end_date, severity, status, impacted_service, impacted_account, impacted_region, estimated_impact, root_cause_hint |
| Policy | policy_id, name, type, status, severity, owner, conditions, created_by, created_at, updated_at |
| Budget | budget_id, name, scope_type, scope_value, period_type, amount, currency, thresholds, actual_spend, forecast_spend, utilization_pct, status |

---

## 9. Integrations

1. AWS Cost Explorer for cost/usage data.
2. AWS S3 APIs and inventory/metrics for bucket analytics.
3. AWS Budgets for threshold and budget references.
4. AWS CloudWatch for telemetry and anomaly correlations.
5. AWS Organizations for account hierarchy and metadata.
6. Internal Authentication (SSO/IdP) for user identity and roles.
7. Notification integrations: Email, Slack, Microsoft Teams.

---

## 10. User Workflows

1. Viewing Cost Overview: Login -> apply global filters -> review KPI cards/trends -> navigate to detail module.
2. Exploring Cost by Service: Open Cost Explorer -> select date/service/grouping -> compare period -> drill down -> export.
3. Reviewing S3 Cost: Open S3 section -> inspect bucket ranking/storage class -> review low-access/public buckets -> view recommendations.
4. Investigating Anomaly: Open Anomalies -> filter critical/high -> inspect impact and root-cause hints -> mark reviewed/resolved -> notify team.
5. Creating Policy: Open Policies -> create policy type/conditions/severity/owner -> enable policy -> monitor violations.
6. Creating Budget: Open Budgets -> define scope/period/amount/thresholds -> save -> monitor utilization and breach forecast.
7. Exporting Report: Select module + filters -> choose CSV/PDF -> generate/download -> share with stakeholders.

---

## 11. Module-Level Acceptance Criteria

| Module | Acceptance Criteria |
|---|---|
| Overview | All KPI cards load with applied filters; navigation preserves context; trend calculations match source data |
| Cost Explorer | Interactive filters/grouping/drilldowns function consistently; comparison and exports are accurate |
| Cost History | Trend and granularity views are accurate; YoY/MoM handles missing baselines gracefully |
| S3 | Bucket/class/cost metrics reconcile with source; risk and optimization indicators display correctly |
| Anomalies | Detection, severity, filtering, and resolution workflow work end-to-end; critical notifications fire |
| Policies | Policy CRUD/toggle/types/violations/audit log work with RBAC controls |
| Budgets | Budget CRUD, thresholds, utilization, status, and forecast breach views are accurate and exportable |

---

## 12. Edge Cases

1. No cost data available for selected filters.
2. Upstream API failure/timeouts.
3. Permission denied for module/action.
4. Invalid filter combinations (e.g., incompatible tag + account).
5. Budget exceeded before period midpoint.
6. Missing/untagged resources affecting grouped analysis.
7. Deleted S3 bucket visible in historical records.
8. Anomaly record with incomplete metadata.
9. Currency mismatch across aggregated records.
10. Delayed ingestion causing temporary discrepancies.

---

## 13. Reporting Requirements

| Requirement | Details |
|---|---|
| Downloadable Reports | On-demand CSV/PDF from all major modules |
| Scheduled Reports | Daily/weekly/monthly recurring reports to configured recipients |
| Filtered Reports | Respect active filters, grouping, and date range |
| Format Requirements | Standard headers, generated timestamp, applied filter summary, currency, totals, and pagination for PDF |

---

## 14. Open Questions

1. What is the approved reconciliation tolerance between dashboard and billing source?
2. Should forecasts be rule-based, ML-based, or hybrid?
3. What is the exact SLA for anomaly detection latency?
4. Are policy violations purely advisory or can they trigger enforcement workflows externally?
5. What retention period is required for historical cost and audit logs?
6. Should read-only users be allowed exports?
7. Is multi-currency reporting required beyond base currency?
8. Should budget thresholds support cumulative and per-period reset semantics?

---

## 15. Appendix: Glossary

| Term | Definition |
|---|---|
| MTD | Month-to-date spending from first day of current month to current date |
| Forecast | Predicted future cost based on current/historical trends |
| Anomaly | Unusual deviation/spike in cost behavior |
| Policy | Governance rule for cost/security/compliance checks |
| Budget | Planned spending limit for defined scope and period |
| Storage Class | S3 data tier (e.g., Standard, IA, Glacier) with distinct pricing |
| Tag | Key-value metadata used for cost allocation/grouping |
| Account | Cloud account under an organization |
| Region | Cloud geographic deployment location |
