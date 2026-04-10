import type { UseQueryResult } from "@tanstack/react-query";
import { ManualDashboardPageHeader } from "../../components/ManualDashboardPageHeader";
import { ManualDashboardPlaceholderBlock } from "../../components/ManualDashboardPlaceholderBlock";
import { ManualDashboardSection } from "../../components/ManualDashboardSection";
import type { UploadDashboardSectionResponse } from "../../api/uploadDashboardApi";

type ManualDashboardSectionPageProps = {
  title: string;
  query: UseQueryResult<UploadDashboardSectionResponse, Error>;
};

export function ManualDashboardSectionPage({ title, query }: ManualDashboardSectionPageProps) {
  const { data, isLoading, isError, error } = query;

  return (
    <div className="dashboard-page">
      <ManualDashboardPageHeader title={title} />

      <ManualDashboardSection
        title={`${title} Section`}
        description="Data is fetched from upload-dashboard backend endpoints."
      >
        <ManualDashboardPlaceholderBlock
          label="Backend Connected"
          hint="TanStack React Query"
        >
          {isLoading ? <p className="dashboard-note">Loading {title.toLowerCase()}...</p> : null}
          {isError ? <p className="dashboard-note">Failed to load data: {error.message}</p> : null}
          {data ? <pre className="dashboard-note">{JSON.stringify(data, null, 2)}</pre> : null}
        </ManualDashboardPlaceholderBlock>
      </ManualDashboardSection>
    </div>
  );
}
