// @ts-nocheck
export type DemoDbConfig = {
  url: string;
  source: "DEMO_DATABASE_URL" | "DB_URL";
};

const FORBIDDEN_NAME_TOKENS = ["prod", "production", "staging", "stage", "live", "main"];

const readEnv = (key: string): string | null => {
  const value = process.env[key];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseDbName = (url: string): string => {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\//, "")).toLowerCase();
  } catch {
    throw new Error("Invalid database URL format");
  }
};

export function resolveDemoDbConfig(): DemoDbConfig {
  const demoUrl = readEnv("DEMO_DATABASE_URL");
  if (demoUrl) {
    return { url: demoUrl, source: "DEMO_DATABASE_URL" };
  }

  const nodeEnv = (readEnv("NODE_ENV") ?? "").toLowerCase();
  const dbUrl = readEnv("DB_URL");
  if (nodeEnv === "demo" && dbUrl) {
    return { url: dbUrl, source: "DB_URL" };
  }

  throw new Error(
    "Demo DB refused: set DEMO_DATABASE_URL (recommended), or set NODE_ENV=demo with DB_URL pointing to demo DB.",
  );
}

export function assertDemoDbSafety(url: string): void {
  const dbName = parseDbName(url);

  if (!dbName) {
    throw new Error("Demo DB refused: could not determine database name from URL");
  }

  if (!dbName.includes("demo")) {
    throw new Error(
      `Demo DB refused: database name '${dbName}' must include 'demo' to prevent touching normal dev/prod data.`,
    );
  }

  if (FORBIDDEN_NAME_TOKENS.some((token) => dbName.includes(token))) {
    throw new Error(
      `Demo DB refused: database name '${dbName}' appears production-like/staging-like.`,
    );
  }
}

export function activateDemoDbEnv(): DemoDbConfig {
  const config = resolveDemoDbConfig();
  assertDemoDbSafety(config.url);

  process.env.DB_URL = config.url;
  process.env.NODE_ENV = "demo";

  return config;
}

export function getSeedMarker(): string {
  return "demo-db-v1";
}
