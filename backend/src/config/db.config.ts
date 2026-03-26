import env from "./env.js";

type DialectSslConfig = {
  url: string;
  dialect: "postgres";
  dialectOptions: {
    ssl: {
      require: true;
      rejectUnauthorized: false;
    };
  };
};

const dbUrl = new URL(env.dbUrl);
if (!dbUrl.searchParams.has("sslmode")) {
  dbUrl.searchParams.set("sslmode", "require");
}

const sharedConfig: DialectSslConfig = {
  url: dbUrl.toString(),
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
};

const config: Record<"development" | "test" | "production", DialectSslConfig> =
  {
    development: sharedConfig,
    test: sharedConfig,
    production: sharedConfig,
  };

export default config;
