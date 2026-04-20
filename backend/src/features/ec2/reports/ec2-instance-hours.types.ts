export type Ec2InstanceHoursQuery = {
  tenantId: string;
  startDate: string;
  endDate: string;
  cloudConnectionId: string | null;
  subAccountKey: number | null;
  regionKey: number | null;
};

export type Ec2InstanceHoursItem = {
  accountName: string;
  instanceId: string;
  instanceName: string | null;
  instanceType: string | null;
  availabilityZone: string | null;
  isSpot: boolean;
  totalHours: number;
  computeCost: number;
};

export type Ec2InstanceHoursResponse = {
  section: "ec2-instance-hours";
  title: "EC2 Instance Hours";
  message: string;
  filtersApplied: {
    tenantId: string;
    startDate: string;
    endDate: string;
    cloudConnectionId: string | null;
    subAccountKey: number | null;
    regionKey: number | null;
  };
  items: Ec2InstanceHoursItem[];
};

