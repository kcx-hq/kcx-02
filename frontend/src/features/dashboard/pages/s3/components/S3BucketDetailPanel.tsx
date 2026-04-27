import { useMemo } from "react";

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

type Props = {
  bucket: S3BucketTableRow;
  totalS3Cost: number;
  onClose: () => void;
};

type CostBreakdownItem = {
  label: string;
  value: number;
};

const buildTopDrivers = (items: CostBreakdownItem[]): CostBreakdownItem[] =>
  [...items]
    .sort((left, right) => right.value - left.value)
    .filter((item) => item.value > 0)
    .slice(0, 2);

export function S3BucketDetailPanel({ bucket, totalS3Cost, onClose }: Props) {
  const bucketCost = Number(bucket.cost ?? 0);
  const storageCost = Number(bucket.storage ?? 0);
  const requestCost = Number(bucket.requests ?? 0);
  const retrievalCost = Number(bucket.retrieval ?? 0);
  const transferCost = Number(bucket.transfer ?? 0);
  const otherCost = Number(bucket.other ?? 0);
  const attributedCost = storageCost + requestCost + retrievalCost + transferCost;
  const unattributedCost = Math.max(bucketCost - attributedCost, 0);
  const shareOfS3Cost = totalS3Cost > 0 ? (bucketCost / totalS3Cost) * 100 : 0;
  const attributedShare = bucketCost > 0 ? (attributedCost / bucketCost) * 100 : 0;
  const trend = Number(bucket.trendPct ?? 0);
  const trendDirection = trend > 0 ? "Increase" : trend < 0 ? "Decrease" : "No change";

  const breakdownItems = useMemo<CostBreakdownItem[]>(
    () => [
      { label: "Storage", value: storageCost },
      { label: "Request", value: requestCost },
      { label: "Retrieval", value: retrievalCost },
      { label: "Transfer", value: transferCost },
      { label: "Other", value: otherCost + unattributedCost },
    ],
    [otherCost, requestCost, retrievalCost, storageCost, transferCost, unattributedCost],
  );

  const topDrivers = useMemo(() => buildTopDrivers(breakdownItems), [breakdownItems]);

  return (
    <section className="s3-bucket-detail-panel" aria-label={`Selected bucket details for ${bucket.bucketName}`}>
      <header className="s3-bucket-detail-panel__header">
        <div>
          <p className="s3-bucket-detail-panel__eyebrow">Selected Bucket</p>
          <h3 className="s3-bucket-detail-panel__title">{bucket.bucketName}</h3>
        </div>
        <button type="button" className="s3-bucket-detail-panel__close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="s3-bucket-detail-panel__summary-grid">
        <article className="s3-bucket-detail-panel__summary-card">
          <p className="s3-bucket-detail-panel__summary-label">Total Bucket Cost</p>
          <p className="s3-bucket-detail-panel__summary-value">{currencyFormatter.format(bucketCost)}</p>
        </article>
        <article className="s3-bucket-detail-panel__summary-card">
          <p className="s3-bucket-detail-panel__summary-label">% of Total S3</p>
          <p className="s3-bucket-detail-panel__summary-value">{percentFormatter.format(shareOfS3Cost)}%</p>
        </article>
        <article className="s3-bucket-detail-panel__summary-card">
          <p className="s3-bucket-detail-panel__summary-label">Trend vs Previous Period</p>
          <p className="s3-bucket-detail-panel__summary-value">
            {trendDirection} ({trend >= 0 ? "+" : ""}
            {percentFormatter.format(trend)}%)
          </p>
        </article>
        <article className="s3-bucket-detail-panel__summary-card">
          <p className="s3-bucket-detail-panel__summary-label">Attributed Coverage</p>
          <p className="s3-bucket-detail-panel__summary-value">{percentFormatter.format(attributedShare)}%</p>
        </article>
      </div>

      <div className="s3-bucket-detail-panel__content-grid">
        <article className="s3-bucket-detail-panel__block">
          <h4 className="s3-bucket-detail-panel__block-title">Cost Composition</h4>
          <ul className="s3-bucket-detail-panel__list">
            {breakdownItems.map((item) => {
              const share = bucketCost > 0 ? (item.value / bucketCost) * 100 : 0;
              return (
                <li key={item.label} className="s3-bucket-detail-panel__list-item">
                  <span>{item.label}</span>
                  <span>
                    {currencyFormatter.format(item.value)} ({percentFormatter.format(share)}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="s3-bucket-detail-panel__block">
          <h4 className="s3-bucket-detail-panel__block-title">Bucket Metadata</h4>
          <ul className="s3-bucket-detail-panel__list">
            <li className="s3-bucket-detail-panel__list-item">
              <span>Account</span>
              <span>{bucket.account || "Unknown"}</span>
            </li>
            <li className="s3-bucket-detail-panel__list-item">
              <span>Region</span>
              <span>{bucket.region || "Unknown"}</span>
            </li>
            <li className="s3-bucket-detail-panel__list-item">
              <span>Owner</span>
              <span>{bucket.owner || "Unassigned"}</span>
            </li>
            <li className="s3-bucket-detail-panel__list-item">
              <span>Main Cost Driver</span>
              <span>{topDrivers[0]?.label ?? "Other"}</span>
            </li>
            <li className="s3-bucket-detail-panel__list-item">
              <span>Secondary Driver</span>
              <span>{topDrivers[1]?.label ?? "N/A"}</span>
            </li>
          </ul>
        </article>

        <article className="s3-bucket-detail-panel__block">
          <h4 className="s3-bucket-detail-panel__block-title">FinOps Insights</h4>
          <ul className="s3-bucket-detail-panel__insights">
            <li>
              {topDrivers[0]?.label ?? "Storage"} is the main contributor at{" "}
              {percentFormatter.format(bucketCost > 0 ? ((topDrivers[0]?.value ?? 0) / bucketCost) * 100 : 0)}% of this bucket cost.
            </li>
            <li>
              {unattributedCost > 0
                ? `Shared or unattributed cost is ${currencyFormatter.format(unattributedCost)}.`
                : "Transfer and shared-cost attribution are fully mapped for this bucket."}
            </li>
            <li>
              {trend > 0
                ? "This bucket is rising in spend; validate retention, request pattern, and transfer path."
                : trend < 0
                  ? "This bucket is trending down; keep lifecycle and access controls in place."
                  : "This bucket cost is stable compared with the previous period."}
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
