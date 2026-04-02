import { Sequelize } from "sequelize";
import env from "../config/env.js";
import createTempModel from "./temp.js";
import createAuthSessionModel from "./auth-session.js";
import createAdminAuthSessionModel from "./admin-auth-session.js";
import createDemoRequestModel from "./demo-request.js";
import createPasswordResetTokenModel from "./password-reset-token.js";
import createSlotReservationModel from "./slot-reservation.js";
import createAdminUserModel from "./admin-user.js";
import createCloudConnectionV2Model from "./cloud-connection-v2.js";
import createCloudProviderModel from "./cloud-provider.js";
import createTenantModel from "./tenant.js";
import createUserModel from "./user.js";
import createRawBillingFileModel from "./raw-billing-file.js";
import createBillingSourceModel from "./billing-source.js";
import createBillingIngestionRunModel from "./billing-ingestion-run.js";
import createManualCloudConnectionModel from "./manual-cloud-connection.js";
import createDimBillingAccountModel from "./billing/dim_billing_account.js";
import createDimSubAccountModel from "./billing/dim_sub_account.js";
import createDimRegionModel from "./billing/dim_region.js";
import createDimServiceModel from "./billing/dim_service.js";
import createDimResourceModel from "./billing/dim_resource.js";
import createDimSkuModel from "./billing/dim_sku.js";
import createDimChargeModel from "./billing/dim_charge.js";
import createDimDateModel from "./billing/dim_date.js";
import createFactCostLineItemsModel from "./billing/fact_cost_line_items.js";
import createBillingIngestionRowErrorModel from "./billing/billing_ingestion_row_error.js";
import createResourceInventorySnapshotModel from "./billing/resource_inventory_snapshots.js";
import createResourceUtilizationDailyModel from "./billing/resource_utilization_daily.js";
import createFactAnomaliesModel from "./billing/fact_anomalies.js";
import createFactRecommendationsModel from "./billing/fact_recommendations.js";
import createFactCostAllocationsModel from "./billing/fact_cost_allocations.js";
import createFactCommitmentCoverageModel from "./billing/fact_commitment_coverage.js";
import createBudgetsModel from "./billing/budgets.js";
import createBudgetEvaluationsModel from "./billing/budget_evaluations.js";
import createBudgetAlertsModel from "./billing/budget_alerts.js";

const dbUrl = new URL(env.dbUrl);
if (!dbUrl.searchParams.has("sslmode")) {
  dbUrl.searchParams.set("sslmode", "require");
}

const sequelize = new Sequelize(dbUrl.toString(), {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

const Temp = createTempModel(sequelize);
const User = createUserModel(sequelize);
const DemoRequest = createDemoRequestModel(sequelize);
const PasswordResetToken = createPasswordResetTokenModel(sequelize);
const AuthSession = createAuthSessionModel(sequelize);
const AdminUser = createAdminUserModel(sequelize);
const AdminAuthSession = createAdminAuthSessionModel(sequelize);
const SlotReservation = createSlotReservationModel(sequelize);
const CloudProvider = createCloudProviderModel(sequelize);
const CloudConnectionV2 = createCloudConnectionV2Model(sequelize);
const Tenant = createTenantModel(sequelize);
const RawBillingFile = createRawBillingFileModel(sequelize);
const BillingSource = createBillingSourceModel(sequelize);
const BillingIngestionRun = createBillingIngestionRunModel(sequelize);
const ManualCloudConnection = createManualCloudConnectionModel(sequelize);
const DimBillingAccount = createDimBillingAccountModel(sequelize);
const DimSubAccount = createDimSubAccountModel(sequelize);
const DimRegion = createDimRegionModel(sequelize);
const DimService = createDimServiceModel(sequelize);
const DimResource = createDimResourceModel(sequelize);
const DimSku = createDimSkuModel(sequelize);
const DimCharge = createDimChargeModel(sequelize);
const DimDate = createDimDateModel(sequelize);
const FactCostLineItems = createFactCostLineItemsModel(sequelize);
const BillingIngestionRowError = createBillingIngestionRowErrorModel(sequelize);
const ResourceInventorySnapshot = createResourceInventorySnapshotModel(sequelize);
const ResourceUtilizationDaily = createResourceUtilizationDailyModel(sequelize);
const FactAnomalies = createFactAnomaliesModel(sequelize);
const FactRecommendations = createFactRecommendationsModel(sequelize);
const FactCostAllocations = createFactCostAllocationsModel(sequelize);
const FactCommitmentCoverage = createFactCommitmentCoverageModel(sequelize);
const Budgets = createBudgetsModel(sequelize);
const BudgetEvaluations = createBudgetEvaluationsModel(sequelize);
const BudgetAlerts = createBudgetAlertsModel(sequelize);

User.hasMany(DemoRequest, { foreignKey: "userId" });
DemoRequest.belongsTo(User, { foreignKey: "userId" });
DemoRequest.hasMany(SlotReservation, { foreignKey: "demoRequestId" });
SlotReservation.belongsTo(DemoRequest, { foreignKey: "demoRequestId" });

User.hasMany(PasswordResetToken, { foreignKey: "userId" });
PasswordResetToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(AuthSession, { foreignKey: "userId" });
AuthSession.belongsTo(User, { foreignKey: "userId" });

Tenant.hasMany(CloudConnectionV2, { foreignKey: "tenantId" });
CloudConnectionV2.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(CloudConnectionV2, { foreignKey: "providerId" });
CloudConnectionV2.belongsTo(CloudProvider, { foreignKey: "providerId" });
User.hasMany(CloudConnectionV2, { foreignKey: "createdBy" });
CloudConnectionV2.belongsTo(User, { foreignKey: "createdBy" });
CloudProvider.hasMany(BillingSource, { foreignKey: "cloudProviderId" });
BillingSource.belongsTo(CloudProvider, { foreignKey: "cloudProviderId" });
BillingSource.hasMany(RawBillingFile, { foreignKey: "billingSourceId" });
RawBillingFile.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
CloudProvider.hasMany(RawBillingFile, { foreignKey: "cloudProviderId" });
RawBillingFile.belongsTo(CloudProvider, { foreignKey: "cloudProviderId" });
User.hasMany(RawBillingFile, { foreignKey: "uploadedBy" });
RawBillingFile.belongsTo(User, { foreignKey: "uploadedBy" });
BillingSource.hasMany(BillingIngestionRun, { foreignKey: "billingSourceId" });
BillingIngestionRun.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
RawBillingFile.hasMany(BillingIngestionRun, { foreignKey: "rawBillingFileId" });
BillingIngestionRun.belongsTo(RawBillingFile, { foreignKey: "rawBillingFileId" });
Tenant.hasMany(ManualCloudConnection, { foreignKey: "tenantId" });
ManualCloudConnection.belongsTo(Tenant, { foreignKey: "tenantId" });
User.hasMany(ManualCloudConnection, { foreignKey: "createdBy" });
ManualCloudConnection.belongsTo(User, { foreignKey: "createdBy" });
Tenant.hasMany(DimBillingAccount, { foreignKey: "tenantId" });
DimBillingAccount.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(DimBillingAccount, { foreignKey: "providerId" });
DimBillingAccount.belongsTo(CloudProvider, { foreignKey: "providerId" });

Tenant.hasMany(DimSubAccount, { foreignKey: "tenantId" });
DimSubAccount.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(DimSubAccount, { foreignKey: "providerId" });
DimSubAccount.belongsTo(CloudProvider, { foreignKey: "providerId" });

CloudProvider.hasMany(DimRegion, { foreignKey: "providerId" });
DimRegion.belongsTo(CloudProvider, { foreignKey: "providerId" });

CloudProvider.hasMany(DimService, { foreignKey: "providerId" });
DimService.belongsTo(CloudProvider, { foreignKey: "providerId" });

Tenant.hasMany(DimResource, { foreignKey: "tenantId" });
DimResource.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(DimResource, { foreignKey: "providerId" });
DimResource.belongsTo(CloudProvider, { foreignKey: "providerId" });

CloudProvider.hasMany(DimSku, { foreignKey: "providerId" });
DimSku.belongsTo(CloudProvider, { foreignKey: "providerId" });

DimBillingAccount.hasMany(FactCostLineItems, { foreignKey: "billingAccountKey" });
FactCostLineItems.belongsTo(DimBillingAccount, { foreignKey: "billingAccountKey" });
DimSubAccount.hasMany(FactCostLineItems, { foreignKey: "subAccountKey" });
FactCostLineItems.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });
DimRegion.hasMany(FactCostLineItems, { foreignKey: "regionKey" });
FactCostLineItems.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimService.hasMany(FactCostLineItems, { foreignKey: "serviceKey" });
FactCostLineItems.belongsTo(DimService, { foreignKey: "serviceKey" });
DimResource.hasMany(FactCostLineItems, { foreignKey: "resourceKey" });
FactCostLineItems.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimSku.hasMany(FactCostLineItems, { foreignKey: "skuKey" });
FactCostLineItems.belongsTo(DimSku, { foreignKey: "skuKey" });
DimCharge.hasMany(FactCostLineItems, { foreignKey: "chargeKey" });
FactCostLineItems.belongsTo(DimCharge, { foreignKey: "chargeKey" });

DimDate.hasMany(FactCostLineItems, { foreignKey: "usageDateKey" });
FactCostLineItems.belongsTo(DimDate, { foreignKey: "usageDateKey", as: "usageDate" });
DimDate.hasMany(FactCostLineItems, { foreignKey: "billingPeriodStartDateKey" });
FactCostLineItems.belongsTo(DimDate, { foreignKey: "billingPeriodStartDateKey", as: "billingPeriodStartDate" });
DimDate.hasMany(FactCostLineItems, { foreignKey: "billingPeriodEndDateKey" });
FactCostLineItems.belongsTo(DimDate, { foreignKey: "billingPeriodEndDateKey", as: "billingPeriodEndDate" });

Tenant.hasMany(FactCostLineItems, { foreignKey: "tenantId" });
FactCostLineItems.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(FactCostLineItems, { foreignKey: "providerId" });
FactCostLineItems.belongsTo(CloudProvider, { foreignKey: "providerId" });
BillingSource.hasMany(FactCostLineItems, { foreignKey: "billingSourceId" });
FactCostLineItems.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
BillingIngestionRun.hasMany(FactCostLineItems, { foreignKey: "ingestionRunId" });
FactCostLineItems.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
BillingIngestionRun.hasMany(BillingIngestionRowError, { foreignKey: "ingestionRunId" });
BillingIngestionRowError.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
RawBillingFile.hasMany(BillingIngestionRowError, { foreignKey: "rawBillingFileId" });
BillingIngestionRowError.belongsTo(RawBillingFile, { foreignKey: "rawBillingFileId" });
FactCostLineItems.hasMany(FactCostAllocations, { foreignKey: "factId" });
FactCostAllocations.belongsTo(FactCostLineItems, { foreignKey: "factId" });

Tenant.hasMany(ResourceInventorySnapshot, { foreignKey: "tenantId" });
ResourceInventorySnapshot.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(ResourceInventorySnapshot, { foreignKey: "cloudConnectionId" });
ResourceInventorySnapshot.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(ResourceInventorySnapshot, { foreignKey: "providerId" });
ResourceInventorySnapshot.belongsTo(CloudProvider, { foreignKey: "providerId" });

Tenant.hasMany(ResourceUtilizationDaily, { foreignKey: "tenantId" });
ResourceUtilizationDaily.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(ResourceUtilizationDaily, { foreignKey: "cloudConnectionId" });
ResourceUtilizationDaily.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });

Tenant.hasMany(FactAnomalies, { foreignKey: "tenantId" });
FactAnomalies.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(FactAnomalies, { foreignKey: "cloudConnectionId" });
FactAnomalies.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
DimService.hasMany(FactAnomalies, { foreignKey: "serviceKey" });
FactAnomalies.belongsTo(DimService, { foreignKey: "serviceKey" });
DimRegion.hasMany(FactAnomalies, { foreignKey: "regionKey" });
FactAnomalies.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimResource.hasMany(FactAnomalies, { foreignKey: "resourceKey" });
FactAnomalies.belongsTo(DimResource, { foreignKey: "resourceKey" });

Tenant.hasMany(FactRecommendations, { foreignKey: "tenantId" });
FactRecommendations.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(FactRecommendations, { foreignKey: "cloudConnectionId" });
FactRecommendations.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });

Tenant.hasMany(FactCommitmentCoverage, { foreignKey: "tenantId" });
FactCommitmentCoverage.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(FactCommitmentCoverage, { foreignKey: "cloudConnectionId" });
FactCommitmentCoverage.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });

Tenant.hasMany(Budgets, { foreignKey: "tenantId" });
Budgets.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(Budgets, { foreignKey: "cloudConnectionId" });
Budgets.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
User.hasMany(Budgets, { foreignKey: "createdBy" });
Budgets.belongsTo(User, { foreignKey: "createdBy" });
Budgets.hasMany(BudgetEvaluations, { foreignKey: "budgetId" });
BudgetEvaluations.belongsTo(Budgets, { foreignKey: "budgetId" });
Budgets.hasMany(BudgetAlerts, { foreignKey: "budgetId" });
BudgetAlerts.belongsTo(Budgets, { foreignKey: "budgetId" });

AdminUser.hasMany(AdminAuthSession, { foreignKey: "adminUserId" });
AdminAuthSession.belongsTo(AdminUser, { foreignKey: "adminUserId" });

Tenant.hasMany(User, { foreignKey: "tenantId" });
User.belongsTo(Tenant, { foreignKey: "tenantId" });

export {
  sequelize,
  Sequelize,
  Temp,
  User,
  DemoRequest,
  SlotReservation,
  PasswordResetToken,
  AuthSession,
  AdminUser,
  AdminAuthSession,
  CloudProvider,
  CloudConnectionV2,
  Tenant,
  RawBillingFile,
  BillingSource,
  BillingIngestionRun,
  ManualCloudConnection,
  DimBillingAccount,
  DimSubAccount,
  DimRegion,
  DimService,
  DimResource,
  DimSku,
  DimCharge,
  DimDate,
  FactCostLineItems,
  BillingIngestionRowError,
  ResourceInventorySnapshot,
  ResourceUtilizationDaily,
  FactAnomalies,
  FactRecommendations,
  FactCostAllocations,
  FactCommitmentCoverage,
  Budgets,
  BudgetEvaluations,
  BudgetAlerts,
};
