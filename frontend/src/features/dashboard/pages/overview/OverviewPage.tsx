import { useState } from "react";
import { Funnel } from "lucide-react";
import { DashboardPageHeader } from "../../components/DashboardPageHeader";
import {
  EmptyStateBlock,
  KpiCard,
  KpiGrid,
  MetricBadge,
  PageSection,
  SectionHeader,
  WidgetShell,
} from "../../common/components";
import {
  AreaChart,
  BarChart,
  ChartPlaceholder,
  DonutChart,
  LineTrendChart,
  StackedBarChart,
} from "../../common/charts";
import { CostTable, TableEmptyState, TableShell, UsageTable } from "../../common/tables";
import {
  AccountsFilter,
  DateRangeFilter,
  FilterActions,
  FilterPanel,
  FilterSection,
  ProviderFilter,
  RegionFilter,
} from "../../common/filters";

const trendData = [
  { label: "Jan", value: 108 },
  { label: "Feb", value: 114 },
  { label: "Mar", value: 110 },
  { label: "Apr", value: 121 },
  { label: "May", value: 129 },
  { label: "Jun", value: 126 },
];

const barData = [
  { label: "Compute", value: 72 },
  { label: "Storage", value: 44 },
  { label: "Network", value: 31 },
  { label: "Data", value: 38 },
];

const stackedCategories = ["Week 1", "Week 2", "Week 3", "Week 4"];
const stackedSeries = [
  { name: "Compute", values: [28, 30, 27, 31] },
  { name: "Storage", values: [16, 15, 17, 16] },
  { name: "Network", values: [10, 11, 9, 10] },
];

const donutData = [
  { name: "AWS", value: 54 },
  { name: "Azure", value: 29 },
  { name: "GCP", value: 17 },
];

const costRows = [
  { service: "EC2", provider: "AWS", cost: 84210, delta: "+4.1%" },
  { service: "S3", provider: "AWS", cost: 21440, delta: "+1.3%" },
  { service: "AKS", provider: "Azure", cost: 19670, delta: "-0.8%" },
  { service: "BigQuery", provider: "GCP", cost: 16420, delta: "+2.4%" },
];

const usageRows = [
  { resource: "Container Cluster", region: "us-east-1", usage: "3,240 hrs", utilization: "82%" },
  { resource: "Managed DB", region: "us-west-2", usage: "1,910 hrs", utilization: "74%" },
  { resource: "Object Storage", region: "eu-west-1", usage: "8.4 TB", utilization: "66%" },
];

const providerOptions = [
  { label: "All Providers", value: "all" },
  { label: "AWS", value: "aws" },
  { label: "Azure", value: "azure" },
  { label: "GCP", value: "gcp" },
];

const regionOptions = [
  { label: "All Regions", value: "all" },
  { label: "us-east-1", value: "us-east-1" },
  { label: "us-west-2", value: "us-west-2" },
  { label: "eu-west-1", value: "eu-west-1" },
];

const accountOptions = [
  { label: "prod-core", value: "prod-core" },
  { label: "analytics", value: "analytics" },
  { label: "sandbox", value: "sandbox" },
];

const dateRangeOptions = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "This quarter", value: "quarter" },
];

export default function OverviewPage() {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [provider, setProvider] = useState("all");
  const [region, setRegion] = useState("all");
  const [accounts, setAccounts] = useState<string[]>(["prod-core", "analytics"]);
  const [dateRange, setDateRange] = useState("30d");

  const resetFilters = () => {
    setProvider("all");
    setRegion("all");
    setAccounts(["prod-core", "analytics"]);
    setDateRange("30d");
  };

  return (
    <div className="dashboard-page">
      <DashboardPageHeader title="Overview" />

      <PageSection
        title="KPI Templates"
        description="Reusable KPI cards and status badges for summary rows."
      >
        <KpiGrid>
          <KpiCard label="Monthly Spend" value="$142.8K" delta="+3.4%" deltaTone="negative" meta="vs previous month" />
          <KpiCard label="Savings Opportunity" value="$18.2K" delta="-2.1%" deltaTone="positive" meta="rightsizing signals" />
          <KpiCard label="Coverage" value="92.4%" delta="+1.0pt" deltaTone="accent" meta="tagging quality" />
          <KpiCard label="Anomaly Alerts" value="6" delta="2 critical" deltaTone="neutral" meta="last 24 hours" />
        </KpiGrid>
      </PageSection>

      <PageSection
        title="Chart Templates"
        description="ECharts-based visual templates built to fit widget shells."
      >
        <div className="dashboard-showcase-grid dashboard-showcase-grid--charts">
          <WidgetShell title="Line Trend Chart" subtitle="Weekly spend movement">
            <LineTrendChart data={trendData} />
          </WidgetShell>
          <WidgetShell title="Area Chart" subtitle="Cumulative trend">
            <AreaChart data={trendData} />
          </WidgetShell>
          <WidgetShell title="Bar Chart" subtitle="Category comparison">
            <BarChart data={barData} />
          </WidgetShell>
          <WidgetShell title="Stacked Bar Chart" subtitle="Category share by week">
            <StackedBarChart categories={stackedCategories} series={stackedSeries} />
          </WidgetShell>
          <WidgetShell title="Donut Chart" subtitle="Provider distribution">
            <DonutChart data={donutData} />
          </WidgetShell>
          <WidgetShell title="Chart Placeholder" subtitle="No data state template">
            <ChartPlaceholder title="No trend available" message="Connect a data source or widen your date range." />
          </WidgetShell>
        </div>
      </PageSection>

      <PageSection
        title="Table Templates"
        description="AG Grid wrappers with compact, dashboard-aligned styling."
      >
        <div className="dashboard-showcase-grid dashboard-showcase-grid--tables">
          <TableShell title="Cost Table" subtitle="Reusable cost table template">
            <CostTable rows={costRows} />
          </TableShell>
          <TableShell title="Usage Table" subtitle="Reusable usage table template">
            <UsageTable rows={usageRows} />
          </TableShell>
          <TableShell title="Table Empty State" subtitle="When rows are unavailable">
            <TableEmptyState message="No table rows were returned for this filter set." />
          </TableShell>
        </div>
      </PageSection>

      <PageSection
        title="Filter Templates"
        description="Reusable right-side filter panel and control blocks."
        actions={
          <button
            type="button"
            className="dashboard-template-trigger"
            onClick={() => setIsFilterPanelOpen(true)}
          >
            <Funnel size={14} />
            <span>Open Filter Panel</span>
          </button>
        }
      >
        <div className="dashboard-filter-preview">
          <SectionHeader
            title="Active Filter Snapshot"
            description="This shows how selected values can be surfaced on-page."
            actions={<MetricBadge tone="accent">Template Demo</MetricBadge>}
          />
          <div className="dashboard-filter-preview__pills">
            <MetricBadge tone="neutral">Provider: {provider}</MetricBadge>
            <MetricBadge tone="neutral">Region: {region}</MetricBadge>
            <MetricBadge tone="neutral">Accounts: {accounts.length}</MetricBadge>
            <MetricBadge tone="neutral">Date Range: {dateRange}</MetricBadge>
          </div>
        </div>
      </PageSection>

      <PageSection
        title="Placeholder Templates"
        description="Reusable empty and fallback blocks for dashboard sections."
      >
        <div className="dashboard-showcase-grid dashboard-showcase-grid--placeholders">
          <EmptyStateBlock
            title="No recommendation yet"
            message="Add a recommendation engine response to populate this block."
          />
          <WidgetShell title="Widget Empty State" subtitle="Slot for chart or table">
            <EmptyStateBlock title="No widget content" message="This widget is ready for future data wiring." />
          </WidgetShell>
        </div>
      </PageSection>

      <FilterPanel
        open={isFilterPanelOpen}
        title="Template Filters"
        subtitle="Reusable controls for dashboard pages"
        onClose={() => setIsFilterPanelOpen(false)}
        footer={
          <FilterActions
            onReset={resetFilters}
            onApply={() => setIsFilterPanelOpen(false)}
          />
        }
      >
        <FilterSection title="Scope">
          <ProviderFilter value={provider} options={providerOptions} onChange={setProvider} />
          <RegionFilter value={region} options={regionOptions} onChange={setRegion} />
        </FilterSection>

        <FilterSection title="Accounts">
          <AccountsFilter options={accountOptions} selectedValues={accounts} onChange={setAccounts} />
        </FilterSection>

        <FilterSection title="Date">
          <DateRangeFilter value={dateRange} options={dateRangeOptions} onChange={setDateRange} />
        </FilterSection>
      </FilterPanel>
    </div>
  );
}
