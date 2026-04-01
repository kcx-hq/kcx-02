import { Sequelize } from "sequelize";
import env from "../config/env.js";
import createAwsCloudConnectionModel from "./aws-cloud-connection.js";
import createTempModel from "./temp.js";
import createAuthSessionModel from "./auth-session.js";
import createCloudConnectionModel from "./cloud-connection.js";
import createAdminAuthSessionModel from "./admin-auth-session.js";
import createDemoRequestModel from "./demo-request.js";
import createPasswordResetTokenModel from "./password-reset-token.js";
import createSlotReservationModel from "./slot-reservation.js";
import createAdminUserModel from "./admin-user.js";
import createCloudConnectionModel from "./cloud-connection.js";
import createCloudConnectionV2Model from "./cloud-connection-v2.js";
import createCloudProviderModel from "./cloud-provider.js";
import createTenantModel from "./tenant.js";
import createUserModel from "./user.js";
import createRawBillingFileModel from "./raw-billing-file.js";
import createBillingSourceModel from "./billing-source.js";
import createBillingIngestionRunModel from "./billing-ingestion-run.js";
import createDimBillingAccountModel from "./billing/dim_billing_account.js";
import createDimSubAccountModel from "./billing/dim_sub_account.js";
import createDimRegionModel from "./billing/dim_region.js";
import createDimServiceModel from "./billing/dim_service.js";
import createDimResourceModel from "./billing/dim_resource.js";
import createDimSkuModel from "./billing/dim_sku.js";
import createDimChargeModel from "./billing/dim_charge.js";
import createDimDateModel from "./billing/dim_date.js";
import createFactCostLineItemsModel from "./billing/fact_cost_line_items.js";

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
const AwsCloudConnection = createAwsCloudConnectionModel(sequelize);
const CloudConnection = createCloudConnectionModel(sequelize);
const DemoRequest = createDemoRequestModel(sequelize);
const PasswordResetToken = createPasswordResetTokenModel(sequelize);
const AuthSession = createAuthSessionModel(sequelize);
const AdminUser = createAdminUserModel(sequelize);
const AdminAuthSession = createAdminAuthSessionModel(sequelize);
const SlotReservation = createSlotReservationModel(sequelize);
const CloudConnection = createCloudConnectionModel(sequelize);
const CloudProvider = createCloudProviderModel(sequelize);
const CloudConnectionV2 = createCloudConnectionV2Model(sequelize);
const Tenant = createTenantModel(sequelize);
const User = createUserModel(sequelize);
const RawBillingFile = createRawBillingFileModel(sequelize);
const BillingSource = createBillingSourceModel(sequelize);
const BillingIngestionRun = createBillingIngestionRunModel(sequelize);
const DimBillingAccount = createDimBillingAccountModel(sequelize);
const DimSubAccount = createDimSubAccountModel(sequelize);
const DimRegion = createDimRegionModel(sequelize);
const DimService = createDimServiceModel(sequelize);
const DimResource = createDimResourceModel(sequelize);
const DimSku = createDimSkuModel(sequelize);
const DimCharge = createDimChargeModel(sequelize);
const DimDate = createDimDateModel(sequelize);
const FactCostLineItems = createFactCostLineItemsModel(sequelize);

User.hasMany(DemoRequest, { foreignKey: "userId" });
DemoRequest.belongsTo(User, { foreignKey: "userId" });
DemoRequest.hasMany(SlotReservation, { foreignKey: "demoRequestId" });
SlotReservation.belongsTo(DemoRequest, { foreignKey: "demoRequestId" });

User.hasMany(PasswordResetToken, { foreignKey: "userId" });
PasswordResetToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(AuthSession, { foreignKey: "userId" });
AuthSession.belongsTo(User, { foreignKey: "userId" });

User.hasMany(CloudConnection, { foreignKey: "clientId" });
CloudConnection.belongsTo(User, { foreignKey: "clientId" });
CloudConnection.hasOne(AwsCloudConnection, { foreignKey: "cloudConnectionId" });
AwsCloudConnection.belongsTo(CloudConnection, { foreignKey: "cloudConnectionId" });
User.hasMany(CloudConnection, { foreignKey: "userId" });
CloudConnection.belongsTo(User, { foreignKey: "userId" });

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
BillingSource.hasMany(BillingIngestionRun, { foreignKey: "billingSourceId" });
BillingIngestionRun.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
RawBillingFile.hasMany(BillingIngestionRun, { foreignKey: "rawBillingFileId" });
BillingIngestionRun.belongsTo(RawBillingFile, { foreignKey: "rawBillingFileId" });
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

AdminUser.hasMany(AdminAuthSession, { foreignKey: "adminUserId" });
AdminAuthSession.belongsTo(AdminUser, { foreignKey: "adminUserId" });

Tenant.hasMany(User, { foreignKey: "tenantId" });
User.belongsTo(Tenant, { foreignKey: "tenantId" });

export {
  sequelize,
  Sequelize,
  Temp,
  User,
  AwsCloudConnection,
  CloudConnection,
  DemoRequest,
  SlotReservation,
  PasswordResetToken,
  AuthSession,
  AdminUser,
  AdminAuthSession,
  CloudConnection,
  CloudProvider,
  CloudConnectionV2,
  Tenant,
  User,
  RawBillingFile,
  BillingSource,
  BillingIngestionRun,
  DimBillingAccount,
  DimSubAccount,
  DimRegion,
  DimService,
  DimResource,
  DimSku,
  DimCharge,
  DimDate,
  FactCostLineItems,
};
