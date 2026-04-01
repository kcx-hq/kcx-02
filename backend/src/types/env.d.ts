declare namespace NodeJS {
  interface ProcessEnv {
    DB_URL?: string;
    PORT?: string;
    LOG_LEVEL?: "debug" | "info" | "warn" | "error";
    MAILGUN_API_KEY?: string;
    MAILGUN_DOMAIN?: string;
    MAILGUN_FROM?: string;
    FRONTEND_BASE_URL?: string;
    RESET_TOKEN_TTL_MINUTES?: string;
    SESSION_TTL_HOURS?: string;
    NODE_ENV?: "development" | "test" | "production";
    CAL_API_KEY?: string;
    CAL_API_BASE_URL?: string;
    CAL_API_VERSION?: string;
    CAL_SLOTS_API_VERSION?: string;
    CAL_BOOKINGS_API_VERSION?: string;
    CAL_EVENT_TYPE_ID?: string;
    CAL_TIMEZONE?: string;
    CAL_RESERVATION_TTL_MINUTES?: string;
    AWS_REGION?: string;
    AWS_VALIDATION_REGION?: string;
    AWS_ACCESS_KEY_ID?: string;
    AWS_SECRET_ACCESS_KEY?: string;
  }
}
