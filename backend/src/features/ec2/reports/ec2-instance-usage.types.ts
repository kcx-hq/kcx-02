export type Ec2InstanceUsageQuery = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId: string | null;
  subAccountKey: number | null;
  regionKey: number | null;
  category: "none" | "region" | "instance_type" | "reservation_type";
};

export type Ec2InstanceUsageItem = {
  date: string;
  category: string | null;
  value: number;
};

export type Ec2InstanceUsageResponse = {
  section: "ec2-instance-usage";
  title: "EC2 Instance Usage";
  message: string;
  filtersApplied: {
    tenantId: string;
    startDate: string;
    endDate: string;
    cloudConnectionId: string | null;
    subAccountKey: number | null;
    regionKey: number | null;
    category: "none" | "region" | "instance_type" | "reservation_type";
    interval: "daily";
    chartType: "bar";
  };
  metric: "instance_count";
  items: Ec2InstanceUsageItem[];
  chart: {
    labels: Array<{
      usageDate: string;
      short: string;
      long: string;
    }>;
    series: Array<{
      name: string;
      kind: "primary";
      values: number[];
    }>;
  };
  summary: {
    totalInstanceDays: number;
    avgDailyInstances: number;
    peakDailyInstances: number;
  };
};
