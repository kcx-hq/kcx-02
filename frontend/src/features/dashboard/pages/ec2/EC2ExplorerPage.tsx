import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useDashboardScope } from "../../hooks/useDashboardScope";
import { useEc2CostExplorerV2Query, useEc2DataTransferExplorerV2Query, useEc2ExplorerQuery, useEc2UsageExplorerV2Query } from "../../hooks/useDashboardQueries";
import type { Ec2CostExplorerV2FiltersQuery, Ec2DataTransferExplorerV2FiltersQuery, Ec2ExplorerFiltersQuery, Ec2UsageExplorerV2FiltersQuery } from "../../api/dashboardApi";
import {
  EC2_EXPLORER_DEFAULT_CONTROLS,
  EC2CostExplorerFilters,
  EC2DataTransferExplorerFilters,
  EC2ExplorerChart,
  EC2ExplorerTable,
  EC2ExplorerTopControls,
  EC2UsageExplorerFilters,
  EC2SummaryCards,
  type UsageYAxisKey,
} from "./components";
import {
  EC2_COST_TYPE_COLORS,
  EC2_COST_TYPE_LABELS,
  EC2_COST_TYPE_ORDER,
  normalizeEc2CostTypeKey,
  METRIC_OPTIONS,
  type EC2ExplorerControlsState,
  getValidGroupByForMetric,
} from "./ec2ExplorerControls.types";

const toApiGroupBy = (
  groupBy: EC2ExplorerControlsState["groupBy"],
): Ec2ExplorerFiltersQuery["groupBy"] =>
  groupBy === "instance-type"
    ? "instance_type"
    : groupBy === "reservation-type"
      ? "reservation_type"
      : groupBy === "cost-category"
        ? "cost_category"
      : groupBy === "availability-zone"
        ? "availability_zone"
        : groupBy === "usage-type"
          ? "usage_type"
          : groupBy === "transfer-type"
            ? "transfer_type"
            : groupBy === "source-region"
              ? "source_region"
              : groupBy === "destination-region"
                ? "destination_region"
            : groupBy === "instance-state"
              ? "instance_state"
              : groupBy;

const toApiCostBasis = (
  costBasis: EC2ExplorerControlsState["costBasis"],
): Ec2ExplorerFiltersQuery["costBasis"] => costBasis;

const toCostV2Basis = (
  costBasis: EC2ExplorerControlsState["costBasis"],
): Ec2CostExplorerV2FiltersQuery["costBasis"] =>
  costBasis === "billed_cost"
    ? "gross_cost"
    : costBasis === "amortized_cost"
      ? "amortized_cost"
      : costBasis === "net_amortized_cost" || costBasis === "net_unblended_cost"
        ? "net_cost"
        : "effective_cost";

const toCostV2GroupBy = (
  groupBy: EC2ExplorerControlsState["groupBy"],
): Ec2CostExplorerV2FiltersQuery["groupBy"] =>
  groupBy === "cost-category"
    ? "cost_type"
    : groupBy === "instance"
      ? "instance"
    : groupBy === "instance-type"
      ? "instance_type"
      : groupBy === "reservation-type"
        ? "reservation_type"
        : groupBy === "account" || groupBy === "region" || groupBy === "tag" || groupBy === "none"
          ? groupBy
          : "none";

const toCostV2GranularityFromGlobal = (
  granularity: string | null | undefined,
): Ec2CostExplorerV2FiltersQuery["granularity"] => {
  const normalized = String(granularity ?? "").trim().toLowerCase();
  if (normalized === "weekly") return "weekly";
  if (normalized === "monthly") return "monthly";
  return "daily";
};

const toCostV2Compare = (
  compare: EC2ExplorerControlsState["compare"],
): Ec2CostExplorerV2FiltersQuery["compare"] => (compare === "previous-period" ? "previous_period" : "none");

const toUsageV2Metric = (usageYAxis: UsageYAxisKey): Ec2UsageExplorerV2FiltersQuery["usageMetric"] =>
  usageYAxis === "network_in"
    ? "network_in"
    : usageYAxis === "network_out"
      ? "network_out"
      : usageYAxis === "network_total"
        ? "network_total"
        : "cpu";
const toUsageV2Aggregation = (usageYAxis: UsageYAxisKey): Ec2UsageExplorerV2FiltersQuery["aggregation"] =>
  usageYAxis === "avg_cpu" ? "avg" : usageYAxis === "max_cpu" ? "max" : "sum";
const toUsageV2GroupBy = (groupBy: EC2ExplorerControlsState["groupBy"]): Ec2UsageExplorerV2FiltersQuery["groupBy"] =>
  groupBy === "instance-type"
    ? "instance_type"
    : groupBy === "account" || groupBy === "region" || groupBy === "instance" || groupBy === "tag" || groupBy === "none"
      ? groupBy
      : "none";
const toDataTransferV2GroupBy = (groupBy: EC2ExplorerControlsState["groupBy"]): Ec2DataTransferExplorerV2FiltersQuery["groupBy"] =>
  groupBy === "transfer-type"
    ? "transfer_type"
    : groupBy === "account" || groupBy === "region" || groupBy === "instance" || groupBy === "tag"
      ? groupBy
      : "transfer_type";

const toApiAggregation = (
  aggregation: EC2ExplorerControlsState["usageAggregation"],
): Ec2ExplorerFiltersQuery["aggregation"] => aggregation;

const toApiMetric = (
  metric: EC2ExplorerControlsState["metric"],
): Ec2ExplorerFiltersQuery["metric"] => (metric === "data-transfer" ? "data_transfer" : metric);

const parseNumberOrNull = (value: string): number | null => {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const defaultSummary = {
  totalCost: 0,
  previousCost: 0,
  trendPercent: 0,
  instanceCount: 0,
  volumeCount: 0,
  attachedInstanceCount: 0,
  unattachedVolumeCount: 0,
  storageGb: 0,
  storageGbHours: 0,
  avgCpu: 0,
  totalNetworkGb: 0,
};

const INSTANCE_LIST_PATH = "/dashboard/inventory/aws/ec2/instances";
const VOLUMES_LIST_PATH = "/dashboard/inventory/aws/ec2/volumes";
const OPTIMIZATION_PAGE_PATH = "/dashboard/ec2/optimization";
const ELASTIC_IP_PAGE_PATH = "/dashboard/ec2/network/elastic-ip";

const toQueryGroupBy = (groupBy: EC2ExplorerControlsState["groupBy"]): string =>
  groupBy === "instance-type"
    ? "instance_type"
    : groupBy === "reservation-type"
      ? "reservation_type"
      : groupBy === "cost-category"
          ? "cost_category"
          : groupBy === "availability-zone"
            ? "availability_zone"
            : groupBy === "usage-type"
              ? "usage_type"
              : groupBy === "transfer-type"
                ? "transfer_type"
                : groupBy === "source-region"
                  ? "source_region"
                  : groupBy === "destination-region"
                    ? "destination_region"
              : groupBy === "instance-state"
                  ? "instance_state"
                  : groupBy;

const normalizeReservationType = (value: string): string | null => {
  const normalized = value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized === "on_demand" || normalized === "reserved" || normalized === "savings_plan" || normalized === "spot") {
    return normalized;
  }
  return null;
};

const toIsoDate = (value: string): string => value.slice(0, 10);
const startOfWeekIso = (value: string): string => {
  const date = new Date(`${toIsoDate(value)}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
};
const startOfMonthIso = (value: string): string => `${toIsoDate(value).slice(0, 7)}-01`;
const buildDateBuckets = (startDate: string, endDate: string, granularity: Ec2CostExplorerV2FiltersQuery["granularity"]): string[] => {
  const start = new Date(`${toIsoDate(startDate)}T00:00:00.000Z`);
  const end = new Date(`${toIsoDate(endDate)}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return [];
  const buckets: string[] = [];
  if (granularity === "monthly") {
    const cursor = new Date(`${startOfMonthIso(startDate)}T00:00:00.000Z`);
    while (cursor <= end) {
      buckets.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return buckets;
  }
  if (granularity === "weekly") {
    const cursor = new Date(`${startOfWeekIso(startDate)}T00:00:00.000Z`);
    while (cursor <= end) {
      buckets.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return buckets;
  }
  const cursor = new Date(start);
  while (cursor <= end) {
    buckets.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
};

export default function EC2ExplorerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { scope } = useDashboardScope();
  const scopeParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const scopeStartDate =
    scope?.from ??
    scopeParams.get("from") ??
    scopeParams.get("billingPeriodStart") ??
    scopeParams.get("startDate") ??
    undefined;
  const dataTransferDebugEnabled = useMemo(
    () => ["1", "true", "yes", "on"].includes((scopeParams.get("debugDataTransfer") ?? "").trim().toLowerCase()),
    [scopeParams],
  );
  const scopeEndDate =
    scope?.to ??
    scopeParams.get("to") ??
    scopeParams.get("billingPeriodEnd") ??
    scopeParams.get("endDate") ??
    undefined;
  const globalGranularity = useMemo(
    () => toCostV2GranularityFromGlobal(scopeParams.get("granularity")),
    [scopeParams],
  );

  const initialControls = useMemo<EC2ExplorerControlsState>(() => {
    const params = new URLSearchParams(location.search);
    const metricParam = params.get("metric");
    const groupByParam = params.get("groupBy");
    const usageTypeParam = params.get("usageType");
    const metric =
      metricParam === "data_transfer" || metricParam === "data-transfer"
        ? "data-transfer"
        : metricParam === "cost" || metricParam === "usage" || metricParam === "instances" || metricParam === "volumes"
          ? metricParam
          : EC2_EXPLORER_DEFAULT_CONTROLS.metric;
    const rawGroupBy =
      groupByParam === "transfer_type"
        ? "transfer-type"
        : groupByParam === "source_region"
          ? "source-region"
          : groupByParam === "destination_region"
            ? "destination-region"
            : groupByParam === "instance_type"
              ? "instance-type"
              : groupByParam === "reservation_type"
                ? "reservation-type"
                : groupByParam === "cost_category"
                  || groupByParam === "cost_type"
                  || groupByParam === "cost-type"
                  ? "cost-category"
                  : groupByParam === "availability_zone"
                    ? "availability-zone"
                    : groupByParam === "usage_type"
                      ? "usage-type"
                      : groupByParam === "instance_state"
                        ? "instance-state"
                        : (groupByParam as EC2ExplorerControlsState["groupBy"]) ?? EC2_EXPLORER_DEFAULT_CONTROLS.groupBy;
    const groupBy = getValidGroupByForMetric(metric, rawGroupBy);
    const usageType = usageTypeParam === "network" || usageTypeParam === "disk" || usageTypeParam === "cpu"
      ? usageTypeParam
      : EC2_EXPLORER_DEFAULT_CONTROLS.usageType;
    return {
      ...EC2_EXPLORER_DEFAULT_CONTROLS,
      metric,
      groupBy: metric === "data-transfer" && groupBy === "none" ? "transfer-type" : groupBy,
      usageType,
    };
  }, [location.search]);
  const [controls, setControls] = useState<EC2ExplorerControlsState>(initialControls);
  const [usageYAxis, setUsageYAxis] = useState<UsageYAxisKey>("avg_cpu");
  useEffect(() => {
    if (controls.metric !== "volumes") return;
    const next = new URLSearchParams(location.search);
    navigate({ pathname: VOLUMES_LIST_PATH, search: next.toString() }, { replace: true });
  }, [controls.metric, location.search, navigate]);
  const filters = useMemo(
    () => ({
      startDate: scopeStartDate,
      endDate: scopeEndDate,
      metric: toApiMetric(controls.metric),
      granularity: controls.granularity,
      volumeView: controls.metric === "volumes" ? controls.volumeView : undefined,
      groupBy: toApiGroupBy(controls.groupBy),
      tagKey: controls.groupBy === "tag" ? controls.scopeFilters.tags[0] ?? "owner" : null,
      regions: controls.scopeFilters.region,
      tags: controls.scopeFilters.tags.map((tagValue) => `tag:${tagValue}`),
      costBasis: controls.metric === "cost" || controls.metric === "data-transfer" ? toApiCostBasis(controls.costBasis) : undefined,
      usageType: controls.metric === "usage" || controls.metric === "data-transfer" ? controls.usageType : undefined,
      aggregation: controls.metric === "usage" || controls.metric === "data-transfer" ? toApiAggregation(controls.usageAggregation) : undefined,
      condition: controls.metric === "instances" ? controls.instancesCondition : undefined,
      groupValues: controls.groupByValues,
      minCost: parseNumberOrNull(controls.thresholds.costMin),
      maxCost: parseNumberOrNull(controls.thresholds.costMax),
      minCpu: parseNumberOrNull(controls.thresholds.cpuMin),
      maxCpu: parseNumberOrNull(controls.thresholds.cpuMax),
      minNetwork: parseNumberOrNull(controls.thresholds.networkMin),
      maxNetwork: parseNumberOrNull(controls.thresholds.networkMax),
      states: controls.instancesState ? [controls.instancesState] : [],
      instanceTypes: controls.instanceType && controls.instanceType !== "all" ? [controls.instanceType] : [],
      debugDataTransfer: controls.metric === "data-transfer" ? dataTransferDebugEnabled : undefined,
    }),
    [controls, dataTransferDebugEnabled, scopeEndDate, scopeStartDate],
  );

  const isCostMetric = controls.metric === "cost";
  const isUsageMetric = controls.metric === "usage";
  const isDataTransferMetric = controls.metric === "data-transfer";
  const costFilters = useMemo<Ec2CostExplorerV2FiltersQuery>(
    () => ({
      startDate: scopeStartDate,
      endDate: scopeEndDate,
      granularity: globalGranularity,
      costBasis: toCostV2Basis(controls.costBasis),
      groupBy: toCostV2GroupBy(controls.groupBy),
      tagKey: controls.groupBy === "tag" ? controls.scopeFilters.tags[0] ?? "owner" : null,
      compare: toCostV2Compare(controls.compare),
      accountIds: [],
      regions: controls.scopeFilters.region,
      instanceTypes: controls.instanceType && controls.instanceType !== "all" ? [controls.instanceType] : [],
      reservationTypes: [],
      costTypes: [],
      tags: controls.scopeFilters.tags,
    }),
    [controls, globalGranularity, scopeEndDate, scopeStartDate],
  );
  const legacyQuery = useEc2ExplorerQuery(
    filters,
    Boolean(scope) && !isCostMetric && !isDataTransferMetric,
  );
  const costV2Query = useEc2CostExplorerV2Query(costFilters, Boolean(scope) && isCostMetric);
  const usageV2Filters = useMemo<Ec2UsageExplorerV2FiltersQuery>(
    () => ({
      startDate: scopeStartDate,
      endDate: scopeEndDate,
      granularity: globalGranularity,
      usageMetric: toUsageV2Metric(usageYAxis),
      aggregation: toUsageV2Aggregation(usageYAxis),
      groupBy: toUsageV2GroupBy(controls.groupBy),
      tagKey: controls.groupBy === "tag" ? controls.scopeFilters.tags[0] ?? "owner" : null,
      compare: toCostV2Compare(controls.compare),
      accountIds: [],
      regions: controls.scopeFilters.region,
      instanceTypes: controls.instanceType && controls.instanceType !== "all" ? [controls.instanceType] : [],
      tags: controls.scopeFilters.tags,
    }),
    [controls, globalGranularity, scopeEndDate, scopeStartDate, usageYAxis],
  );
  const usageV2Query = useEc2UsageExplorerV2Query(usageV2Filters, Boolean(scope) && isUsageMetric);
  const dataTransferV2Filters = useMemo<Ec2DataTransferExplorerV2FiltersQuery>(
    () => ({
      startDate: scopeStartDate,
      endDate: scopeEndDate,
      granularity: globalGranularity,
      yAxis: controls.usageType === "network" ? "transfer_cost" : "usage_gb",
      groupBy: toDataTransferV2GroupBy(controls.groupBy),
      tagKey: controls.groupBy === "tag" ? controls.scopeFilters.tags[0] ?? "owner" : null,
      compare: toCostV2Compare(controls.compare),
      accountIds: [],
      regions: controls.scopeFilters.region,
      instanceTypes: controls.instanceType && controls.instanceType !== "all" ? [controls.instanceType] : [],
      transferTypes: [],
      tags: controls.scopeFilters.tags,
    }),
    [controls, globalGranularity, scopeEndDate, scopeStartDate],
  );
  const dataTransferV2Query = useEc2DataTransferExplorerV2Query(dataTransferV2Filters, Boolean(scope) && isDataTransferMetric);
  const shouldUseUsageV2 = isUsageMetric && Boolean(usageV2Query.data) && !usageV2Query.isError;
  const query = isCostMetric
    ? costV2Query
    : isUsageMetric
      ? (shouldUseUsageV2 ? usageV2Query : legacyQuery)
      : isDataTransferMetric
        ? dataTransferV2Query
        : legacyQuery;
  const hasExplorerData = Boolean(query.data);
  const isSectionLoading = query.isFetching || !hasExplorerData;
  const dataTransferView = controls.metric === "data-transfer"
    ? controls.usageType === "disk"
      ? "usage"
      : controls.usageType === "cpu"
        ? "distribution"
        : "cost"
    : null;
  const dataTransferValueKey = dataTransferView === "usage"
    ? "usage_gb"
    : dataTransferView === "distribution"
      ? "percent_share"
      : dataTransferView === "cost"
        ? "cost"
        : null;
  useEffect(() => {
    if (controls.metric !== "data-transfer" || !dataTransferDebugEnabled || !dataTransferV2Query.data) return;
    console.debug("[EC2 Explorer][Data Transfer V2][Source Debug]", {
      selectedView: dataTransferView,
      selectedValueKey: dataTransferValueKey,
      source: dataTransferV2Query.data.meta?.source ?? "data_transfer_explorer",
      hasTransferUsage: dataTransferV2Query.data.meta?.hasTransferUsage ?? false,
      hasTransferCost: dataTransferV2Query.data.meta?.hasTransferCost ?? false,
      transferCost: dataTransferV2Query.data.kpis.transferCost ?? 0,
      usageGb: dataTransferV2Query.data.kpis.usageGb ?? 0,
      rows: dataTransferV2Query.data.table.rows.length,
      series: dataTransferV2Query.data.chart.series.length,
    });
  }, [controls.metric, dataTransferDebugEnabled, dataTransferValueKey, dataTransferView, dataTransferV2Query.data]);
  const resolvedGraphType = useMemo<"line" | "stacked_bar">(
    () => controls.chartType,
    [controls.chartType],
  );

  useEffect(() => {
    if (!isCostMetric) return;
    console.debug("[EC2 Explorer Cost V2][Global Filter]", {
      startDate: scopeStartDate,
      endDate: scopeEndDate,
      granularity: globalGranularity,
    });
    console.debug("[EC2 Explorer Cost V2][Request]", costFilters);
    console.debug("[EC2 Explorer Cost V2][Selection]", {
      costBasis: costFilters.costBasis,
      groupBy: costFilters.groupBy,
    });
  }, [costFilters, globalGranularity, isCostMetric, scopeEndDate, scopeStartDate]);

  useEffect(() => {
    if (!isUsageMetric) return;
    console.debug("[EC2 Explorer Usage V2][Global Filter]", {
      startDate: scopeStartDate,
      endDate: scopeEndDate,
      granularity: globalGranularity,
    });
    console.debug("[EC2 Explorer Usage V2][Request]", usageV2Filters);
    console.debug("[EC2 Explorer Usage V2][Selection]", {
      usageMetric: usageV2Filters.usageMetric,
      aggregation: usageV2Filters.aggregation,
      groupBy: usageV2Filters.groupBy,
    });
  }, [globalGranularity, isUsageMetric, scopeEndDate, scopeStartDate, usageV2Filters]);

  useEffect(() => {
    if (!isCostMetric || !costV2Query.data) return;
    console.debug("[EC2 Explorer Cost V2][Response]", costV2Query.data);
    console.debug("[EC2 Explorer Cost V2][Counts]", {
      chartSeriesCount: costV2Query.data.chart.series.length,
      tableRowCount: costV2Query.data.table.rows.length,
    });
  }, [costV2Query.data, isCostMetric]);

  useEffect(() => {
    if (!isUsageMetric || !usageV2Query.data) return;
    console.debug("[EC2 Explorer Usage V2][Response]", usageV2Query.data);
    console.debug("[EC2 Explorer Usage V2][Response.Chart]", usageV2Query.data.chart);
    console.debug("[EC2 Explorer Usage V2][Response.TableRows]", usageV2Query.data.table.rows);
    console.debug("[EC2 Explorer Usage V2][Response.KPIs]", usageV2Query.data.kpis);
    console.debug("[EC2 Explorer Usage V2][Counts]", {
      chartSeriesCount: usageV2Query.data.chart.series.length,
      totalChartPoints: usageV2Query.data.chart.series.reduce((sum, series) => sum + series.points.length, 0),
      tableRowCount: usageV2Query.data.table.rows.length,
    });
  }, [isUsageMetric, usageV2Query.data]);

  useEffect(() => {
    if (!isUsageMetric) return;
    console.debug("[EC2 Explorer Usage V2][Source]", {
      usingV2: shouldUseUsageV2,
      v2Error: usageV2Query.isError ? usageV2Query.error?.message ?? "error" : null,
      legacyHasData: Boolean(legacyQuery.data),
    });
  }, [isUsageMetric, legacyQuery.data, shouldUseUsageV2, usageV2Query.error, usageV2Query.isError]);

  const costV2Mapped = useMemo(() => {
    if (!isCostMetric || !costV2Query.data) return null;
    const response = costV2Query.data;
    const isCostTypeMode = controls.groupBy === "cost-category";
    const dateBuckets =
      scopeStartDate && scopeEndDate
        ? buildDateBuckets(scopeStartDate, scopeEndDate, costFilters.granularity ?? "daily")
        : [];
    const baseRows = response.table.rows.map((row) => ({
      id: (() => {
        if (!isCostTypeMode) return row.groupKey;
        const normalized = normalizeEc2CostTypeKey(String(row.groupKey ?? row.groupLabel ?? ""));
        return normalized ?? row.groupKey;
      })(),
      group: (() => {
        if (!isCostTypeMode) return row.groupLabel;
        const normalized = normalizeEc2CostTypeKey(String(row.groupKey ?? row.groupLabel ?? ""));
        return normalized ? EC2_COST_TYPE_LABELS[normalized] : row.groupLabel;
      })(),
      grossCost: Number(row.grossCost ?? 0),
      computeCost: Number(row.computeCost ?? 0),
      volumeCost: Number((row as { volumeCost?: number; ebsCost?: number }).volumeCost ?? (row as { ebsCost?: number }).ebsCost ?? 0),
      snapshotCost: Number(row.snapshotCost ?? 0),
      dataTransferCost: Number(row.dataTransferCost ?? 0),
      elasticIpCost: Number((row as { elasticIpCost?: number; eipCost?: number }).elasticIpCost ?? (row as { eipCost?: number }).eipCost ?? 0),
      otherCost: Number(row.otherCost ?? 0),
      instanceCount: Number(row.instanceCount ?? 0),
      percentOfTotal: Number(row.percentOfTotal ?? 0),
      mainCostDriver: row.mainCostDriver,
    }));
    const valueFilter = new Set((controls.groupByValues ?? []).map((value) => value.toLowerCase()));
    const valueFilteredRows = valueFilter.size > 0
      ? baseRows.filter((row) => valueFilter.has(String(row.group ?? "").toLowerCase()))
      : baseRows;
    const filteredRows = isCostTypeMode
      ? valueFilteredRows.filter((row) => {
          const hasMonetaryValue =
            row.grossCost > 0
            || row.computeCost > 0
            || row.volumeCost > 0
            || row.snapshotCost > 0
            || row.dataTransferCost > 0
            || row.elasticIpCost > 0
            || row.otherCost > 0;
          return hasMonetaryValue || row.instanceCount > 0;
        })
      : valueFilteredRows;
    const columns = [
      { key: "group", label: controls.groupBy === "instance" ? "Instance" : controls.groupBy === "instance-type" ? "Instance Type" : controls.groupBy === "region" ? "Region" : controls.groupBy === "reservation-type" ? "Reservation Type" : "Group" },
      { key: "grossCost", label: "Gross Cost" },
      { key: "computeCost", label: "Compute Cost" },
      { key: "volumeCost", label: "Volume Cost" },
      { key: "snapshotCost", label: "Snapshot Cost" },
      { key: "dataTransferCost", label: "Data Transfer Cost" },
      { key: "elasticIpCost", label: "Elastic IP Cost" },
      { key: "otherCost", label: "Other Cost" },
      { key: "percentOfTotal", label: "% of EC2 Cost" },
      { key: "mainCostDriver", label: "Main Cost Driver" },
    ];

    return {
      summary: {
        totalCost: response.kpis.grossCost ?? 0,
        previousCost: response.kpis.netCost ?? 0,
        trendPercent: 0,
        instanceCount: response.kpis.instanceCount ?? 0,
        volumeCount: 0,
        attachedInstanceCount: 0,
        unattachedVolumeCount: 0,
        storageGb: 0,
        storageGbHours: 0,
        avgCpu: 0,
        totalNetworkGb: 0,
      },
      graph: {
        type: resolvedGraphType,
        xKey: "date" as const,
        series: (() => {
          const rawSeries = response.chart.series.map((series) => {
            const pointMap = new Map(
              series.points.map((point) => [point.date, Number(point.value ?? 0)]),
            );
            const filledBuckets = dateBuckets.length > 0 ? dateBuckets : series.points.map((point) => point.date);
            const data = filledBuckets.map((date) => ({ date, value: pointMap.get(date) ?? 0 }));
            const normalizedCostType = isCostTypeMode
              ? normalizeEc2CostTypeKey(String(series.groupKey ?? series.groupLabel ?? ""))
              : null;
            return {
              key: normalizedCostType ?? series.groupKey,
              label: normalizedCostType ? EC2_COST_TYPE_LABELS[normalizedCostType] : series.groupLabel,
              data,
            };
          });
          if (!isCostTypeMode) return rawSeries;
          const rowByKey = new Map(
            filteredRows.map((row) => [String(row.id ?? "").trim().toLowerCase(), row]),
          );
          return rawSeries.filter((series) => {
            const seriesTotal = series.data.reduce((sum, point) => sum + Number(point.value ?? 0), 0);
            const row = rowByKey.get(String(series.key).trim().toLowerCase());
            const hasRowActivity = Boolean(
              row
              && (
                row.grossCost > 0
                || row.computeCost > 0
                || row.volumeCost > 0
                || row.snapshotCost > 0
                || row.dataTransferCost > 0
                || row.elasticIpCost > 0
                || row.otherCost > 0
                || row.instanceCount > 0
              ),
            );
            return seriesTotal > 0 || hasRowActivity;
          });
        })(),
      },
      table: {
        columns,
        rows: filteredRows,
      },
      kpis: response.kpis,
    };
  }, [controls.groupBy, controls.groupByValues, costFilters.granularity, costV2Query.data, isCostMetric, resolvedGraphType, scopeEndDate, scopeStartDate]);

  const usageV2Mapped = useMemo(() => {
    if (!isUsageMetric || !usageV2Query.data) return null;
    const response = usageV2Query.data;
    const dateBuckets =
      scopeStartDate && scopeEndDate
        ? buildDateBuckets(scopeStartDate, scopeEndDate, usageV2Filters.granularity ?? "daily")
        : [];
    const rows = response.table.rows.map((row) => ({
      id: row.groupKey,
      group: row.groupLabel,
      avgCpu: row.avgCpu == null ? null : Number(row.avgCpu),
      maxCpu: row.maxCpu == null ? null : Number(row.maxCpu),
      networkInGb: Number(row.networkInGb ?? 0),
      networkOutGb: Number(row.networkOutGb ?? 0),
      networkTotalGb: Number(row.networkTotalGb ?? 0),
      instanceCount: Number(row.instanceCount ?? 0),
    }));
    const columns = controls.groupBy === "instance"
      ? [
          { key: "group", label: "Instance" },
          { key: "avgCpu", label: "Avg CPU" },
          { key: "maxCpu", label: "Max CPU" },
          { key: "networkInGb", label: "Network In" },
          { key: "networkOutGb", label: "Network Out" },
          { key: "networkTotalGb", label: "Network Total" },
        ]
      : [
          { key: "group", label: "Group" },
          { key: "avgCpu", label: "Avg CPU" },
          { key: "maxCpu", label: "Max CPU" },
          { key: "networkInGb", label: "Network In" },
          { key: "networkOutGb", label: "Network Out" },
          { key: "networkTotalGb", label: "Network Total" },
          { key: "instanceCount", label: "Instance Count" },
        ];
    return {
      summary: {
        totalCost: 0,
        previousCost: 0,
        trendPercent: 0,
        instanceCount: response.kpis.instanceCount ?? 0,
        volumeCount: 0,
        attachedInstanceCount: 0,
        unattachedVolumeCount: 0,
        storageGb: 0,
        storageGbHours: 0,
        avgCpu: response.kpis.avgCpu ?? 0,
        totalNetworkGb: Number((response.kpis as { networkTotalGb?: number | null }).networkTotalGb ?? 0),
      },
      graph: {
        type: resolvedGraphType,
        xKey: "date" as const,
        series: response.chart.series.map((series) => ({
          key: series.groupKey,
          label: series.groupLabel,
          data: (() => {
            const pointMap = new Map(series.points.map((point) => [point.date, point.value == null ? null : Number(point.value)]));
            const filledBuckets = dateBuckets.length > 0 ? dateBuckets : series.points.map((point) => point.date);
            return filledBuckets.map((date) => ({ date, value: pointMap.has(date) ? pointMap.get(date) ?? null : null }));
          })(),
        })),
      },
      table: { columns, rows },
      usageKpis: response.kpis,
    };
  }, [controls.groupBy, isUsageMetric, resolvedGraphType, scopeEndDate, scopeStartDate, usageV2Filters.granularity, usageV2Query.data]);
  const dataTransferV2Mapped = useMemo(() => {
    if (!isDataTransferMetric || !dataTransferV2Query.data) return null;
    const response = dataTransferV2Query.data;
    const isTransferTypeGrouping = controls.groupBy === "transfer-type";
    const selectedView = dataTransferV2Filters.yAxis;
    const hasTransferUsage = Boolean(response.meta?.hasTransferUsage ?? Number(response.kpis.usageGb ?? 0) > 0);
    const hasTransferCost = Boolean(response.meta?.hasTransferCost ?? Number(response.kpis.transferCost ?? 0) > 0);
    const shouldUseUsageFallback =
      selectedView === "transfer_cost"
      && Number(response.kpis.transferCost ?? 0) === 0
      && Number(response.kpis.usageGb ?? 0) > 0;
    const effectiveChartMetric: "transfer_cost" | "usage_gb" = shouldUseUsageFallback ? "usage_gb" : selectedView;
    const dateBuckets =
      scopeStartDate && scopeEndDate
        ? buildDateBuckets(scopeStartDate, scopeEndDate, dataTransferV2Filters.granularity ?? "daily")
        : [];
    const filteredRows = response.table.rows.filter((row) => Number(row.usageGb ?? 0) > 0 || Number(row.transferCost ?? 0) > 0);
    const firstChartPointBefore = response.chart.series[0]?.points[0] ?? null;
    const mappedSeries = response.chart.series.map((series) => ({
      key: series.groupKey,
      label: series.groupLabel,
      data: (() => {
        const pointMap = new Map(
          series.points.map((point) => [point.date, {
            value: Number(point.value ?? 0),
            usageGb: Number((point as { usageGb?: number; usage_gb?: number }).usageGb ?? (point as { usage_gb?: number }).usage_gb ?? 0),
            transferCost: Number((point as { transferCost?: number; transfer_cost?: number }).transferCost ?? (point as { transfer_cost?: number }).transfer_cost ?? 0),
          }]),
        );
        const filledBuckets = dateBuckets.length > 0 ? dateBuckets : series.points.map((point) => point.date);
        return filledBuckets.map((date) => {
          const point = pointMap.get(date);
          const usageGb = point?.usageGb ?? 0;
          const transferCost = point?.transferCost ?? point?.value ?? 0;
          const valueForEffectiveMetric = effectiveChartMetric === "usage_gb" ? usageGb : transferCost;
          return {
            date,
            value: valueForEffectiveMetric,
            usage_gb: usageGb,
            transfer_cost: transferCost,
            cost: transferCost,
            valueForEffectiveMetric,
          };
        });
      })(),
    }));
    const hasRenderableChartData = mappedSeries.some((series) =>
      series.data.some((point) => Number(point.valueForEffectiveMetric ?? 0) > 0),
    );
    const firstChartPointAfter = mappedSeries[0]?.data[0] ?? null;
    console.debug("[EC2 Explorer][Data Transfer V2][Fallback Debug]", {
      selectedView,
      transferCost: Number(response.kpis.transferCost ?? 0),
      usageGb: Number(response.kpis.usageGb ?? 0),
      shouldUseUsageFallback,
      effectiveChartMetric,
      firstChartPointBefore,
      firstChartPointAfter,
    });
    return {
      summary: {
        totalCost: response.kpis.transferCost ?? 0,
        previousCost: 0,
        trendPercent: 0,
        instanceCount: 0,
        volumeCount: 0,
        attachedInstanceCount: 0,
        unattachedVolumeCount: 0,
        storageGb: response.kpis.usageGb ?? 0,
        storageGbHours: 0,
        avgCpu: 0,
        totalNetworkGb: response.kpis.usageGb ?? 0,
      },
      graph: {
        type: resolvedGraphType,
        xKey: "date" as const,
        series: hasRenderableChartData
          ? mappedSeries.filter((series) => series.data.some((point) => Number(point.valueForEffectiveMetric ?? 0) > 0))
          : [],
      },
      table: {
        columns: isTransferTypeGrouping
          ? [
              { key: "group", label: "Transfer Type" },
              { key: "transferCost", label: "Transfer Cost" },
              { key: "usageGb", label: "Usage GB" },
              { key: "percentOfTransferCost", label: "% of Total" },
            ]
          : [
              { key: "group", label: "Group" },
              { key: "transferCost", label: "Transfer Cost" },
              { key: "usageGb", label: "Usage GB" },
              { key: "internetCost", label: "Internet Cost" },
              { key: "interRegionCost", label: "Inter-Region Cost" },
              { key: "interAzCost", label: "Inter-AZ Cost" },
              { key: "regionalCost", label: "Regional Cost" },
              { key: "unknownCost", label: "Unknown Cost" },
              { key: "percentOfTransferCost", label: "% of Transfer Cost" },
              { key: "mainDriver", label: "Main Driver" },
            ],
        rows: filteredRows.map((row) => ({
          id: row.groupKey,
          group: row.groupLabel,
          transferCost: Number(row.transferCost ?? 0),
          usageGb: Number(row.usageGb ?? 0),
          internetCost: Number(row.internetCost ?? 0),
          interRegionCost: Number(row.interRegionCost ?? 0),
          interAzCost: Number(row.interAzCost ?? 0),
          regionalCost: Number(row.regionalCost ?? 0),
          unknownCost: Number(row.unknownCost ?? 0),
          percentOfTransferCost: Number(row.percentOfTransferCost ?? 0),
          mainDriver: row.mainDriver ?? "Unknown",
        })),
      },
      transferKpis: response.kpis,
      transferFlags: {
        hasTransferUsage,
        hasTransferCost,
        useUsageFallback: shouldUseUsageFallback,
        effectiveChartMetric,
        hasRenderableChartData,
      },
    };
  }, [controls.groupBy, dataTransferV2Filters.granularity, dataTransferV2Filters.yAxis, dataTransferV2Query.data, isDataTransferMetric, resolvedGraphType, scopeEndDate, scopeStartDate]);

  const explorerData = isCostMetric ? costV2Mapped : isUsageMetric ? usageV2Mapped : isDataTransferMetric ? dataTransferV2Mapped : legacyQuery.data;

  const metricLabel = METRIC_OPTIONS.find((option) => option.key === controls.metric)?.label ?? "Cost";
  const costYAxisLabel =
    controls.costBasis === "billed_cost"
      ? "Gross Cost ($)"
      : controls.costBasis === "net_unblended_cost" || controls.costBasis === "net_amortized_cost"
        ? "Net Cost ($)"
        : controls.costBasis === "amortized_cost"
          ? "Amortized Cost ($)"
          : "Effective Cost ($)";
  const usageYAxisLabel =
    usageYAxis === "avg_cpu"
      ? "Avg CPU (%)"
      : usageYAxis === "max_cpu"
        ? "Max CPU (%)"
        : usageYAxis === "network_in"
          ? "Network In (GB)"
        : usageYAxis === "network_out"
          ? "Network Out (GB)"
          : "Network Total (GB)";
  const dataTransferHasUsage = Boolean(dataTransferV2Mapped?.transferFlags.hasTransferUsage);
  const dataTransferHasCost = Boolean(dataTransferV2Mapped?.transferFlags.hasTransferCost);
  const dataTransferUseUsageFallback = Boolean(dataTransferV2Mapped?.transferFlags.useUsageFallback);
  const dataTransferEffectiveChartMetric = (dataTransferV2Mapped?.transferFlags.effectiveChartMetric as "transfer_cost" | "usage_gb" | undefined) ?? dataTransferV2Filters.yAxis;
  const dataTransferYAxisLabel = dataTransferEffectiveChartMetric === "usage_gb" ? "Usage (GB)" : "Transfer Cost ($)";
  useEffect(() => {
    if (!isDataTransferMetric) return;
    const chartUnitFormatter = dataTransferV2Filters.yAxis === "usage_gb" ? "gb" : "currency";
    console.debug("[EC2 Explorer][Data Transfer V2][Formatter Debug]", {
      selectedYAxis: dataTransferV2Filters.yAxis,
      selectedView: dataTransferV2Filters.yAxis === "usage_gb" ? "usage" : "transfer_cost",
      chartUnitFormatter,
    });
  }, [dataTransferV2Filters.yAxis, isDataTransferMetric]);
  const usageUnit: "percent" | "gb" = usageYAxis === "avg_cpu" || usageYAxis === "max_cpu" ? "percent" : "gb";
  const formatCurrency = (value: number): string => {
    const numericValue = Number.isFinite(value) ? value : 0;
    return numericValue > 0 && numericValue < 0.01
      ? numericValue.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 5,
        })
      : numericValue.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  };

  const resetControls = () => {
    setControls(EC2_EXPLORER_DEFAULT_CONTROLS);
  };

  const navigateToInstanceList = (source: "explorer-graph" | "explorer-table", extras: Record<string, string>) => {
    const next = new URLSearchParams(location.search);
    ["selectedDate", "groupValue", "date", "seriesKey", "seriesLabel"].forEach((key) => next.delete(key));
    next.set("source", source);
    if (scopeStartDate) next.set("startDate", scopeStartDate);
    if (scopeEndDate) next.set("endDate", scopeEndDate);
    next.set("metric", controls.metric);
    next.set("groupBy", toQueryGroupBy(controls.groupBy));
    if (controls.groupBy === "tag") {
      const tagKey = controls.groupByValues[0] ?? controls.scopeFilters.tags[0] ?? "owner";
      next.set("tagKey", tagKey);
    } else {
      next.delete("tagKey");
    }
    if (controls.scopeFilters.region.length > 0) {
      next.set("region", controls.scopeFilters.region.join(","));
    } else {
      next.delete("region");
    }
    if (controls.scopeFilters.tags.length > 0) {
      next.set("tags", controls.scopeFilters.tags.join(","));
    } else {
      next.delete("tags");
    }
    if (controls.metric === "instances") {
      next.set("condition", controls.instancesCondition);
      next.set("state", controls.instancesState);
      if (controls.instanceType !== "all") {
        next.set("instanceType", controls.instanceType);
      } else {
        next.delete("instanceType");
      }
    } else {
      next.delete("condition");
      next.delete("state");
      next.delete("instanceType");
    }
    if (controls.metric === "cost") {
      next.set("costBasis", controls.costBasis);
    } else {
      next.delete("costBasis");
    }
    if (controls.metric === "usage") {
      next.set("usageType", controls.usageType);
      next.set("aggregation", controls.usageAggregation);
    } else {
      next.delete("aggregation");
    }
    Object.entries(extras).forEach(([key, value]) => next.set(key, value));
    next.delete("networkType");
    if (extras.groupValue) {
      const groupValue = extras.groupValue.trim();
      if (controls.groupBy === "reservation-type") {
        const reservationType = normalizeReservationType(groupValue);
        if (reservationType) {
          next.set("reservationType", reservationType);
          next.delete("search");
        }
      } else if (controls.groupBy === "instance-type") {
        next.set("instanceType", groupValue);
        next.delete("search");
      } else if (controls.groupBy === "region") {
        next.set("region", groupValue);
        next.delete("search");
      } else if (controls.groupBy === "none") {
        next.set("search", groupValue);
      } else {
        next.delete("search");
      }
    } else {
      next.delete("search");
    }
    navigate({ pathname: INSTANCE_LIST_PATH, search: next.toString() });
  };

  const chips = useMemo(() => {
    const metricLabel = METRIC_OPTIONS.find((option) => option.key === controls.metric)?.label ?? "Cost";
    const configLabel =
      controls.metric === "cost"
        ? controls.costBasis === "amortized_cost"
          ? "Amortized Cost"
          : controls.costBasis === "net_amortized_cost"
            ? "Net Amortized Cost"
            : controls.costBasis === "net_unblended_cost"
              ? "Net Unblended Cost"
          : controls.costBasis === "billed_cost"
            ? "Billed Cost"
            : "Effective Cost"
        : controls.metric === "usage"
          ? controls.usageType === "network"
            ? "Network"
            : controls.usageType === "disk"
              ? "Disk"
              : "CPU"
          : controls.metric === "data-transfer"
            ? controls.usageType === "network"
              ? "Cost"
              : controls.usageType === "disk"
                ? "Usage (GB)"
                : "Distribution"
          : controls.metric === "volumes"
            ? controls.volumeView === "storage_hours"
              ? "Storage Hours"
              : controls.volumeView === "cost"
                ? "Cost"
                : controls.volumeView === "count"
                  ? "Count"
                  : "Storage"
          : controls.instancesCondition === "underutilized"
            ? "Underutilized"
            : controls.instancesCondition === "overutilized"
              ? "Overutilized"
              : controls.instancesCondition === "uncovered"
                ? "Uncovered"
                : controls.instancesCondition === "idle"
                  ? "Idle"
                  : "All";
    const groupByLabel = toApiGroupBy(controls.groupBy).replace(/_/g, " ");
    const stateLabel = controls.instancesState;
    const list: Array<{ id: string; label: string; value: string; onRemove: () => void }> = [
      {
        id: "metric",
        label: "Metric",
        value: metricLabel,
        onRemove: resetControls,
      },
      {
        id: "config",
        label:
          controls.metric === "instances"
            ? "Condition"
            : controls.metric === "usage"
              ? "Usage Metric"
              : controls.metric === "data-transfer"
                ? "View"
              : controls.metric === "volumes"
                ? "View"
                : "Cost Basis",
        value: configLabel,
        onRemove: () =>
          setControls((current) => ({
            ...current,
            costBasis: EC2_EXPLORER_DEFAULT_CONTROLS.costBasis,
            usageType: EC2_EXPLORER_DEFAULT_CONTROLS.usageType,
            volumeView: EC2_EXPLORER_DEFAULT_CONTROLS.volumeView,
            instancesCondition: EC2_EXPLORER_DEFAULT_CONTROLS.instancesCondition,
          })),
      },
      {
        id: "groupBy",
        label: "Group By",
        value: groupByLabel.replace(/\b\w/g, (match) => match.toUpperCase()),
        onRemove: () =>
          setControls((current) => ({
            ...current,
            groupBy: EC2_EXPLORER_DEFAULT_CONTROLS.groupBy,
            groupByValues: [],
          })),
      },
    ];
    if (controls.metric === "instances") {
      list.push({
        id: "state",
        label: "State",
        value: stateLabel.charAt(0).toUpperCase() + stateLabel.slice(1),
        onRemove: () => setControls((current) => ({ ...current, instancesState: EC2_EXPLORER_DEFAULT_CONTROLS.instancesState })),
      });
    }
    if (controls.scopeFilters.region.length > 0) {
      list.push({
        id: "region",
        label: "Region",
        value: `${controls.scopeFilters.region.length} selected`,
        onRemove: () =>
          setControls((current) => ({ ...current, scopeFilters: { ...current.scopeFilters, region: [] } })),
      });
    }
    if (controls.groupByValues.length > 0) {
      list.push({
        id: "groupValues",
        label: "Values",
        value: `${controls.groupByValues.length} selected`,
        onRemove: () => setControls((current) => ({ ...current, groupByValues: [] })),
      });
    }
    return list;
  }, [controls, resetControls]);

  return (
    <div className="dashboard-page cost-explorer-page ec2-explorer-page">
      <section className="ec2-explorer-head-stack" aria-label="EC2 explorer controls and summary">
        {isCostMetric ? (
          <EC2CostExplorerFilters
            value={controls}
            onChange={setControls}
            loading={isSectionLoading}
            availableValues={(costV2Query.data?.table.rows ?? []).map((row) => row.groupLabel)}
          />
        ) : isUsageMetric ? (
          <EC2UsageExplorerFilters
            value={controls}
            onChange={setControls}
            loading={isSectionLoading}
            usageYAxis={usageYAxis}
            onUsageYAxisChange={setUsageYAxis}
            availableValues={(usageV2Query.data?.table.rows ?? []).map((row) => row.groupLabel)}
          />
        ) : isDataTransferMetric ? (
          <EC2DataTransferExplorerFilters
            value={controls}
            onChange={setControls}
            loading={isSectionLoading}
            availableValues={(dataTransferV2Query.data?.table.rows ?? []).map((row) => row.groupLabel)}
          />
        ) : (
        <EC2ExplorerTopControls value={controls} onChange={setControls} loading={isSectionLoading}>
          <div className="cost-explorer-chip-bar" aria-label="Selected filter summary">
            <div className="cost-explorer-chip-row">
              {isSectionLoading ? (
                <>
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--lg" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--md" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--md2" aria-hidden="true" />
                  <span className="ec2-explorer-filter-skeleton-chip ec2-explorer-filter-skeleton-chip--clear" aria-hidden="true" />
                </>
              ) : (
                <>
                  {chips.map((chip) => (
                    <span key={chip.id} className="cost-explorer-chip">
                      <span className="cost-explorer-chip__edit">
                        {chip.label}: {chip.value}
                      </span>
                      <button type="button" className="cost-explorer-chip__remove" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
                        <X size={13} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <button type="button" className="cost-explorer-chip-bar__clear cost-explorer-chip-bar__clear--inline" onClick={resetControls}>
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>
        </EC2ExplorerTopControls>
        )}

        {isCostMetric ? (
          <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="EC2 explorer summary cards">
            <div className="cost-explorer-chart-insights s3-overview-kpi-row">
              {(() => {
                const grossCost = Number(costV2Mapped?.kpis.grossCost ?? 0);
                const netCost = Number(costV2Mapped?.kpis.netCost ?? 0);
                const credits = Math.max(0, Number(costV2Mapped?.kpis.credits ?? 0));
                const instanceCount = Number(costV2Mapped?.kpis.instanceCount ?? 0);
                return [
                  { label: "Gross EC2 Cost", value: formatCurrency(grossCost), tone: "" },
                  {
                    label: "Credits",
                    value: credits > 0 ? `${formatCurrency(credits)} Credit Applied` : formatCurrency(0),
                    tone: " is-positive",
                  },
                  { label: "Net EC2 Cost", value: formatCurrency(netCost), tone: "" },
                  { label: "Total Instances", value: instanceCount.toLocaleString(), tone: "" },
                ];
              })().map((card) => (
                <article key={card.label} className={`cost-explorer-insight-tile s3-overview-kpi-tile${card.tone}${isSectionLoading ? " is-loading" : ""}`}>
                  {isSectionLoading ? (
                    <div className="ec2-explorer-summary__skeleton" aria-hidden="true">
                      <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--label" />
                      <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--value" />
                    </div>
                  ) : (
                    <>
                      <p className="cost-explorer-insight-tile__label">{card.label}</p>
                      <p className="cost-explorer-insight-tile__value">{card.value}</p>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : isUsageMetric ? (
          <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="EC2 usage explorer summary cards">
            <div className="cost-explorer-chart-insights s3-overview-kpi-row">
              {(() => {
                const usageKpis = usageV2Mapped?.usageKpis;
                const avgCpu = Number((usageKpis as { avgCpu?: number | null } | undefined)?.avgCpu ?? 0);
                const maxCpu = Number((usageKpis as { maxCpu?: number | null } | undefined)?.maxCpu ?? 0);
                const networkInGb = Number(
                  (usageKpis as { networkInGb?: number | null; totalNetworkInGb?: number | null } | undefined)?.networkInGb
                  ?? (usageKpis as { totalNetworkInGb?: number | null } | undefined)?.totalNetworkInGb
                  ?? 0,
                );
                const networkOutGb = Number(
                  (usageKpis as { networkOutGb?: number | null; totalNetworkOutGb?: number | null } | undefined)?.networkOutGb
                  ?? (usageKpis as { totalNetworkOutGb?: number | null } | undefined)?.totalNetworkOutGb
                  ?? 0,
                );
                const networkTotalGb = Number(
                  (usageKpis as { networkTotalGb?: number | null } | undefined)?.networkTotalGb
                  ?? (networkInGb + networkOutGb),
                );
                const instanceCount = Number((usageKpis as { instanceCount?: number | null } | undefined)?.instanceCount ?? 0);
                return [
                  { label: "Avg CPU", value: `${avgCpu.toFixed(2)}%`, tone: "" },
                  { label: "Max CPU", value: `${maxCpu.toFixed(2)}%`, tone: "" },
                  { label: "Network Total", value: `${networkTotalGb.toFixed(2)} GB`, tone: "" },
                  { label: "Instances", value: instanceCount.toLocaleString(), tone: "" },
                ];
              })().map((card) => (
                <article key={card.label} className={`cost-explorer-insight-tile s3-overview-kpi-tile${card.tone}${isSectionLoading ? " is-loading" : ""}`}>
                  {isSectionLoading ? (
                    <div className="ec2-explorer-summary__skeleton" aria-hidden="true">
                      <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--label" />
                      <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--value" />
                    </div>
                  ) : (
                    <>
                      <p className="cost-explorer-insight-tile__label">{card.label}</p>
                      <p className="cost-explorer-insight-tile__value">{card.value}</p>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : isDataTransferMetric ? (
          <section className="cost-explorer-kpi-surface s3-overview-kpi-surface" aria-label="EC2 data transfer explorer summary cards">
            <div className="cost-explorer-chart-insights s3-overview-kpi-row">
              {(() => {
                const transferKpis = dataTransferV2Mapped?.transferKpis;
                const isUsageView = dataTransferV2Filters.yAxis === "usage_gb";
                return [
                  { label: "Transfer Cost", value: formatCurrency(Number(transferKpis?.transferCost ?? 0)), tone: "" },
                  { label: "Usage GB", value: `${Number(transferKpis?.usageGb ?? 0).toFixed(2)} GB`, tone: "" },
                  {
                    label: isUsageView ? "Internet Usage" : "Internet Transfer Cost",
                    value: isUsageView
                      ? `${Number(transferKpis?.internetTransferCost ?? 0).toFixed(2)} GB`
                      : formatCurrency(Number(transferKpis?.internetTransferCost ?? 0)),
                    tone: "",
                  },
                  {
                    label: isUsageView ? "Regional Usage" : "Regional Transfer Cost",
                    value: isUsageView
                      ? `${Number(transferKpis?.regionalTransferCost ?? transferKpis?.interRegionInterAzTransferCost ?? 0).toFixed(2)} GB`
                      : formatCurrency(Number(transferKpis?.regionalTransferCost ?? transferKpis?.interRegionInterAzTransferCost ?? 0)),
                    tone: "",
                  },
                ];
              })().map((card) => (
                <article key={card.label} className={`cost-explorer-insight-tile s3-overview-kpi-tile${card.tone}${isSectionLoading ? " is-loading" : ""}`}>
                  {isSectionLoading ? (
                    <div className="ec2-explorer-summary__skeleton" aria-hidden="true">
                      <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--label" />
                      <span className="ec2-explorer-summary__skeleton-line ec2-explorer-summary__skeleton-line--value" />
                    </div>
                  ) : (
                    <>
                      <p className="cost-explorer-insight-tile__label">{card.label}</p>
                      <p className="cost-explorer-insight-tile__value">{card.value}</p>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : (
          <EC2SummaryCards summary={legacyQuery.data?.summary ?? defaultSummary} loading={isSectionLoading} metric={controls.metric} />
        )}
      </section>

      <section className="ec2-explorer-chart-panel" aria-label="EC2 explorer chart panel">
        {isDataTransferMetric && dataTransferUseUsageFallback ? (
          <p className="dashboard-note">
            No billed transfer cost found. Showing transfer usage instead.
          </p>
        ) : null}
        {controls.metric === "data-transfer" && dataTransferDebugEnabled && dataTransferV2Query.data ? (
          <p className="dashboard-note">
            Source: {dataTransferV2Query.data.meta?.source ?? "data_transfer_explorer"} | Usage GB: {Number(dataTransferV2Query.data.kpis.usageGb ?? 0).toFixed(2)} | Transfer Cost: {formatCurrency(Number(dataTransferV2Query.data.kpis.transferCost ?? 0))}
          </p>
        ) : null}
        {(controls.groupBy === "transfer-type" || (controls.metric === "usage" && controls.usageType === "network" && controls.groupBy === "usage-type")) ? (
          <p className="dashboard-note">
            Billed Usage is from AWS billing data and may differ from CloudWatch Network Usage.
          </p>
        ) : null}
        <EC2ExplorerChart
          title={isUsageMetric ? "EC2 Usage Breakdown" : isCostMetric ? "EC2 Cost Breakdown" : isDataTransferMetric ? "EC2 Data Transfer Breakdown" : `${metricLabel} Breakdown`}
          explorerType={isUsageMetric ? "usage" : "cost"}
          unit={isUsageMetric ? usageUnit : isDataTransferMetric ? (dataTransferEffectiveChartMetric === "usage_gb" ? "gb" : "currency") : "currency"}
          chartType={resolvedGraphType}
          canUseStackedBar
          showChartTypeSelector={isCostMetric || isUsageMetric || isDataTransferMetric}
          yAxisLabel={isCostMetric ? costYAxisLabel : isUsageMetric ? usageYAxisLabel : isDataTransferMetric ? dataTransferYAxisLabel : undefined}
          valueMode={
            controls.metric === "data-transfer"
              ? dataTransferUseUsageFallback
                ? "data-transfer-usage"
                : controls.usageType === "disk"
                ? "data-transfer-usage"
                : controls.usageType === "cpu"
                  ? "data-transfer-distribution"
                  : "data-transfer-cost"
              : "default"
          }
          emptyStateMessage={
            isDataTransferMetric && dataTransferHasUsage && !dataTransferHasCost
              ? "Transfer usage detected but no billed transfer cost was found for this period."
              : undefined
          }
          seriesOrder={isCostMetric && controls.groupBy === "cost-category" ? [...EC2_COST_TYPE_ORDER] : undefined}
          seriesColorByKey={isCostMetric && controls.groupBy === "cost-category" ? EC2_COST_TYPE_COLORS : undefined}
          onChartTypeChange={(nextChartType) => {
            setControls((current) => ({ ...current, chartType: nextChartType }));
          }}
          graph={
            explorerData?.graph
              ? {
                  ...explorerData.graph,
                  type: resolvedGraphType,
                }
              : {
                  type: resolvedGraphType,
                  xKey: "date",
                  series: [],
                }
          }
          loading={isSectionLoading}
          error={query.isError ? query.error : null}
          onRetry={() => {
            void query.refetch();
          }}
          onPointClick={({ date, seriesKey, seriesLabel }) => {
            if (!date) return;
            if (
              controls.metric === "cost" &&
              controls.groupBy === "cost-category" &&
              (seriesKey?.trim().toLowerCase() === "data_transfer" || seriesLabel?.trim().toLowerCase() === "data transfer")
            ) {
              setControls((current) => ({ ...current, metric: "data-transfer", groupBy: "transfer-type" }));
              return;
            }
            if (
              controls.metric === "cost" &&
              controls.groupBy === "cost-category" &&
              (seriesKey?.trim().toLowerCase() === "elastic_ip" || seriesLabel?.trim().toLowerCase() === "elastic ip")
            ) {
              const next = new URLSearchParams();
              if (scopeStartDate) next.set("startDate", scopeStartDate);
              if (scopeEndDate) next.set("endDate", scopeEndDate);
              const existing = new URLSearchParams(location.search);
              const region = existing.get("region");
              if (region && region.trim().length > 0) next.set("region", region);
              navigate({ pathname: ELASTIC_IP_PAGE_PATH, search: next.toString() });
              return;
            }
            navigateToInstanceList("explorer-graph", {
              selectedDate: date,
              groupValue: seriesLabel ?? seriesKey ?? "all",
              ...((controls.groupBy === "transfer-type" || controls.groupBy === "usage-type") && seriesLabel ? { networkType: seriesLabel } : {}),
            });
          }}
        />
      </section>

      <section className="ec2-explorer-table-panel" aria-label="EC2 explorer table panel">
        <EC2ExplorerTable
          metric={controls.metric}
          groupBy={controls.groupBy}
          loading={isSectionLoading}
          error={query.isError ? query.error : null}
          table={explorerData?.table ?? null}
          onRetry={() => {
            void query.refetch();
          }}
          onRowClick={(row) => {
            const groupValue =
              controls.groupBy === "none"
                ? String(row.instance ?? row.id)
                : String(row.group ?? row.id);
            const normalizedGroupValue = groupValue.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
            if (controls.metric === "cost" && controls.groupBy === "cost-category" && normalizedGroupValue === "data_transfer") {
              setControls((current) => ({ ...current, metric: "data-transfer", groupBy: "transfer-type" }));
              return;
            }
            if (controls.metric === "cost" && controls.groupBy === "cost-category" && normalizedGroupValue === "elastic_ip") {
              const next = new URLSearchParams();
              if (scopeStartDate) next.set("startDate", scopeStartDate);
              if (scopeEndDate) next.set("endDate", scopeEndDate);
              const existing = new URLSearchParams(location.search);
              const region = existing.get("region");
              if (region && region.trim().length > 0) next.set("region", region);
              navigate({ pathname: ELASTIC_IP_PAGE_PATH, search: next.toString() });
              return;
            }
            navigateToInstanceList("explorer-table", {
              groupValue,
              ...(controls.groupBy === "transfer-type" || controls.groupBy === "usage-type" ? { networkType: groupValue } : {}),
            });
          }}
          onRecommendationClick={() => {
            navigate({ pathname: OPTIMIZATION_PAGE_PATH, search: location.search });
          }}
        />
      </section>
    </div>
  );
}
