import type { UseQueryResult } from "@tanstack/react-query";
import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import { DashboardSection } from "../../components/DashboardSection";
import type { DashboardSectionData } from "../../api/dashboardApi";

type DashboardSectionPageProps = {
  title: string;
  query: UseQueryResult<DashboardSectionData, Error>;
};

export function DashboardSectionPage({ title, query }: DashboardSectionPageProps) {
  const { data, error, isLoading, isError } = query;

  return (
    <div className="dashboard-page">
      <DashboardPageHeader title={title} />
      <DashboardSection title={`${title} Data`} description="Fetched from the dashboard API.">
        {isLoading ? <p className="dashboard-note">Loading {title.toLowerCase()} data...</p> : null}
        {isError ? <p className="dashboard-note">Failed to load data: {error.message}</p> : null}
        {data ? (
          <>
            <div className="dashboard-list">
              {data.summary.map((item) => (
                <article key={item.label} className="dashboard-list__item">
                  <p className="dashboard-list__title">{item.label}</p>
                  <p className="dashboard-list__meta">{item.value}</p>
                </article>
              ))}
            </div>
            <pre className="dashboard-note">{JSON.stringify(data, null, 2)}</pre>
          </>
        ) : null}
      </DashboardSection>
    </div>
  );
}
