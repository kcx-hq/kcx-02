import { useOverviewQuery } from "../../hooks/useDashboardQueries";
import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { DashboardSection } from "../../components/DashboardSection";

export default function OverviewPage() {
  const { data, isLoading, isError, error } = useOverviewQuery();
  const totalSpend = Number(data?.summary.totalSpend ?? 0);

  const formattedTotalSpend = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalSpend);

  return (
    <div className="dashboard-page">
      <DashboardPageHeader title="Overview" />
      <DashboardSection title="Total Spend" description="Summed from billed cost in your current dashboard scope.">
        {isLoading ? <p className="dashboard-note">Loading total spend...</p> : null}
        {isError ? <p className="dashboard-note">Failed to load total spend: {error.message}</p> : null}
        {!isLoading && !isError ? (
          <article className="dashboard-list__item">
            <p className="dashboard-list__title">Total Spend</p>
            <p className="dashboard-list__meta">{formattedTotalSpend}</p>
          </article>
        ) : null}
      </DashboardSection>
    </div>
  );
}
