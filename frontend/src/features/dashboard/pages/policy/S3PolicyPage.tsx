import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApplyS3LifecyclePolicyMutation, useS3BucketLifecycleInsightQuery, useS3OptimizationQuery } from "../../hooks/useDashboardQueries";

type StorageClass = "STANDARD_IA" | "GLACIER" | "DEEP_ARCHIVE" | "INTELLIGENT_TIERING";
type TransitionState = { enabled: boolean; days: number; storageClass: StorageClass; label: string };

const normalizePrefix = (value: string): string => value.trim().replace(/^\/+/, "");
const MIN_TRANSITION_DAYS: Record<StorageClass, number> = {
  STANDARD_IA: 30,
  GLACIER: 1,
  DEEP_ARCHIVE: 1,
  INTELLIGENT_TIERING: 1,
};

type PolicyTemplateKey = "safe" | "logs" | "temp" | "version" | "backup";

export default function S3PolicyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const s3BucketsQuery = useS3OptimizationQuery();
  const applyMutation = useApplyS3LifecyclePolicyMutation();

  const requestedBucketFromQuery = useMemo(() => {
    const search = new URLSearchParams(location.search);
    return String(search.get("bucketName") ?? "").trim();
  }, [location.search]);
  const requestedRuleFromQuery = useMemo(() => {
    const search = new URLSearchParams(location.search);
    return String(search.get("ruleName") ?? "").trim();
  }, [location.search]);

  const [bucketName, setBucketName] = useState(requestedBucketFromQuery || "");
  const [ruleName, setRuleName] = useState(requestedRuleFromQuery || "safe-cost-optimization");
  const [status, setStatus] = useState<"Enabled" | "Disabled">("Enabled");
  const [scopeType, setScopeType] = useState<"entire_bucket" | "prefix">("entire_bucket");
  const [prefix, setPrefix] = useState("logs/");
  const [minObjectSizeKb, setMinObjectSizeKb] = useState(128);
  const [useMinObjectSize, setUseMinObjectSize] = useState(false);

  const [transitions, setTransitions] = useState<TransitionState[]>([
    { enabled: false, days: 30, storageClass: "STANDARD_IA", label: "Standard-IA" },
    { enabled: false, days: 90, storageClass: "GLACIER", label: "Glacier" },
    { enabled: false, days: 180, storageClass: "DEEP_ARCHIVE", label: "Deep Archive" },
    { enabled: true, days: 30, storageClass: "INTELLIGENT_TIERING", label: "Intelligent-Tiering" },
  ]);

  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [expirationDays, setExpirationDays] = useState(365);

  const [abortEnabled, setAbortEnabled] = useState(true);
  const [abortDays, setAbortDays] = useState(7);

  const [versioningCleanupEnabled, setVersioningCleanupEnabled] = useState(false);
  const [noncurrentTransitions, setNoncurrentTransitions] = useState<TransitionState[]>([
    { enabled: false, days: 30, storageClass: "GLACIER", label: "Noncurrent to Glacier" },
    { enabled: false, days: 90, storageClass: "DEEP_ARCHIVE", label: "Noncurrent to Deep Archive" },
  ]);
  const [noncurrentExpirationEnabled, setNoncurrentExpirationEnabled] = useState(false);
  const [noncurrentExpirationDays, setNoncurrentExpirationDays] = useState(180);
  const [expiredDeleteMarkerEnabled, setExpiredDeleteMarkerEnabled] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<PolicyTemplateKey | null>("safe");
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const lifecycleInsightQuery = useS3BucketLifecycleInsightQuery(bucketName || null);

  const bucketOptions = useMemo(
    () =>
      Array.from(new Set((s3BucketsQuery.data?.buckets ?? []).map((item) => String(item.bucketName ?? "").trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [s3BucketsQuery.data?.buckets],
  );

  useEffect(() => {
    if (requestedBucketFromQuery) setBucketName(requestedBucketFromQuery);
  }, [requestedBucketFromQuery]);

  useEffect(() => {
    if (requestedRuleFromQuery) setRuleName(requestedRuleFromQuery);
  }, [requestedRuleFromQuery]);

  const enabledTransitions = useMemo(
    () => transitions.filter((item) => item.enabled).map((item) => ({ days: item.days, storageClass: item.storageClass })),
    [transitions],
  );
  const enabledNoncurrentTransitions = useMemo(
    () => noncurrentTransitions.filter((item) => item.enabled).map((item) => ({ days: item.days, storageClass: item.storageClass })),
    [noncurrentTransitions],
  );

  const applyTemplate = (key: PolicyTemplateKey) => {
    const finishTemplateLoad = () => window.setTimeout(() => setIsTemplateLoading(false), 260);
    setIsTemplateLoading(true);
    setActiveTemplate(key);
    if (key === "safe") {
      setRuleName("safe-cost-optimization");
      setScopeType("entire_bucket");
      setTransitions((prev) => prev.map((t) => ({
        ...t,
        enabled: t.storageClass === "INTELLIGENT_TIERING",
        days: t.storageClass === "INTELLIGENT_TIERING" ? 30 : t.days,
      })));
      setAbortEnabled(true);
      setAbortDays(7);
      setExpirationEnabled(false);
      setVersioningCleanupEnabled(false);
      finishTemplateLoad();
      return;
    }
    if (key === "logs") {
      setRuleName("logs-cleanup");
      setScopeType("prefix");
      setPrefix("logs/");
      setTransitions((prev) => prev.map((t) => ({
        ...t,
        enabled: t.storageClass === "STANDARD_IA" || t.storageClass === "GLACIER",
        days: t.storageClass === "STANDARD_IA" ? 30 : t.storageClass === "GLACIER" ? 90 : t.days,
      })));
      setAbortEnabled(true);
      setAbortDays(7);
      setExpirationEnabled(true);
      setExpirationDays(365);
      finishTemplateLoad();
      return;
    }
    if (key === "temp") {
      setRuleName("temp-cleanup");
      setScopeType("prefix");
      setPrefix("tmp/");
      setTransitions((prev) => prev.map((t) => ({ ...t, enabled: false })));
      setExpirationEnabled(true);
      setExpirationDays(30);
      setAbortEnabled(true);
      setAbortDays(7);
      finishTemplateLoad();
      return;
    }
    if (key === "version") {
      setRuleName("version-cleanup");
      setVersioningCleanupEnabled(true);
      setNoncurrentTransitions((prev) => prev.map((t) => ({ ...t, enabled: false })));
      setNoncurrentExpirationEnabled(true);
      setNoncurrentExpirationDays(180);
      setExpiredDeleteMarkerEnabled(true);
      finishTemplateLoad();
      return;
    }
    setRuleName("backup-archive");
    setScopeType("prefix");
    setPrefix("backups/");
    setTransitions((prev) => prev.map((t) => ({
      ...t,
      enabled: t.storageClass === "GLACIER" || t.storageClass === "DEEP_ARCHIVE",
      days: t.storageClass === "GLACIER" ? 90 : t.storageClass === "DEEP_ARCHIVE" ? 365 : t.days,
    })));
    setAbortEnabled(true);
    setAbortDays(7);
    setExpirationEnabled(true);
    setExpirationDays(365 * 7);
    finishTemplateLoad();
  };

  useEffect(() => {
    const suggested = lifecycleInsightQuery.data?.insight?.templateRecommendation;
    if (!suggested?.templateKey) return;
    if (activeTemplate === suggested.templateKey) return;
    applyTemplate(suggested.templateKey);
    if (suggested.suggestedPrefix && suggested.templateKey !== "safe" && suggested.templateKey !== "version") {
      setPrefix(suggested.suggestedPrefix);
    }
  }, [activeTemplate, lifecycleInsightQuery.data?.insight?.templateRecommendation]);

  const validations = useMemo(() => {
    const errors: string[] = [];
    if (!bucketName.trim()) errors.push("Bucket name is required.");
    if (!ruleName.trim()) errors.push("Rule name is required.");
    if (scopeType === "prefix" && !normalizePrefix(prefix)) errors.push("Prefix is required when scope is Prefix.");
    if (useMinObjectSize && (!Number.isFinite(minObjectSizeKb) || minObjectSizeKb < 0)) errors.push("Minimum object size must be >= 0 KB.");

    const daysList = enabledTransitions.map((item) => Number(item.days)).sort((a, b) => a - b);
    const hasDuplicateStorage = new Set(enabledTransitions.map((item) => item.storageClass)).size !== enabledTransitions.length;
    if (hasDuplicateStorage) errors.push("Duplicate transitions are not allowed.");
    if (daysList.some((value) => !Number.isFinite(value) || value <= 0)) errors.push("Transition days must be positive numbers.");
    for (const transition of enabledTransitions) {
      const minDays = MIN_TRANSITION_DAYS[transition.storageClass];
      if (Number(transition.days) < minDays) errors.push(`${transition.storageClass} transition must be at least ${minDays} days.`);
    }
    for (let idx = 1; idx < daysList.length; idx += 1) {
      if (daysList[idx] <= daysList[idx - 1]) {
        errors.push("Two selected transitions cannot have the same day. Please keep each selected transition day unique and increasing.");
      }
    }

    if (expirationEnabled && (!Number.isFinite(expirationDays) || expirationDays <= 0)) errors.push("Expiration days must be a positive number.");
    if (expirationEnabled && daysList.length > 0 && expirationDays <= daysList[daysList.length - 1]) {
      errors.push("Expiration days must be greater than transition days.");
    }
    if (abortEnabled && (!Number.isFinite(abortDays) || abortDays <= 0)) errors.push("Abort incomplete multipart upload days must be a positive number.");

    const noncurrentDaysList = enabledNoncurrentTransitions.map((item) => Number(item.days)).sort((a, b) => a - b);
    if (versioningCleanupEnabled) {
      if (noncurrentDaysList.some((value) => !Number.isFinite(value) || value <= 0)) errors.push("Noncurrent transition days must be positive numbers.");
      for (let idx = 1; idx < noncurrentDaysList.length; idx += 1) {
        if (noncurrentDaysList[idx] <= noncurrentDaysList[idx - 1]) errors.push("Noncurrent transition days must be strictly increasing.");
      }
      if (noncurrentExpirationEnabled && (!Number.isFinite(noncurrentExpirationDays) || noncurrentExpirationDays <= 0)) {
        errors.push("Noncurrent expiration days must be a positive number.");
      }
      if (noncurrentExpirationEnabled && noncurrentDaysList.length > 0 && noncurrentExpirationDays <= noncurrentDaysList[noncurrentDaysList.length - 1]) {
        errors.push("Noncurrent expiration days must be greater than noncurrent transition days.");
      }
      if (noncurrentExpirationEnabled && expirationEnabled) {
        errors.push("Use either current-object expiration or noncurrent cleanup in same rule.");
      }
      if (expiredDeleteMarkerEnabled && expirationEnabled) {
        errors.push("Expired delete marker cleanup cannot be combined with object expiration in same rule.");
      }
    }
    return Array.from(new Set(errors));
  }, [
    abortDays,
    abortEnabled,
    bucketName,
    enabledNoncurrentTransitions,
    enabledTransitions,
    expirationDays,
    expirationEnabled,
    minObjectSizeKb,
    noncurrentExpirationDays,
    noncurrentExpirationEnabled,
    prefix,
    ruleName,
    scopeType,
    useMinObjectSize,
    versioningCleanupEnabled,
    expiredDeleteMarkerEnabled,
  ]);

  const previewPayload = useMemo(() => ({
    bucketName: bucketName.trim(),
    ruleName: ruleName.trim(),
    status,
    scope: {
      ...(scopeType === "prefix" ? { type: "prefix" as const, prefix: normalizePrefix(prefix) } : { type: "entire_bucket" as const }),
      ...(useMinObjectSize ? { minObjectSizeBytes: Math.trunc(minObjectSizeKb * 1024) } : {}),
    },
    transitions: enabledTransitions,
    ...(expirationEnabled ? { expirationDays } : {}),
    ...(abortEnabled ? { abortIncompleteMultipartUploadDays: abortDays } : {}),
    ...(versioningCleanupEnabled ? {
      noncurrentVersionTransitions: enabledNoncurrentTransitions,
      ...(noncurrentExpirationEnabled ? { noncurrentVersionExpirationDays: noncurrentExpirationDays } : {}),
      ...(expiredDeleteMarkerEnabled ? { expiredObjectDeleteMarker: true } : {}),
    } : {}),
  }), [
    abortDays,
    abortEnabled,
    bucketName,
    enabledNoncurrentTransitions,
    enabledTransitions,
    expirationDays,
    expirationEnabled,
    minObjectSizeKb,
    noncurrentExpirationDays,
    noncurrentExpirationEnabled,
    prefix,
    ruleName,
    scopeType,
    status,
    useMinObjectSize,
    versioningCleanupEnabled,
    expiredDeleteMarkerEnabled,
  ]);

  const handleApply = async () => {
    if (validations.length > 0) return;
    await applyMutation.mutateAsync({
      ...previewPayload,
      ...(expirationEnabled ? { deleteWarningAccepted: true } : {}),
    });
  };

  return (
    <div className="dashboard-page s3-policy-page">
      <div className="s3-policy-shell">
        <div className="s3-policy-template-links-wrap">
          <div className="s3-policy-template-row">
            <div className="s3-policy-segment s3-policy-template-links">
              <button type="button" className={activeTemplate === "safe" ? "is-active" : ""} onClick={() => applyTemplate("safe")}>Safe Cost Optimization</button>
              <button type="button" className={activeTemplate === "logs" ? "is-active" : ""} onClick={() => applyTemplate("logs")}>Logs Cleanup</button>
              <button type="button" className={activeTemplate === "temp" ? "is-active" : ""} onClick={() => applyTemplate("temp")}>Temp Cleanup</button>
              <button type="button" className={activeTemplate === "version" ? "is-active" : ""} onClick={() => applyTemplate("version")}>Version Cleanup</button>
              <button type="button" className={activeTemplate === "backup" ? "is-active" : ""} onClick={() => applyTemplate("backup")}>Backup Archive</button>
            </div>
            <button type="button" className="s3-policy-back-btn" onClick={() => navigate({ pathname: "/dashboard/policy", search: location.search })}>Back</button>
          </div>
          {lifecycleInsightQuery.data?.insight?.templateRecommendation ? (
            <p className="s3-policy-template-reco-note">
              Suggested: <strong>{lifecycleInsightQuery.data.insight.templateRecommendation.templateKey}</strong>
              {" - "}
              {lifecycleInsightQuery.data.insight.templateRecommendation.reason}
            </p>
          ) : null}
        </div>

        <div className="s3-policy-main-container">
          {isTemplateLoading ? (
            <div className="s3-policy-template-loading">Template loaded</div>
          ) : null}
          <div className={`s3-policy-layout${isTemplateLoading ? " is-hidden" : ""}`}>
          <section className="s3-policy-form-card">
            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row"><span className="s3-policy-step__index">1</span><h3>Rule Info</h3></div>
              <div className="s3-policy-grid2">
                <label className="s3-policy-field"><span>Bucket</span><select value={bucketName} onChange={(e) => setBucketName(e.target.value)}><option value="">Select bucket</option>{bucketOptions.map((bucket) => <option key={bucket} value={bucket}>{bucket}</option>)}</select></label>
                <label className="s3-policy-field"><span>Rule Name</span><input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="logs-retention-rule" /></label>
              </div>
              <div className="s3-policy-status-wrap">
                <p className="s3-policy-field-help">Policy Status</p>
                <div className="s3-policy-segment s3-policy-status-segment">
                  <button type="button" className={status === "Enabled" ? "is-active" : ""} onClick={() => setStatus("Enabled")}>Active (Rule runs)</button>
                  <button type="button" className={status === "Disabled" ? "is-active" : ""} onClick={() => setStatus("Disabled")}>Paused (Rule off)</button>
                </div>
                <p className="s3-policy-status-note">
                  {status === "Enabled" ? "This lifecycle rule will be applied by AWS." : "This rule is saved but not executed by AWS."}
                </p>
              </div>
            </article>

            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row"><span className="s3-policy-step__index">2</span><h3>Scope & Object Filter</h3></div>
              <div className="s3-policy-radio-row">
                <label><input type="radio" checked={scopeType === "entire_bucket"} onChange={() => setScopeType("entire_bucket")} />Entire bucket</label>
                {activeTemplate !== "safe" ? <label><input type="radio" checked={scopeType === "prefix"} onChange={() => setScopeType("prefix")} />Prefix</label> : null}
              </div>
              {scopeType === "prefix" ? <label className="s3-policy-field"><span>Prefix Path</span><input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="logs/" /></label> : null}
              <label className="s3-policy-inline-toggle">
                <input type="checkbox" checked={useMinObjectSize} onChange={(e) => setUseMinObjectSize(e.target.checked)} />
                <span>Apply only if object size is greater than</span>
                <input className="s3-policy-days-input" type="number" min={0} value={minObjectSizeKb} onChange={(e) => setMinObjectSizeKb(Number(e.target.value))} />
                <span className="s3-policy-muted">KB</span>
              </label>
            </article>

            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row"><span className="s3-policy-step__index">3</span><h3>Current Object Transitions</h3></div>
              <div className="s3-policy-transition-list">
                {transitions.map((item, idx) => (
                  <label key={item.storageClass} className="s3-policy-transition">
                    <input type="checkbox" checked={item.enabled} onChange={(e) => setTransitions((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, enabled: e.target.checked } : row)))} />
                    <span className="s3-policy-transition__label">{item.label}</span>
                    <input className="s3-policy-days-input" type="number" min={MIN_TRANSITION_DAYS[item.storageClass]} value={item.days} onChange={(e) => setTransitions((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, days: Number(e.target.value) } : row)))} />
                    <span className="s3-policy-muted">days</span>
                  </label>
                ))}
              </div>
            </article>

            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row"><span className="s3-policy-step__index">4</span><h3>Expiration & Multipart Cleanup</h3></div>
              <label className="s3-policy-inline-toggle">
                <input type="checkbox" checked={expirationEnabled} onChange={(e) => setExpirationEnabled(e.target.checked)} />
                <span>Delete current objects after</span>
                <input className="s3-policy-days-input" type="number" min={1} value={expirationDays} onChange={(e) => setExpirationDays(Number(e.target.value))} />
                <span className="s3-policy-muted">days</span>
              </label>
              <label className="s3-policy-inline-toggle">
                <input type="checkbox" checked={abortEnabled} onChange={(e) => setAbortEnabled(e.target.checked)} />
                <span>Abort incomplete multipart uploads after</span>
                <input className="s3-policy-days-input" type="number" min={1} value={abortDays} onChange={(e) => setAbortDays(Number(e.target.value))} />
                <span className="s3-policy-muted">days</span>
              </label>
            </article>

            <article className="s3-policy-step">
              <div className="s3-policy-step__title-row"><span className="s3-policy-step__index">5</span><h3>Versioning Cleanup (Versioned Buckets)</h3></div>
              <label className="s3-policy-inline-toggle">
                <input type="checkbox" checked={versioningCleanupEnabled} onChange={(e) => setVersioningCleanupEnabled(e.target.checked)} />
                <span>Enable noncurrent version cleanup</span>
              </label>
              {versioningCleanupEnabled ? (
                <>
                  <div className="s3-policy-transition-list">
                    {noncurrentTransitions.map((item, idx) => (
                      <label key={`${item.storageClass}-${idx}`} className="s3-policy-transition">
                        <input type="checkbox" checked={item.enabled} onChange={(e) => setNoncurrentTransitions((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, enabled: e.target.checked } : row)))} />
                        <span className="s3-policy-transition__label">{item.label}</span>
                        <input className="s3-policy-days-input" type="number" min={1} value={item.days} onChange={(e) => setNoncurrentTransitions((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, days: Number(e.target.value) } : row)))} />
                        <span className="s3-policy-muted">days</span>
                      </label>
                    ))}
                  </div>
                  <label className="s3-policy-inline-toggle">
                    <input type="checkbox" checked={noncurrentExpirationEnabled} onChange={(e) => setNoncurrentExpirationEnabled(e.target.checked)} />
                    <span>Delete noncurrent versions after</span>
                    <input className="s3-policy-days-input" type="number" min={1} value={noncurrentExpirationDays} onChange={(e) => setNoncurrentExpirationDays(Number(e.target.value))} />
                    <span className="s3-policy-muted">days</span>
                  </label>
                  <label className="s3-policy-inline-toggle">
                    <input type="checkbox" checked={expiredDeleteMarkerEnabled} onChange={(e) => setExpiredDeleteMarkerEnabled(e.target.checked)} />
                    <span>Remove expired delete markers</span>
                  </label>
                </>
              ) : null}
            </article>
          </section>

          <aside className="s3-policy-preview-card">
            <div className="s3-policy-step__title-row"><span className="s3-policy-step__index">6</span><h3>Preview & Apply</h3></div>
            <pre>{JSON.stringify(previewPayload, null, 2)}</pre>
            {validations.length > 0 ? <div className="s3-policy-errors">{validations.map((error) => <p key={error}>{error}</p>)}</div> : null}
            {applyMutation.isError ? <p className="s3-policy-errors">Failed to apply lifecycle policy: {applyMutation.error.message}</p> : null}
            {applyMutation.isSuccess ? <p className="s3-policy-success">Lifecycle policy applied to {applyMutation.data.bucketName} ({applyMutation.data.region}).</p> : null}
            <div className="s3-policy-action-row">
              <button type="button" className="s3-policy-cancel-btn" onClick={() => navigate({ pathname: "/dashboard/policy", search: location.search })}>Cancel</button>
              <button type="button" className="s3-policy-apply-btn" onClick={handleApply} disabled={validations.length > 0 || applyMutation.isPending}>
                {applyMutation.isPending ? "Applying..." : "Apply Policy"}
              </button>
            </div>
          </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
