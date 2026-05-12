import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class FactCostLineItems extends Model<InferAttributes<FactCostLineItems>, InferCreationAttributes<FactCostLineItems>> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare billingSourceId: CreationOptional<string | null>;
  declare ingestionRunId: CreationOptional<string | null>;
  declare providerId: string;
  declare billingAccountKey: CreationOptional<string | null>;
  declare subAccountKey: CreationOptional<string | null>;
  declare regionKey: CreationOptional<string | null>;
  declare serviceKey: CreationOptional<string | null>;
  declare resourceKey: CreationOptional<string | null>;
  declare skuKey: CreationOptional<string | null>;
  declare chargeKey: CreationOptional<string | null>;
  declare tagId: CreationOptional<string | null>;
  declare usageDateKey: CreationOptional<string | null>;
  declare billingPeriodStartDateKey: CreationOptional<string | null>;
  declare billingPeriodEndDateKey: CreationOptional<string | null>;
  declare billedCost: CreationOptional<string | null>;
  declare effectiveCost: CreationOptional<string | null>;
  declare listCost: CreationOptional<string | null>;
  declare consumedQuantity: CreationOptional<string | null>;
  declare pricingQuantity: CreationOptional<string | null>;
  declare usageStartTime: CreationOptional<Date | null>;
  declare usageEndTime: CreationOptional<Date | null>;
  declare usageType: CreationOptional<string | null>;
  declare productUsageType: CreationOptional<string | null>;
  declare productFamily: CreationOptional<string | null>;
  declare fromLocation: CreationOptional<string | null>;
  declare toLocation: CreationOptional<string | null>;
  declare fromRegionCode: CreationOptional<string | null>;
  declare toRegionCode: CreationOptional<string | null>;
  declare billType: CreationOptional<string | null>;
  declare lineItemDescription: CreationOptional<string | null>;
  declare legalEntity: CreationOptional<string | null>;
  declare operation: CreationOptional<string | null>;
  declare lineItemType: CreationOptional<string | null>;
  declare pricingTerm: CreationOptional<string | null>;
  declare purchaseOption: CreationOptional<string | null>;
  declare publicOnDemandCost: CreationOptional<string | null>;
  declare publicOnDemandRate: CreationOptional<string | null>;
  declare discountAmount: CreationOptional<string | null>;
  declare bundledDiscount: CreationOptional<string | null>;
  declare creditAmount: CreationOptional<string | null>;
  declare refundAmount: CreationOptional<string | null>;
  declare taxCost: CreationOptional<string | null>;
  declare reservationArn: CreationOptional<string | null>;
  declare savingsPlanArn: CreationOptional<string | null>;
  declare savingsPlanType: CreationOptional<string | null>;
  declare ingestedAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
}

const createFactCostLineItemsModel = (sequelize: Sequelize): typeof FactCostLineItems => {
  FactCostLineItems.init(
    {
      id: { type: DataTypes.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
      billingSourceId: { type: DataTypes.BIGINT, allowNull: true, field: "billing_source_id" },
      ingestionRunId: { type: DataTypes.BIGINT, allowNull: true, field: "ingestion_run_id" },
      providerId: { type: DataTypes.BIGINT, allowNull: false, field: "provider_id" },
      billingAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "billing_account_key" },
      subAccountKey: { type: DataTypes.BIGINT, allowNull: true, field: "sub_account_key" },
      regionKey: { type: DataTypes.BIGINT, allowNull: true, field: "region_key" },
      serviceKey: { type: DataTypes.BIGINT, allowNull: true, field: "service_key" },
      resourceKey: { type: DataTypes.BIGINT, allowNull: true, field: "resource_key" },
      skuKey: { type: DataTypes.BIGINT, allowNull: true, field: "sku_key" },
      chargeKey: { type: DataTypes.BIGINT, allowNull: true, field: "charge_key" },
      tagId: { type: DataTypes.BIGINT, allowNull: true, field: "tag_id" },
      usageDateKey: { type: DataTypes.BIGINT, allowNull: true, field: "usage_date_key" },
      billingPeriodStartDateKey: { type: DataTypes.BIGINT, allowNull: true, field: "billing_period_start_date_key" },
      billingPeriodEndDateKey: { type: DataTypes.BIGINT, allowNull: true, field: "billing_period_end_date_key" },
      billedCost: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "billed_cost" },
      effectiveCost: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "effective_cost" },
      listCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "list_cost" },
      consumedQuantity: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "consumed_quantity" },
      pricingQuantity: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "pricing_quantity" },
      usageStartTime: { type: DataTypes.DATE, allowNull: true, field: "usage_start_time" },
      usageEndTime: { type: DataTypes.DATE, allowNull: true, field: "usage_end_time" },
      usageType: { type: DataTypes.TEXT, allowNull: true, field: "usage_type" },
      productUsageType: { type: DataTypes.TEXT, allowNull: true, field: "product_usage_type" },
      productFamily: { type: DataTypes.TEXT, allowNull: true, field: "product_family" },
      fromLocation: { type: DataTypes.TEXT, allowNull: true, field: "from_location" },
      toLocation: { type: DataTypes.TEXT, allowNull: true, field: "to_location" },
      fromRegionCode: { type: DataTypes.TEXT, allowNull: true, field: "from_region_code" },
      toRegionCode: { type: DataTypes.TEXT, allowNull: true, field: "to_region_code" },
      billType: { type: DataTypes.TEXT, allowNull: true, field: "bill_type" },
      lineItemDescription: { type: DataTypes.TEXT, allowNull: true, field: "line_item_description" },
      legalEntity: { type: DataTypes.TEXT, allowNull: true, field: "legal_entity" },
      operation: { type: DataTypes.TEXT, allowNull: true },
      lineItemType: { type: DataTypes.TEXT, allowNull: true, field: "line_item_type" },
      pricingTerm: { type: DataTypes.TEXT, allowNull: true, field: "pricing_term" },
      purchaseOption: { type: DataTypes.TEXT, allowNull: true, field: "purchase_option" },
      publicOnDemandCost: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "public_on_demand_cost" },
      publicOnDemandRate: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "public_on_demand_rate" },
      discountAmount: { type: DataTypes.DECIMAL(20, 12), allowNull: true, field: "discount_amount" },
      bundledDiscount: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "bundled_discount" },
      creditAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "credit_amount" },
      refundAmount: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "refund_amount" },
      taxCost: { type: DataTypes.DECIMAL(18, 6), allowNull: true, field: "tax_cost" },
      reservationArn: { type: DataTypes.TEXT, allowNull: true, field: "reservation_arn" },
      savingsPlanArn: { type: DataTypes.TEXT, allowNull: true, field: "savings_plan_arn" },
      savingsPlanType: { type: DataTypes.TEXT, allowNull: true, field: "savings_plan_type" },
      ingestedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "ingested_at" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("NOW()"), field: "created_at" },
    },
    {
      sequelize,
      modelName: "FactCostLineItems",
      tableName: "fact_cost_line_items",
      timestamps: false,
    },
  );
  return FactCostLineItems;
};

export { FactCostLineItems };
export default createFactCostLineItemsModel;
