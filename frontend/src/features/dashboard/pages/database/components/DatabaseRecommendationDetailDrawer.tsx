import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DatabaseRecommendationDetail } from "../../../api/dashboardTypes";
import {
  confidenceLabel,
  evidenceLabel,
  formatCurrency,
  formatDate,
  formatPercent,
  recommendationTypeLabel,
  statusLabel,
} from "./db-recommendations.formatters";

type DatabaseRecommendationDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: DatabaseRecommendationDetail | null;
  selectedId: string | null;
  isLoading: boolean;
  isError: boolean;
};

const textOrDash = (value: unknown): string => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "-";
};

const numberOrNotAvailable = (value: unknown): string => {
  if (value === null || typeof value === "undefined") return "Not available";
  const num = Number(value);
  return Number.isFinite(num) ? formatCurrency(num) : "Not available";
};

const severityTone = (severity: string): string => {
  const normalized = severity.toLowerCase();
  if (normalized === "critical") return "#b91c1c";
  if (normalized === "warning") return "#b45309";
  return "#334155";
};

const badgeTone = (value: string): string => {
  const normalized = value.toLowerCase();
  if (normalized === "high" || normalized === "telemetry backed" || normalized === "open" || normalized === "in progress") return "#0f766e";
  if (normalized === "medium" || normalized === "inventory backed" || normalized === "snoozed") return "#334155";
  if (normalized === "low" || normalized === "billing only" || normalized === "dismissed" || normalized === "completed") return "#475569";
  return "#334155";
};

type DrawerSectionKey =
  | "cost_breakdown"
  | "savings_assumptions"
  | "signals_used"
  | "data_quality_warnings"
  | "rule_context"
  | "resource_lineage"
  | "signals_missing";

const DEFAULT_SECTION_ORDER: DrawerSectionKey[] = [
  "resource_lineage",
  "signals_used",
  "signals_missing",
  "cost_breakdown",
  "savings_assumptions",
  "data_quality_warnings",
  "rule_context",
];

const DRAWER_SECTION_PRIORITY_BY_TYPE: Record<string, DrawerSectionKey[]> = {
  DB_STORAGE_OPTIMIZATION: [
    "cost_breakdown",
    "savings_assumptions",
    "signals_used",
    "data_quality_warnings",
    "rule_context",
    "resource_lineage",
    "signals_missing",
  ],
  DB_IDLE_CANDIDATE: [
    "signals_used",
    "signals_missing",
    "data_quality_warnings",
    "cost_breakdown",
    "savings_assumptions",
    "rule_context",
    "resource_lineage",
  ],
  DB_HA_COST_OPTIMIZATION: [
    "rule_context",
    "resource_lineage",
    "signals_used",
    "signals_missing",
    "data_quality_warnings",
    "cost_breakdown",
    "savings_assumptions",
  ],
  DB_ENGINE_DEPLOYMENT_OPTIMIZATION: [
    "signals_used",
    "signals_missing",
    "rule_context",
    "data_quality_warnings",
    "resource_lineage",
    "cost_breakdown",
    "savings_assumptions",
  ],
};

const FAMILY_CONTEXT_LABEL_BY_TYPE: Record<string, string> = {
  DB_STORAGE_OPTIMIZATION: "Storage spend review",
  DB_IDLE_CANDIDATE: "Low-activity review",
  DB_HA_COST_OPTIMIZATION: "HA cost posture review",
  DB_ENGINE_DEPLOYMENT_OPTIMIZATION: "Engine/deployment fit review",
};

export function DatabaseRecommendationDetailDrawer({
  open,
  onOpenChange,
  detail,
  selectedId,
  isLoading,
  isError,
}: DatabaseRecommendationDetailDrawerProps) {
  const lineage = detail?.metadata_json?.lineage;
  const ruleContext = detail?.metadata_json?.rule_context;
  const generatedBy = detail?.metadata_json?.generated_by;
  const generatedAt = detail?.metadata_json?.generated_at;
  const savingsAssumptions = detail?.evidence?.savings_assumptions ?? {};
  const costBreakdown = detail?.evidence?.cost_breakdown ?? {};
  const signalsUsed = Array.isArray(detail?.evidence?.signals_used) ? detail?.evidence?.signals_used : [];
  const signalsMissing = Array.isArray(detail?.evidence?.signals_missing) ? detail?.evidence?.signals_missing : [];
  const warnings = Array.isArray(detail?.evidence?.data_quality_warnings) ? detail?.evidence?.data_quality_warnings : [];
  const sourceTables = Array.isArray(detail?.evidence?.source_tables) ? detail?.evidence?.source_tables : [];
  const recommendationType = String(detail?.recommendation_type ?? "").trim();
  const sectionOrder = DRAWER_SECTION_PRIORITY_BY_TYPE[recommendationType] ?? DEFAULT_SECTION_ORDER;
  const familyContextLabel = FAMILY_CONTEXT_LABEL_BY_TYPE[recommendationType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-[min(96vw,44rem)] max-w-none -translate-x-0 -translate-y-0 overflow-y-auto rounded-none border-l border-[color:var(--border-light)] p-6 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
        <DialogHeader>
          <DialogTitle>{detail?.title || "Recommendation detail"}</DialogTitle>
          <DialogDescription>
            Evidence-driven view of recommendation signals and cost basis
            {familyContextLabel ? ` • ${familyContextLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? <p className="dashboard-note">Loading recommendation detail...</p> : null}
        {isError ? <p className="dashboard-note">Unable to load recommendation detail.</p> : null}
        {!isLoading && !isError && !detail ? (
          <p className="dashboard-note">
            No detail found for recommendation {selectedId || "-"}.
          </p>
        ) : null}

        {!isLoading && !isError && detail ? (
          <div className="space-y-5">
            <section className="dashboard-table-shell">
              <div className="dashboard-table-shell__body space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="cost-explorer-chip">{recommendationTypeLabel(detail.recommendation_type)}</span>
                  <span className="cost-explorer-chip" style={{ color: badgeTone(statusLabel(detail.status)) }}>{statusLabel(detail.status)}</span>
                  <span className="cost-explorer-chip" style={{ color: badgeTone(confidenceLabel(detail.confidence)) }}>{confidenceLabel(detail.confidence)}</span>
                  <span className="cost-explorer-chip" style={{ color: badgeTone(evidenceLabel(detail.evidence_level)) }}>{evidenceLabel(detail.evidence_level)}</span>
                </div>
                <p className="text-sm text-[rgba(75,90,83,0.9)]">Updated {formatDate(detail.updated_at)}</p>
              </div>
            </section>

            <section className="dashboard-table-shell">
              <header className="dashboard-table-shell__header"><h3 className="dashboard-table-shell__title">Recommendation Summary</h3></header>
              <div className="dashboard-table-shell__body space-y-3">
                <p>{detail.description || "No summary available."}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <p><strong>Estimated savings:</strong> {detail.estimated_monthly_savings == null ? "Not estimated" : formatCurrency(detail.estimated_monthly_savings)}</p>
                  <p><strong>Savings basis:</strong> {textOrDash(detail.savings_basis || savingsAssumptions.basis)}</p>
                </div>
                {detail.estimated_monthly_savings == null ? (
                  <p className="dashboard-note">Savings not estimated. Review evidence and assumptions for confidence context.</p>
                ) : null}
              </div>
            </section>

            {sectionOrder.map((sectionKey) => {
              if (sectionKey === "resource_lineage") {
                return (
                  <section key={sectionKey} className="dashboard-table-shell">
                    <header className="dashboard-table-shell__header"><h3 className="dashboard-table-shell__title">Resource / Lineage</h3></header>
                    <div className="dashboard-table-shell__body grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <p><strong>Resource ID:</strong> {textOrDash(detail.resource_id)}</p>
                      <p><strong>Cloud Connection:</strong> {textOrDash(detail.cloud_connection_id || lineage?.cloud_connection_id)}</p>
                      <p><strong>Tenant:</strong> {textOrDash(lineage?.tenant_id)}</p>
                      <p><strong>Provider:</strong> {textOrDash(lineage?.provider)}</p>
                      <p><strong>Service:</strong> {textOrDash(lineage?.service)}</p>
                      <p><strong>Resource Type:</strong> {textOrDash(lineage?.resource_type)}</p>
                      <p><strong>Region:</strong> {textOrDash(lineage?.region)}</p>
                      <p><strong>Account ID:</strong> {textOrDash(lineage?.account_id)}</p>
                      <p className="sm:col-span-2"><strong>Source tables:</strong> {sourceTables.length > 0 ? sourceTables.join(", ") : "Not available"}</p>
                    </div>
                  </section>
                );
              }

              if (sectionKey === "signals_used") {
                return (
                  <section key={sectionKey} className="dashboard-table-shell">
                    <header className="dashboard-table-shell__header"><h3 className="dashboard-table-shell__title">Evidence: Signals Used</h3></header>
                    <div className="dashboard-table-shell__body">
                      {signalsUsed.length === 0 ? <p className="dashboard-note">No evidence signals were provided.</p> : (
                        <div className="space-y-2">
                          {signalsUsed.map((signal, index) => (
                            <div key={`${signal.key}-${index}`} className="rounded-md border border-[color:var(--border-light)] p-2">
                              <p><strong>{textOrDash(signal.label)}</strong></p>
                              <p>Value: {textOrDash(typeof signal.value === "object" ? JSON.stringify(signal.value) : signal.value)}</p>
                              <p>Source: {textOrDash(signal.source)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionKey === "signals_missing") {
                return (
                  <section key={sectionKey} className="dashboard-table-shell">
                    <header className="dashboard-table-shell__header"><h3 className="dashboard-table-shell__title">Signals Missing</h3></header>
                    <div className="dashboard-table-shell__body">
                      {signalsMissing.length === 0 ? <p className="dashboard-note">No missing signals were reported.</p> : (
                        <ul className="space-y-2">
                          {signalsMissing.map((signal, index) => (
                            <li key={`${signal.key}-${index}`} className="rounded-md border border-[color:var(--border-light)] p-2">
                              <strong>{textOrDash(signal.label)}</strong>: {textOrDash(signal.reason)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionKey === "cost_breakdown") {
                return (
                  <section key={sectionKey} className="dashboard-table-shell">
                    <header className="dashboard-table-shell__header"><h3 className="dashboard-table-shell__title">Cost Breakdown</h3></header>
                    <div className="dashboard-table-shell__body grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <p><strong>Total cost:</strong> {numberOrNotAvailable(costBreakdown.total_cost)}</p>
                      <p><strong>Compute cost:</strong> {numberOrNotAvailable(costBreakdown.compute_cost)}</p>
                      <p><strong>Storage cost:</strong> {numberOrNotAvailable(costBreakdown.storage_cost)}</p>
                      <p><strong>Backup cost:</strong> {numberOrNotAvailable(costBreakdown.backup_cost)}</p>
                      <p><strong>IO cost:</strong> {numberOrNotAvailable(costBreakdown.io_cost)}</p>
                      <p><strong>Other cost:</strong> {numberOrNotAvailable(costBreakdown.other_cost)}</p>
                      <p><strong>Currency:</strong> {textOrDash(costBreakdown.currency)}</p>
                      <p><strong>Lookback days:</strong> {textOrDash(costBreakdown.lookback_days)}</p>
                    </div>
                  </section>
                );
              }

              if (sectionKey === "savings_assumptions") {
                return (
                  <section key={sectionKey} className="dashboard-table-shell">
                    <header className="dashboard-table-shell__header"><h3 className="dashboard-table-shell__title">Savings Assumptions</h3></header>
                    <div className="dashboard-table-shell__body space-y-2">
                      <p><strong>Estimated monthly savings:</strong> {savingsAssumptions.estimated_monthly_savings == null ? "Savings not estimated" : formatCurrency(savingsAssumptions.estimated_monthly_savings)}</p>
                      <p><strong>Estimated savings percent:</strong> {formatPercent(savingsAssumptions.estimated_savings_percent)}</p>
                      <p><strong>Basis:</strong> {textOrDash(savingsAssumptions.basis)}</p>
                      <div>
                        <strong>Calculation notes:</strong>
                        {Array.isArray(savingsAssumptions.calculation_notes) && savingsAssumptions.calculation_notes.length > 0 ? (
                          <ul className="mt-1 list-disc pl-5">
                            {savingsAssumptions.calculation_notes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}
                          </ul>
                        ) : (
                          <p className="dashboard-note">No calculation notes provided.</p>
                        )}
                      </div>
                    </div>
                  </section>
                );
              }

              if (sectionKey === "data_quality_warnings") {
                return (
                  <section key={sectionKey} className="dashboard-table-shell">
                    <header className="dashboard-table-shell__header"><h3 className="dashboard-table-shell__title">Data Quality Warnings</h3></header>
                    <div className="dashboard-table-shell__body">
                      {warnings.length === 0 ? <p className="dashboard-note">No data quality warnings.</p> : (
                        <ul className="space-y-2">
                          {warnings.map((warning, index) => (
                            <li key={`${warning.code}-${index}`} className="rounded-md border border-[color:var(--border-light)] p-2">
                              <span className="cost-explorer-chip" style={{ color: severityTone(warning.severity) }}>{statusLabel(warning.severity)}</span>
                              <p><strong>{textOrDash(warning.code)}</strong>: {textOrDash(warning.message)}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                );
              }

              if (sectionKey === "rule_context") {
                return (
                  <section key={sectionKey} className="dashboard-table-shell">
                    <header className="dashboard-table-shell__header"><h3 className="dashboard-table-shell__title">Rule Context</h3></header>
                    <div className="dashboard-table-shell__body grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <p><strong>Rule ID:</strong> {textOrDash(ruleContext?.rule_id)}</p>
                      <p><strong>Rule version:</strong> {textOrDash(ruleContext?.rule_version)}</p>
                      <p><strong>Lookback start:</strong> {textOrDash(ruleContext?.lookback_start)}</p>
                      <p><strong>Lookback end:</strong> {textOrDash(ruleContext?.lookback_end)}</p>
                      <p><strong>Generated by:</strong> {textOrDash(generatedBy)}</p>
                      <p><strong>Generated at:</strong> {textOrDash(generatedAt)}</p>
                      <p><strong>Created at:</strong> {textOrDash(detail.created_at)}</p>
                      <p><strong>Updated at:</strong> {textOrDash(detail.updated_at)}</p>
                    </div>
                  </section>
                );
              }

              return null;
            })}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
