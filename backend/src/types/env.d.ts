declare namespace NodeJS {
  interface ProcessEnv {
    DB_URL?: string;
    PORT?: string;
    LOG_LEVEL?: "debug" | "info" | "warn" | "error";
    NODE_ENV?: "development" | "test" | "production";
    CAL_API_KEY?: string;
  }
}
