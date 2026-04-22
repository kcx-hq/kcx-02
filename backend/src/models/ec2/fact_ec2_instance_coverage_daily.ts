import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactEc2InstanceCoverageDaily extends Model<
  InferAttributes<FactEc2InstanceCoverageDaily>,
  InferCreationAttributes<FactEc2InstanceCoverageDaily>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare cloudConnectionId: CreationOptional<string | null>;
  declare billingSourceId: CreationOptional<string | null>;
  declare providerId: CreationOptional<string | null>;
  declare usageDate: string;
  declare instanceId: string;
  declare resourceKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare instanceType: CreationOptional<string | null>;
  declare reservationType: "on_demand" | "reserved" | "savings_plan" | "spot";
  declare reservationArn: CreationOptional<string | null>;
  declare savingsPlanArn: CreationOptional<string | null>;
  declare savingsPlanType: CreationOptional<string | null>;
  declare coveredHours: CreationOptional<string>;
  declare uncoveredHours: CreationOptional<string>;
  declare coveredCost: CreationOptional<string>;
  declare uncoveredCost: CreationOptional<string>;
  declare effectiveCost: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createFactEc2InstanceCoverageDailyModel = (sequelize: Sequelize): typeof FactEc2InstanceCoverageDaily => {
  FactEc2InstanceCoverageDaily.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: true, field: "cloud_connection_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: true, field: "provider_id" },
      usageDate: { type: DataTypes.DATEONLY, allowNull: false, field: "usage_date" },
      instanceId: { type: DataTypes.TEXT, allowNull: false, field: "instance_id" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      instanceType: { type: DataTypes.TEXT, allowNull: true, field: "instance_type" },
      reservationType: { type: DataTypes.STRING(30), allowNull: false, field: "reservation_type" },
      reservationArn: { type: DataTypes.TEXT, allowNull: true, field: "reservation_arn" },
      savingsPlanArn: { type: DataTypes.TEXT, allowNull: true, field: "savings_plan_arn" },
      savingsPlanType: { type: DataTypes.TEXT, allowNull: true, field: "savings_plan_type" },
      coveredHours: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "covered_hours" },
      uncoveredHours: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "uncovered_hours" },
      coveredCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "covered_cost" },
      uncoveredCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "uncovered_cost" },
      effectiveCost: { type: DataTypes.DECIMAL(18, 6), allowNull: false, defaultValue: 0, field: "effective_cost" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "updated_at" },
    },
    {
      sequelize,
      modelName: "FactEc2InstanceCoverageDaily",
      tableName: "fact_ec2_instance_coverage_daily",
      timestamps: false,
    },
  );

  return FactEc2InstanceCoverageDaily;
};

export { FactEc2InstanceCoverageDaily };
export default createFactEc2InstanceCoverageDailyModel;
