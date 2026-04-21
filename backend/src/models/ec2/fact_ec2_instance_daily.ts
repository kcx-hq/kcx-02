import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactEc2InstanceDaily extends Model<InferAttributes<FactEc2InstanceDaily>, InferCreationAttributes<FactEc2InstanceDaily>> {
  declare id: CreationOptional<string>;
  declare tenantId: CreationOptional<string | null>;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare usageDate: string;
  declare instanceId: string;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare instanceName: CreationOptional<string | null>;
  declare instanceType: CreationOptional<string | null>;
  declare availabilityZone: CreationOptional<string | null>;
  declare isSpot: CreationOptional<boolean>;
  declare state: CreationOptional<string | null>;
  declare isRunning: boolean;
  declare totalHours: CreationOptional<string>;
  declare computeCost: CreationOptional<string>;
  declare ebsCost: CreationOptional<string>;
  declare dataTransferCost: CreationOptional<string>;
  declare taxCost: CreationOptional<string>;
  declare creditAmount: CreationOptional<string>;
  declare refundAmount: CreationOptional<string>;
  declare totalBilledCost: CreationOptional<string>;
  declare totalEffectiveCost: CreationOptional<string>;
  declare totalListCost: CreationOptional<string>;
  declare currencyCode: CreationOptional<string | null>;
  declare launchTime: CreationOptional<Date | null>;
  declare deletedAt: CreationOptional<Date | null>;
  declare source: CreationOptional<string | null>;
  declare platform: CreationOptional<string | null>;
  declare platformDetails: CreationOptional<string | null>;
  declare architecture: CreationOptional<string | null>;
  declare tenancy: CreationOptional<string | null>;
  declare asgName: CreationOptional<string | null>;
  declare vpcId: CreationOptional<string | null>;
  declare subnetId: CreationOptional<string | null>;
  declare imageId: CreationOptional<string | null>;
  declare cpuAvg: CreationOptional<string | null>;
  declare cpuMax: CreationOptional<string | null>;
  declare cpuMin: CreationOptional<string | null>;
  declare memoryAvg: CreationOptional<string | null>;
  declare memoryMax: CreationOptional<string | null>;
  declare diskUsedPercentAvg: CreationOptional<string | null>;
  declare diskUsedPercentMax: CreationOptional<string | null>;
  declare networkInBytes: CreationOptional<string | null>;
  declare networkOutBytes: CreationOptional<string | null>;
  declare pricingModel: CreationOptional<"on_demand" | "reserved" | "savings_plan" | "spot" | "other" | null>;
  declare effectiveCost: CreationOptional<string>;
  declare billedCost: CreationOptional<string>;
  declare listCost: CreationOptional<string>;
  declare reservationType: CreationOptional<"on_demand" | "reserved" | "savings_plan" | "spot" | null>;
  declare reservationArn: CreationOptional<string | null>;
  declare savingsPlanArn: CreationOptional<string | null>;
  declare savingsPlanType: CreationOptional<string | null>;
  declare coveredHours: CreationOptional<string>;
  declare uncoveredHours: CreationOptional<string>;
  declare coveredCost: CreationOptional<string>;
  declare uncoveredCost: CreationOptional<string>;
  declare isIdleCandidate: CreationOptional<boolean | null>;
  declare isUnderutilizedCandidate: CreationOptional<boolean | null>;
  declare isOverutilizedCandidate: CreationOptional<boolean | null>;
  declare idleScore: CreationOptional<string | null>;
  declare rightsizingScore: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createFactEc2InstanceDailyModel = (sequelize: Sequelize): typeof FactEc2InstanceDaily => {
  FactEc2InstanceDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: true, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      instanceId: { type: DataTypes.TEXT, allowNull: false, field: "instance_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      instanceName: { type: DataTypes.TEXT, allowNull: true, field: "instance_name" },
      instanceType: { type: DataTypes.TEXT, allowNull: true, field: "instance_type" },
      availabilityZone: { type: DataTypes.TEXT, allowNull: true, field: "availability_zone" },
      isSpot: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_spot" },
      state: { type: DataTypes.TEXT, allowNull: true },
      isRunning: { type: DataTypes.BOOLEAN, allowNull: false, field: "is_running" },
      totalHours: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_hours" },
      computeCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "compute_cost" },
      ebsCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "ebs_cost" },
      dataTransferCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "data_transfer_cost" },
      taxCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "tax_cost" },
      creditAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "credit_amount" },
      refundAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "refund_amount" },
      totalBilledCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_billed_cost" },
      totalEffectiveCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_effective_cost" },
      totalListCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "total_list_cost" },
      currencyCode: { type: DataTypes.STRING(10), allowNull: true, defaultValue: "USD", field: "currency_code" },
      launchTime: { type: DataTypes.DATE, allowNull: true, field: "launch_time" },
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: "deleted_at" },
      source: { type: DataTypes.STRING(50), allowNull: true },
      platform: { type: DataTypes.TEXT, allowNull: true },
      platformDetails: { type: DataTypes.TEXT, allowNull: true, field: "platform_details" },
      architecture: { type: DataTypes.TEXT, allowNull: true },
      tenancy: { type: DataTypes.TEXT, allowNull: true },
      asgName: { type: DataTypes.TEXT, allowNull: true, field: "asg_name" },
      vpcId: { type: DataTypes.TEXT, allowNull: true, field: "vpc_id" },
      subnetId: { type: DataTypes.TEXT, allowNull: true, field: "subnet_id" },
      imageId: { type: DataTypes.TEXT, allowNull: true, field: "image_id" },
      cpuAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_avg" },
      cpuMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_max" },
      cpuMin: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "cpu_min" },
      memoryAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "memory_avg" },
      memoryMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "memory_max" },
      diskUsedPercentAvg: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "disk_used_percent_avg" },
      diskUsedPercentMax: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "disk_used_percent_max" },
      networkInBytes: { type: DataTypes.BIGINT, allowNull: true, field: "network_in_bytes" },
      networkOutBytes: { type: DataTypes.BIGINT, allowNull: true, field: "network_out_bytes" },
      pricingModel: { type: DataTypes.STRING(30), allowNull: true, field: "pricing_model" },
      effectiveCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "effective_cost" },
      billedCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "billed_cost" },
      listCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "list_cost" },
      reservationType: { type: DataTypes.STRING(30), allowNull: true, field: "reservation_type" },
      reservationArn: { type: DataTypes.TEXT, allowNull: true, field: "reservation_arn" },
      savingsPlanArn: { type: DataTypes.TEXT, allowNull: true, field: "savings_plan_arn" },
      savingsPlanType: { type: DataTypes.TEXT, allowNull: true, field: "savings_plan_type" },
      coveredHours: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "covered_hours" },
      uncoveredHours: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "uncovered_hours" },
      coveredCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "covered_cost" },
      uncoveredCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "uncovered_cost" },
      isIdleCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_idle_candidate" },
      isUnderutilizedCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_underutilized_candidate" },
      isOverutilizedCandidate: { type: DataTypes.BOOLEAN, allowNull: true, field: "is_overutilized_candidate" },
      idleScore: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "idle_score" },
      rightsizingScore: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: "rightsizing_score" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "FactEc2InstanceDaily",
      tableName: "fact_ec2_instance_daily",
      timestamps: false,
    },
  );

  return FactEc2InstanceDaily;
};

export { FactEc2InstanceDaily };
export default createFactEc2InstanceDailyModel;
