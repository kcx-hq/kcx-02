import { Sequelize } from "sequelize";
import env from "../config/env.js";
import createTempModel from "./temp.js";
import createAuthSessionModel from "./auth-session.js";
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

User.hasMany(DemoRequest, { foreignKey: "userId" });
DemoRequest.belongsTo(User, { foreignKey: "userId" });
DemoRequest.hasMany(SlotReservation, { foreignKey: "demoRequestId" });
SlotReservation.belongsTo(DemoRequest, { foreignKey: "demoRequestId" });

User.hasMany(PasswordResetToken, { foreignKey: "userId" });
PasswordResetToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(AuthSession, { foreignKey: "userId" });
AuthSession.belongsTo(User, { foreignKey: "userId" });

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

AdminUser.hasMany(AdminAuthSession, { foreignKey: "adminUserId" });
AdminAuthSession.belongsTo(AdminUser, { foreignKey: "adminUserId" });

Tenant.hasMany(User, { foreignKey: "tenantId" });
User.belongsTo(Tenant, { foreignKey: "tenantId" });

export {
  sequelize,
  Sequelize,
  Temp,
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
};
