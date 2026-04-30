import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { CorsOptions } from "cors";
import { HTTP_STATUS } from "./src/constants/http-status.js";
import { RESPONSE_MESSAGE } from "./src/constants/response-messages.js";
import { NotFoundError } from "./src/errors/http-errors.js";
import { errorHandlerMiddleware } from "./src/middlewares/error-handler.middleware.js";
import { apiSecurityMiddleware } from "./src/middlewares/api-security.middleware.js";
import { requestIdMiddleware } from "./src/middlewares/request-id.middleware.js";
import { requestLoggerMiddleware } from "./src/middlewares/request-logger.middleware.js";
import { sendSuccess } from "./src/utils/api-response.js";
import { asyncHandler } from "./src/utils/async-handler.js";
import routes from "./src/features/_app/app.routes.js";

const app = express();
const defaultAllowedOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
const configuredAllowedOrigins = `${process.env.FRONTEND_BASE_URL ?? ""},${process.env.CLIENT_URL ?? ""},${process.env.CORS_ALLOWED_ORIGINS ?? ""}`
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]);
const localhostOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Allow server-to-server and CLI requests without Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    if (localhostOriginPattern.test(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204,
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(apiSecurityMiddleware);

app.get(
  "/health",
  asyncHandler(async (req, res) => {
    sendSuccess({
      res,
      req,
      statusCode: HTTP_STATUS.OK,
      message: RESPONSE_MESSAGE.HEALTH_OK,
      data: { status: "ok" },
    });
  }),
);

app.use(routes);

app.use((req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
});

app.use(errorHandlerMiddleware);

export default app;
