import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApplyS3LifecyclePolicyMutation, useS3OptimizationQuery } from "../../hooks/useDashboardQueries";

type TransitionState = {
  enabled: boolean;
  days: number;
  storageClass: "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE";
  label: string;
};

const normalizePrefix = (value: string): string => value.trim().replace(/^\/+/, "");

export default function S3PolicyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const s3BucketsQuery = useS3OptimizationQuery();
  const applyMutation = useApplyS3LifecyclePolicyMutation();

  const initialBucket = useMemo(() => {
    const search = new URLSearchParams(location.search);
    return String(search.get("bucketName") ?? "").trim();
  }, [location.search]);

  const [bucketName, setBucketName] = useState(initialBucket);
  const [ruleName, setRuleName] = useState("CustomRule1");
  const [status, setStatus] = useState<"Enabled" | "Disabled">("Enabled");
  const [scopeType, setScopeType] = useState<"entire_bucket" | "prefix">("entire_bucket");
  const [prefix, setPrefix] = useState("logs/");
  const [transitions, setTransitions] = useState<TransitionState[]>([
    { enabled: true, days: 30, storageClass: "STANDARD_IA", label: "Standard-IA" },
    { enabled: true, days: 90, storageClass: "GLACIER", label: "Glacier" },
    { enabled: false, days: 180, storageClass: "DEEP_ARCHIVE", label: "Deep Archive" },
  ]);
  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expirationDays, setExpirationDays] = useState(365);
  const [abortEnabled, setAbortEnabled] = useState(true);
  const [abortDays, setAbortDays] = useState(7);

  const bucketOptions = useMemo(
    () =>
      Array.from(new Set((s3BucketsQuery.data?.buckets ?? []).map((item) => String(item.bucketName ?? "").trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [s3BucketsQuery.data?.buckets],
  );

  const enabledTransitions = useMemo(
    () => transitions.filter((item) => item.enabled).map((item) => ({ days: item.days, storageClass: item.storageClass })),
    [transitions],
  );

  const validations = useMemo(() => {
    const errors: string[] = [];
    if (!bucketName.trim()) errors.push("Bucket name is required.");
    if (!ruleName.trim()) errors.push("Rule name is required.");
    if (scopeType === "prefix" && !normalizePrefix(prefix)) errors.push("Prefix is required when scope is Prefix.");

    const daysList = enabledTransitions.map((item) => Number(item.days)).sort((a, b) => a - b);
    const hasDuplicateStorage = new Set(enabledTransitions.map((item) => item.storageClass)).size !== enabledTransitions.length;
    if (hasDuplicateStorage) errors.push("Duplicate transitions are not allowed.");
    if (daysList.some((value) => !Number.isFinite(value) || value <= 0)) errors.push("Transition days must be positive numbers.");
    for (let idx = 1; idx < daysList.length; idx += 1) {
      if (daysList[idx] <= daysList[idx - 1]) {
        errors.push("Transition days must be strictly increasing.");
        break;
      }
    }
    if (expirationEnabled && (!Number.isFinite(expirationDays) || expirationDays <= 0)) {
      errors.push("Expiration days must be a positive number.");
    }
    if (expirationEnabled && daysList.length > 0 && expirationDays <= daysList[daysList.length - 1]) {
      errors.push("Expiration days must be greater than transition days.");
    }
    if (abortEnabled && (!Number.isFinite(abortDays) || abortDays <= 0)) {
      errors.push("Abort incomplete multipart upload days must be a positive number.");
    }
    return errors;
  }, [abortDays, abortEnabled, bucketName, enabledTransitions, expirationDays, expirationEnabled, prefix, ruleName, scopeType]);

  const previewPayload = useMemo(
    () => ({
      bucketName: bucketName.trim(),
      ruleName: ruleName.trim(),
      status,
      scope: scopeType === "prefix" ? { type: "prefix" as const, prefix: normalizePrefix(prefix) } : { type: "entire_bucket" as const },
      transitions: enabledTransitions,
      ...(expirationEnabled ? { expirationDays } : {}),
      ...(abortEnabled ? { abortIncompleteMultipartUploadDays: abortDays } : {}),
    }),
    [abortDays, abortEnabled, bucketName, enabledTransitions, expirationDays, expirationEnabled, prefix, ruleName, scopeType, status],
  );

  const handleApply = async () => {
    if (validations.length > 0) return;
    await applyMutation.mutateAsync(previewPayload);
  };

  return (
    <div className="dashboard-page s3-policy-page">
      <div className="s3-policy-shell">
        <header className="s3-policy-header">
          <div>
            <p className="s3-policy-eyebrow">Lifecycle Wizard</p>
            <h2>S3 Lifecycle Policy Setup</h2>
            <p className="s3-policy-subtitle">Choose a bucket, define retention behavior, preview, and apply in one flow.</p>
          </div>
          <button type="button" className="s3-policy-back-btn" onClick={() => navigate({ pathname: "/dashboard/policy", search: location.search })}>
            Back
          </button>
        </header>

        <div className="s3-policy-layout">
          <section className="s3-policy-form-card">
            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row">
                <span className="s3-policy-step__index">1</span>
                <h3>Rule Info</h3>
              </div>
              <div className="s3-policy-grid2">
                <label className="s3-policy-field">
                  <span>Bucket</span>
                  <select value={bucketName} onChange={(e) => setBucketName(e.target.value)}>
                    <option value="">Select bucket</option>
                    {bucketOptions.map((bucket) => (
                      <option key={bucket} value={bucket}>
                        {bucket}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="s3-policy-field">
                  <span>Rule Name</span>
                  <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="logs-retention-rule" />
                </label>
              </div>
              <div className="s3-policy-segment">
                <button type="button" className={status === "Enabled" ? "is-active" : ""} onClick={() => setStatus("Enabled")}>
                  Enabled
                </button>
                <button type="button" className={status === "Disabled" ? "is-active" : ""} onClick={() => setStatus("Disabled")}>
                  Disabled
                </button>
              </div>
            </article>

            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row">
                <span className="s3-policy-step__index">2</span>
                <h3>Scope</h3>
              </div>
              <div className="s3-policy-radio-row">
                <label>
                  <input type="radio" checked={scopeType === "entire_bucket"} onChange={() => setScopeType("entire_bucket")} />
                  Entire bucket
                </label>
                <label>
                  <input type="radio" checked={scopeType === "prefix"} onChange={() => setScopeType("prefix")} />
                  Prefix
                </label>
              </div>
              {scopeType === "prefix" ? (
                <label className="s3-policy-field">
                  <span>Prefix Path</span>
                  <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="logs/" />
                </label>
              ) : null}
            </article>

            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row">
                <span className="s3-policy-step__index">3</span>
                <h3>Transitions</h3>
              </div>
              <div className="s3-policy-transition-list">
                {transitions.map((item, idx) => (
                  <label key={item.storageClass} className="s3-policy-transition">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) =>
                        setTransitions((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, enabled: e.target.checked } : row)))
                      }
                    />
                    <span className="s3-policy-transition__label">{item.label}</span>
                    <input
                      className="s3-policy-days-input"
                      type="number"
                      min={1}
                      value={item.days}
                      onChange={(e) =>
                        setTransitions((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, days: Number(e.target.value) } : row)))
                      }
                    />
                    <span className="s3-policy-muted">days</span>
                  </label>
                ))}
              </div>
            </article>

            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row">
                <span className="s3-policy-step__index">4</span>
                <h3>Expiration & Cleanup</h3>
              </div>
              <label className="s3-policy-inline-toggle">
                <input type="checkbox" checked={expirationEnabled} onChange={(e) => setExpirationEnabled(e.target.checked)} />
                <span>Delete objects after</span>
                <input className="s3-policy-days-input" type="number" min={1} value={expirationDays} onChange={(e) => setExpirationDays(Number(e.target.value))} />
                <span className="s3-policy-muted">days</span>
              </label>
              {expirationEnabled ? <p className="s3-policy-warning">Warning: This will permanently delete data.</p> : null}

              <label className="s3-policy-inline-toggle">
                <input type="checkbox" checked={abortEnabled} onChange={(e) => setAbortEnabled(e.target.checked)} />
                <span>Abort incomplete multipart uploads after</span>
                <input className="s3-policy-days-input" type="number" min={1} value={abortDays} onChange={(e) => setAbortDays(Number(e.target.value))} />
                <span className="s3-policy-muted">days</span>
              </label>
            </article>
          </section>

          <aside className="s3-policy-preview-card">
            <div className="s3-policy-step__title-row">
              <span className="s3-policy-step__index">5</span>
              <h3>Preview & Apply</h3>
            </div>
            <p className="s3-policy-subtitle">Review payload before creating policy in AWS.</p>
            <pre>{JSON.stringify(previewPayload, null, 2)}</pre>

            {validations.length > 0 ? (
              <div className="s3-policy-errors">
                {validations.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}
            {applyMutation.isError ? <p className="s3-policy-errors">Failed to apply lifecycle policy: {applyMutation.error.message}</p> : null}
            {applyMutation.isSuccess ? (
              <p className="s3-policy-success">Lifecycle policy applied to {applyMutation.data.bucketName} ({applyMutation.data.region}).</p>
            ) : null}

            <div className="s3-policy-action-row">
              <button type="button" className="s3-policy-cancel-btn" onClick={() => navigate({ pathname: "/dashboard/policy", search: location.search })}>
                Cancel
              </button>
              <button type="button" className="s3-policy-apply-btn" onClick={handleApply} disabled={validations.length > 0 || applyMutation.isPending}>
                {applyMutation.isPending ? "Applying..." : "Apply Policy"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
