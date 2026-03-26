import env from "../config/env.js";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogMetadata = Record<string, unknown>;

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
};

const LOG_LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLogLevel: LogLevel = env.logLevel;

const shouldLog = (level: LogLevel): boolean =>
  LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[currentLogLevel];

const writeLog = (entry: LogEntry): void => {
  const payload = JSON.stringify(entry);

  if (entry.level === "error") {
    console.error(payload);
    return;
  }

  if (entry.level === "warn") {
    console.warn(payload);
    return;
  }

  console.log(payload);
};

const log = (level: LogLevel, message: string, metadata?: LogMetadata): void => {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(metadata ? { metadata } : {}),
  };

  writeLog(entry);
};

export const logger = {
  debug: (message: string, metadata?: LogMetadata): void =>
    log("debug", message, metadata),
  info: (message: string, metadata?: LogMetadata): void =>
    log("info", message, metadata),
  warn: (message: string, metadata?: LogMetadata): void =>
    log("warn", message, metadata),
  error: (message: string, metadata?: LogMetadata): void =>
    log("error", message, metadata),
};

export type { LogLevel, LogMetadata };
