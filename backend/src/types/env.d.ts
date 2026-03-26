declare namespace NodeJS {
  interface ProcessEnv {
    DB_URL?: string;
    PORT?: string;
    LOG_LEVEL?: "debug" | "info" | "warn" | "error";
  }
}
