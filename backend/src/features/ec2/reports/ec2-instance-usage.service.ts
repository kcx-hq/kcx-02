import type { Ec2InstanceUsageResponse, Ec2InstanceUsageQuery } from "./ec2-instance-usage.types.js";
import { Ec2InstanceUsageRepository } from "./ec2-instance-usage.repository.js";

const formatDateLabel = (usageDate: string): { short: string; long: string } => {
  const date = new Date(`${usageDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return { short: usageDate, long: usageDate };
  }

  return {
    short: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }),
    long: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
  };
};

export class Ec2InstanceUsageService {
  private readonly repository: Ec2InstanceUsageRepository;

  constructor(repository: Ec2InstanceUsageRepository = new Ec2InstanceUsageRepository()) {
    this.repository = repository;
  }

  async getEc2InstanceUsage(input: Ec2InstanceUsageQuery): Promise<Ec2InstanceUsageResponse> {
    const items = await this.repository.getDailyInstanceUsage(input);

    const labelByDate = new Map<string, { usageDate: string; short: string; long: string }>();
    items.forEach((item) => {
      if (labelByDate.has(item.date)) return;
      const label = formatDateLabel(item.date);
      labelByDate.set(item.date, {
        usageDate: item.date,
        short: label.short,
        long: label.long,
      });
    });
    const labels = [...labelByDate.values()].sort((left, right) => left.usageDate.localeCompare(right.usageDate));
    const dateIndexByKey = new Map(labels.map((label, index) => [label.usageDate, index]));

    const categoryOrder: string[] = [];
    const seriesByCategory = new Map<string, number[]>();
    const resolveCategory = (value: string | null): string =>
      value && value.trim().length > 0 ? value : "Instance Count";

    items.forEach((item) => {
      const categoryKey = resolveCategory(item.category);
      if (!seriesByCategory.has(categoryKey)) {
        categoryOrder.push(categoryKey);
        seriesByCategory.set(categoryKey, Array(labels.length).fill(0));
      }
      const index = dateIndexByKey.get(item.date);
      if (typeof index !== "number") return;
      const seriesValues = seriesByCategory.get(categoryKey);
      if (!seriesValues) return;
      seriesValues[index] = item.value;
    });

    const chartSeries = categoryOrder.map((name) => ({
      name,
      kind: "primary" as const,
      values: seriesByCategory.get(name) ?? Array(labels.length).fill(0),
    }));
    const totalInstanceDays = items.reduce((sum, item) => sum + item.value, 0);
    const totalByDate = new Map<string, number>();
    items.forEach((item) => {
      totalByDate.set(item.date, (totalByDate.get(item.date) ?? 0) + item.value);
    });
    const peakDailyInstances = [...totalByDate.values()].reduce((peak, value) => Math.max(peak, value), 0);
    const avgDailyInstances = labels.length > 0 ? totalInstanceDays / labels.length : 0;

    return {
      section: "ec2-instance-usage",
      title: "EC2 Instance Usage",
      message: "EC2 instance usage trend loaded",
      filtersApplied: {
        tenantId: input.tenantId,
        startDate: input.startDate,
        endDate: input.endDate,
        cloudConnectionId: input.cloudConnectionId,
        subAccountKey: input.subAccountKey,
        regionKey: input.regionKey,
        category: input.category,
        interval: "daily",
        chartType: "bar",
      },
      metric: "instance_count",
      items,
      chart: {
        labels,
        series: chartSeries,
      },
      summary: {
        totalInstanceDays,
        avgDailyInstances,
        peakDailyInstances,
      },
    };
  }
}
