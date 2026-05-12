import type { S3CostInsightsResponse } from "../../../api/dashboardTypes";

const currencyShortFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

type Props = {
  data: S3CostInsightsResponse | undefined;
};

export function S3BucketFinopsInsights({ data }: Props) {
  const anomalies = data?.storageAnomalies.items ?? [];
  const optimizationScores = data?.bucketOptimizationScores.items ?? [];
  const healthScores = data?.bucketHealthScores.items ?? [];
  const savings = data?.estimatedSavings;
  const ownerInsights = data?.ownerInsights.items ?? [];
  const requestIntelligence = data?.requestCostIntelligence.items ?? [];
  const storageEfficiency = data?.storageClassEfficiency.items ?? [];
  const actionBacklog = data?.finopsActionBacklog;

  return (
    <>
      <section className="s3-command-center" aria-label="Storage Growth Anomalies">
        <header className="s3-command-center__header">
          <h3>Storage Growth Anomalies</h3>
          <p>7-day growth, class spikes, and lifecycle-risk patterns.</p>
        </header>
        <div className="s3-command-center__table-wrap">
          <table className="s3-command-center__table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Severity</th>
                <th>Growth %</th>
                <th>Impact / mo</th>
                <th>Anomaly</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.slice(0, 20).map((item) => (
                <tr key={`${item.bucketName}-${item.anomalyType}`}>
                  <td>{item.bucketName}</td>
                  <td>
                    <span className={`s3-badge s3-badge--${item.severity.toLowerCase()}`}>{item.severity}</span>
                  </td>
                  <td>{item.growthPercentage == null ? "--" : `${item.growthPercentage.toFixed(2)}%`}</td>
                  <td>{currencyShortFormatter.format(item.estimatedMonthlyCostImpact)}</td>
                  <td>{item.anomalyType}</td>
                  <td>{item.recommendedAction}</td>
                </tr>
              ))}
              {anomalies.length === 0 ? (
                <tr>
                  <td colSpan={6}>No anomalies detected in the selected range.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="s3-command-center" aria-label="Optimization Command Center">
        <header className="s3-command-center__header">
          <h3>Optimization Command Center</h3>
          <p>Lowest scores are highest priority for FinOps action.</p>
        </header>
        <div className="s3-command-center__table-wrap">
          <table className="s3-command-center__table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Score</th>
                <th>Priority</th>
                <th>Reason</th>
                <th>Monthly Saving</th>
              </tr>
            </thead>
            <tbody>
              {optimizationScores.slice(0, 20).map((item) => (
                <tr key={item.bucketName}>
                  <td>{item.bucketName}</td>
                  <td>{item.score.toFixed(2)}</td>
                  <td><span className={`s3-badge s3-badge--priority-${item.priorityLevel.toLowerCase()}`}>{item.priorityLevel}</span></td>
                  <td>{item.primaryReason}</td>
                  <td>{currencyShortFormatter.format(item.estimatedMonthlySaving)}</td>
                </tr>
              ))}
              {optimizationScores.length === 0 ? (
                <tr>
                  <td colSpan={5}>No optimization score data.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="s3-command-center" aria-label="Bucket Health Score Table">
        <header className="s3-command-center__header">
          <h3>Bucket Health Score Table</h3>
          <p>Operational and governance health separate from pure cost urgency.</p>
        </header>
        <div className="s3-command-center__table-wrap">
          <table className="s3-command-center__table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Health Score</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {healthScores.slice(0, 20).map((item) => (
                <tr key={item.bucketName}>
                  <td>{item.bucketName}</td>
                  <td>{item.score.toFixed(2)}</td>
                  <td>{item.healthLabel}</td>
                </tr>
              ))}
              {healthScores.length === 0 ? (
                <tr>
                  <td colSpan={3}>No health score data.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="s3-command-center" aria-label="Estimated Savings">
        <header className="s3-command-center__header">
          <h3>Estimated Savings</h3>
          <p>
            Potential monthly: {currencyShortFormatter.format(savings?.totalMonthlySaving ?? 0)} | Annualized: {" "}
            {currencyShortFormatter.format(savings?.totalAnnualSaving ?? 0)}
          </p>
        </header>
      </section>

      <section className="s3-command-center" aria-label="Owner Accountability">
        <header className="s3-command-center__header">
          <h3>Owner Accountability</h3>
          <p>Ownership and business-unit accountability for optimization backlog.</p>
        </header>
        <div className="s3-command-center__table-wrap">
          <table className="s3-command-center__table">
            <thead>
              <tr>
                <th>Owner Team</th>
                <th>Business Unit</th>
                <th>Open Actions</th>
                <th>SLA Breaches</th>
                <th>Savings Opportunity</th>
              </tr>
            </thead>
            <tbody>
              {ownerInsights.slice(0, 20).map((item) => (
                <tr key={`${item.ownerTeam}-${item.businessUnit}`}>
                  <td>{item.ownerTeam}</td>
                  <td>{item.businessUnit}</td>
                  <td>{item.openActionItems}</td>
                  <td>{item.slaBreaches}</td>
                  <td>{currencyShortFormatter.format(item.totalMonthlySavingsOpportunity)}</td>
                </tr>
              ))}
              {ownerInsights.length === 0 ? (
                <tr>
                  <td colSpan={5}>No owner mapping insights.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="s3-command-center" aria-label="Request Cost Intelligence">
        <header className="s3-command-center__header">
          <h3>Request Cost Intelligence</h3>
          <p>Request-operation inefficiency signals and recommendations.</p>
        </header>
        <div className="s3-command-center__table-wrap">
          <table className="s3-command-center__table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Operation</th>
                <th>Request Cost</th>
                <th>Cost / 1k</th>
                <th>Anomaly</th>
              </tr>
            </thead>
            <tbody>
              {requestIntelligence.slice(0, 20).map((item) => (
                <tr key={`${item.bucketName}-${item.operation}`}>
                  <td>{item.bucketName}</td>
                  <td>{item.operation}</td>
                  <td>{currencyShortFormatter.format(item.requestCost)}</td>
                  <td>{currencyShortFormatter.format(item.costPer1kRequests)}</td>
                  <td>{item.anomalyFlag ? "Yes" : "No"}</td>
                </tr>
              ))}
              {requestIntelligence.length === 0 ? (
                <tr>
                  <td colSpan={5}>No request cost intelligence data.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="s3-command-center" aria-label="Storage Class Efficiency">
        <header className="s3-command-center__header">
          <h3>Storage Class Efficiency</h3>
          <p>Storage class imbalance and archive retrieval risk by bucket.</p>
        </header>
        <div className="s3-command-center__table-wrap">
          <table className="s3-command-center__table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Standard %</th>
                <th>Intelligent Tiering %</th>
                <th>Archive Risk</th>
                <th>Insight</th>
              </tr>
            </thead>
            <tbody>
              {storageEfficiency.slice(0, 20).map((item) => (
                <tr key={item.bucketName}>
                  <td>{item.bucketName}</td>
                  <td>{item.standardPct.toFixed(1)}%</td>
                  <td>{item.intelligentTieringPct.toFixed(1)}%</td>
                  <td>{item.archiveRetrievalRisk}</td>
                  <td>{item.insight}</td>
                </tr>
              ))}
              {storageEfficiency.length === 0 ? (
                <tr>
                  <td colSpan={5}>No storage class efficiency insights.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="s3-command-center" aria-label="FinOps Action Backlog">
        <header className="s3-command-center__header">
          <h3>FinOps Action Backlog</h3>
          <p>
            Open: {actionBacklog?.summary.open ?? 0} | In progress: {actionBacklog?.summary.inProgress ?? 0} | SLA
            breached: {actionBacklog?.summary.slaBreached ?? 0}
          </p>
        </header>
        <div className="s3-command-center__table-wrap">
          <table className="s3-command-center__table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Bucket</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Monthly Saving</th>
              </tr>
            </thead>
            <tbody>
              {(actionBacklog?.items ?? []).slice(0, 20).map((item) => (
                <tr key={item.actionId}>
                  <td>{item.recommendation}</td>
                  <td>{item.bucketName}</td>
                  <td>{item.priority}</td>
                  <td>{item.status}</td>
                  <td>{currencyShortFormatter.format(item.estimatedMonthlySaving)}</td>
                </tr>
              ))}
              {(actionBacklog?.items?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5}>No action backlog items.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
