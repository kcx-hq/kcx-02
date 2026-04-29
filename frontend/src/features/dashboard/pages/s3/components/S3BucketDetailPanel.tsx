import { useMemo, useState } from "react";
import { PanelRightOpen, X } from "lucide-react";

import type { S3BucketTableRow } from "./S3BucketInsightsTable";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantityFormatterPrecise = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

type Props = {
  bucket: S3BucketTableRow;
  usageMetrics: {
    storageGb: number;
    transferGb: number;
    requestCount: number;
  };
  storageClassDistribution?: Array<{
    name: string;
    usage: number;
  }>;
  storageLens?: {
    usageDate: string;
    objectCount: number | null;
    currentVersionBytes: number | null;
    avgObjectSizeBytes: number | null;
    accessCount: number | null;
    percentInGlacier: number;
    storageClassDistribution: Array<{
      name: string;
      bytes: number;
      percent: number;
    }>;
  } | null;
  onClose: () => void;
};

const resolveEnvironment = (bucketName: string): string => {
  const normalized = bucketName.toLowerCase();
  if (normalized.includes("prod") || normalized.includes("production")) return "prod";
  if (normalized.includes("dev") || normalized.includes("development")) return "dev";
  return "N/A";
};

export function S3BucketDetailPanel({ bucket, usageMetrics, storageClassDistribution = [], storageLens = null, onClose }: Props) {
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const bucketCost = Number(bucket.cost ?? 0);
  const storageCost = Number(bucket.storage ?? 0);
  const requestCost = Number(bucket.requests ?? 0);
  const transferCost = Number(bucket.transfer ?? 0);
  const retrievalCost = Number(bucket.retrieval ?? 0);
  const otherCost = Number(bucket.other ?? 0);
  const trend = Number(bucket.trendPct ?? 0);
  const environment = useMemo(() => resolveEnvironment(String(bucket.bucketName ?? "")), [bucket.bucketName]);

  const estimatedCurrentVersionBytes = Math.max(Number(usageMetrics.storageGb ?? 0), 0) * 1024 * 1024 * 1024;
  const totalStorageClassUsage = storageClassDistribution.reduce((sum, item) => sum + Number(item.usage ?? 0), 0);
  const glacierUsage = storageClassDistribution
    .filter((item) => {
      const name = item.name.toLowerCase();
      return name.includes("glacier") || name.includes("deep archive");
    })
    .reduce((sum, item) => sum + Number(item.usage ?? 0), 0);
  const glacierPct = totalStorageClassUsage > 0 ? (glacierUsage / totalStorageClassUsage) * 100 : 0;

  const accessPatternHint =
    (storageLens?.accessCount ?? usageMetrics.requestCount) > 10000
      ? "Request-heavy bucket (frequent API access)"
      : usageMetrics.transferGb > 1
        ? "Transfer-heavy bucket (network egress/ingress notable)"
        : "Storage-centric bucket (capacity dominates)";

  return (
    <section className="s3-bucket-detail-panel" aria-label={`Selected bucket details for ${bucket.bucketName}`}>
      <header className="s3-bucket-detail-panel__header">
        <div>
          <h3 className="s3-bucket-detail-panel__title">{bucket.bucketName}</h3>
        </div>
        <div className="s3-bucket-detail-panel__header-actions">
          <button
            type="button"
            className="s3-bucket-detail-panel__icon-btn"
            onClick={() => setIsInfoPanelOpen(true)}
            aria-label="Open bucket info panel"
          >
            <PanelRightOpen size={14} strokeWidth={2.2} />
          </button>
          <button type="button" className="s3-bucket-detail-panel__close" onClick={onClose} aria-label="Close bucket detail">
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <div className={`s3-bucket-sidepanel-backdrop${isInfoPanelOpen ? " is-open" : ""}`} onClick={() => setIsInfoPanelOpen(false)}>
        <aside
          className={`s3-bucket-sidepanel${isInfoPanelOpen ? " is-open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Bucket full details"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="s3-bucket-sidepanel__header">
            <h3 className="s3-bucket-sidepanel__title">Bucket Details</h3>
            <button
              type="button"
              className="s3-bucket-sidepanel__close"
              onClick={() => setIsInfoPanelOpen(false)}
              aria-label="Close bucket info panel"
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </header>

          <div className="s3-bucket-sidepanel__body">
            <section className="s3-bucket-sidepanel__section">
              <h4>Metadata</h4>
              <dl>
                <div><dt>Bucket Name</dt><dd>{bucket.bucketName}</dd></div>
                <div><dt>Account</dt><dd>{bucket.account || "Unknown"}</dd></div>
                <div><dt>Region</dt><dd>{bucket.region || "Unknown"}</dd></div>
                <div><dt>Owner</dt><dd>{bucket.owner || "Unassigned"}</dd></div>
                <div><dt>Environment</dt><dd>{environment}</dd></div>
              </dl>
            </section>

            <section className="s3-bucket-sidepanel__section">
              <h4>Usage Metrics</h4>
              <dl>
                <div><dt>Storage (GB)</dt><dd>{quantityFormatterPrecise.format(usageMetrics.storageGb)}</dd></div>
                <div><dt>Requests (Count)</dt><dd>{integerFormatter.format(usageMetrics.requestCount)}</dd></div>
                <div><dt>Transfer (GB)</dt><dd>{quantityFormatter.format(usageMetrics.transferGb)}</dd></div>
              </dl>
            </section>

            <section className="s3-bucket-sidepanel__section">
              <h4>S3 Storage Lens (FinOps View)</h4>
              <dl>
                <div><dt>Object Count</dt><dd>{storageLens?.objectCount != null ? integerFormatter.format(storageLens.objectCount) : "Not captured (CUR-only)"}</dd></div>
                <div><dt>Current Version Bytes</dt><dd>{integerFormatter.format(storageLens?.currentVersionBytes ?? estimatedCurrentVersionBytes)} bytes{storageLens?.currentVersionBytes != null ? "" : " (est.)"}</dd></div>
                <div><dt>Avg Object Size</dt><dd>{storageLens?.avgObjectSizeBytes != null ? `${integerFormatter.format(storageLens.avgObjectSizeBytes)} bytes` : "N/A (needs object count)"}</dd></div>
                <div><dt>% in Glacier</dt><dd>{percentFormatter.format(storageLens?.percentInGlacier ?? glacierPct)}%</dd></div>
                <div><dt>Access Pattern</dt><dd>{accessPatternHint}</dd></div>
              </dl>
              {(storageLens?.storageClassDistribution?.length ?? 0) > 0 || storageClassDistribution.length > 0 ? (
                <div className="s3-bucket-sidepanel__subtable">
                  <p className="s3-bucket-sidepanel__subtable-title">Storage Class Distribution</p>
                  <ul>
                    {(storageLens?.storageClassDistribution?.length
                      ? storageLens.storageClassDistribution.slice(0, 6).map((item) => ({
                          name: item.name,
                          displayValue: `${integerFormatter.format(item.bytes)} bytes`,
                          displayPct: `${percentFormatter.format(item.percent)}%`,
                        }))
                      : storageClassDistribution.slice(0, 6).map((item) => ({
                          name: item.name,
                          displayValue: quantityFormatter.format(item.usage),
                          displayPct:
                            totalStorageClassUsage > 0 ? `${percentFormatter.format((item.usage / totalStorageClassUsage) * 100)}%` : "",
                        }))).map((item) => (
                      <li key={item.name}>
                        <span>{item.name}</span>
                        <strong>
                          {item.displayValue}
                          {item.displayPct ? ` (${item.displayPct})` : ""}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!storageLens ? (
                <p className="s3-bucket-sidepanel__note">
                  For exact AWS Storage Lens metrics (Object Count, Avg Object Size), ingest Storage Lens exports into DB during ingestion.
                </p>
              ) : null}
            </section>

            <section className="s3-bucket-sidepanel__section">
              <h4>Cost Breakdown</h4>
              <dl>
                <div><dt>Total Cost</dt><dd>{currencyFormatter.format(bucketCost)}</dd></div>
                <div><dt>Storage Cost</dt><dd>{currencyFormatter.format(storageCost)}</dd></div>
                <div><dt>Request Cost</dt><dd>{currencyFormatter.format(requestCost)}</dd></div>
                <div><dt>Transfer Cost</dt><dd>{currencyFormatter.format(transferCost)}</dd></div>
                <div><dt>Retrieval Cost</dt><dd>{currencyFormatter.format(retrievalCost)}</dd></div>
                <div><dt>Other Cost</dt><dd>{currencyFormatter.format(otherCost)}</dd></div>
                <div><dt>Cost Trend</dt><dd>{trend >= 0 ? "+" : ""}{percentFormatter.format(trend)}%</dd></div>
              </dl>
            </section>
          </div>
        </aside>
      </div>
    </section>
  );
}
