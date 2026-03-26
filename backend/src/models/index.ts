import "dotenv/config";
import { Sequelize } from "sequelize";
import createTempModel from "./temp.js";

const rawDbUrl = process.env.DB_URL;

if (!rawDbUrl) {
  throw new Error("DB_URL is not set");
}

const dbUrl = new URL(rawDbUrl);
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

export { sequelize, Sequelize, Temp };
