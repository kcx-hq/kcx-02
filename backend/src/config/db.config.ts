import "dotenv/config";

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

const rawDbUrl = process.env.DB_URL;

if (!rawDbUrl) {
  throw new Error("DB_URL is not set");
}

const dbUrl = new URL(rawDbUrl);
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
