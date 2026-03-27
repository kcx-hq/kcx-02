import { Sequelize } from "sequelize";
import env from "../config/env.js";
import createTempModel from "./temp.js";
import createAuthSessionModel from "./auth-session.js";
import createDemoRequestModel from "./demo-request.js";
import createPasswordResetTokenModel from "./password-reset-token.js";
import createSlotReservationModel from "./slot-reservation.js";
import createUserModel from "./user.js";

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
const SlotReservation = createSlotReservationModel(sequelize);

User.hasMany(DemoRequest, { foreignKey: "userId" });
DemoRequest.belongsTo(User, { foreignKey: "userId" });
DemoRequest.hasMany(SlotReservation, { foreignKey: "demoRequestId" });
SlotReservation.belongsTo(DemoRequest, { foreignKey: "demoRequestId" });

User.hasMany(PasswordResetToken, { foreignKey: "userId" });
PasswordResetToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(AuthSession, { foreignKey: "userId" });
AuthSession.belongsTo(User, { foreignKey: "userId" });

export {
  sequelize,
  Sequelize,
  Temp,
  User,
  DemoRequest,
  SlotReservation,
  PasswordResetToken,
  AuthSession,
};
