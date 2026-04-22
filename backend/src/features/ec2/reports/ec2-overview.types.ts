export type Ec2OverviewQuery = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId: string | null;
  subAccountKey: number | null;
  regionKey: number | null;
  instanceType: string | null;
  state: string | null;
};

export type Ec2OverviewKpis = {
  totalInstances: number;
  runningInstances: number;
  stoppedInstances: number;
  idleInstances: number;
  underutilizedInstances: number;
  overutilizedInstances: number;
  totalComputeCost: number;
  totalInstanceHours: number;
};

export type Ec2OverviewTrendPoint = {
  date: string;
  runningInstanceCount: number;
  computeCost: number;
};

export type Ec2OverviewTopCostlyInstance = {
  instanceId: string;
  instanceName: string;
  instanceType: string | null;
  totalHours: number;
  computeCost: number;
  state: string | null;
};

export type Ec2OverviewFilterOptions = {
  instanceTypes: string[];
  states: string[];
};

export type Ec2OverviewResponse = {
  section: "ec2-overview";
  title: "EC2 Overview";
  message: string;
  filtersApplied: {
    tenantId: string;
    startDate: string;
    endDate: string;
    cloudConnectionId: string | null;
    subAccountKey: number | null;
    regionKey: number | null;
    instanceType: string | null;
    state: string | null;
  };
  kpis: Ec2OverviewKpis;
  trends: Ec2OverviewTrendPoint[];
  topCostlyInstances: Ec2OverviewTopCostlyInstance[];
  filterOptions: Ec2OverviewFilterOptions;
};

