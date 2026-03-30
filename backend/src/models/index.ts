import { Sequelize } from "sequelize";
import env from "../config/env.js";
import createTempModel from "./temp.js";
import createAuthSessionModel from "./auth-session.js";
import createAdminAuthSessionModel from "./admin-auth-session.js";
import createDemoRequestModel from "./demo-request.js";
import createPasswordResetTokenModel from "./password-reset-token.js";
import createSlotReservationModel from "./slot-reservation.js";
import createClientModel from "./client.js";
import createAdminUserModel from "./admin-user.js";
import createCloudConnectionModel from "./cloud-connection.js";

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
const Client = createClientModel(sequelize);
const DemoRequest = createDemoRequestModel(sequelize);
const PasswordResetToken = createPasswordResetTokenModel(sequelize);
const AuthSession = createAuthSessionModel(sequelize);
const AdminUser = createAdminUserModel(sequelize);
const AdminAuthSession = createAdminAuthSessionModel(sequelize);
const SlotReservation = createSlotReservationModel(sequelize);
const CloudConnection = createCloudConnectionModel(sequelize);

Client.hasMany(DemoRequest, { foreignKey: "clientId" });
DemoRequest.belongsTo(Client, { foreignKey: "clientId" });
DemoRequest.hasMany(SlotReservation, { foreignKey: "demoRequestId" });
SlotReservation.belongsTo(DemoRequest, { foreignKey: "demoRequestId" });

Client.hasMany(PasswordResetToken, { foreignKey: "clientId" });
PasswordResetToken.belongsTo(Client, { foreignKey: "clientId" });

Client.hasMany(AuthSession, { foreignKey: "clientId" });
AuthSession.belongsTo(Client, { foreignKey: "clientId" });

Client.hasMany(CloudConnection, { foreignKey: "clientId" });
CloudConnection.belongsTo(Client, { foreignKey: "clientId" });

AdminUser.hasMany(AdminAuthSession, { foreignKey: "adminUserId" });
AdminAuthSession.belongsTo(AdminUser, { foreignKey: "adminUserId" });

export {
  sequelize,
  Sequelize,
  Temp,
  Client,
  DemoRequest,
  SlotReservation,
  PasswordResetToken,
  AuthSession,
  AdminUser,
  AdminAuthSession,
  CloudConnection,
};
