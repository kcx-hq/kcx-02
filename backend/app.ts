import cors from "cors";
import express from "express";
import helmet from "helmet";
import { HTTP_STATUS } from "./src/constants/http-status.js";
import { RESPONSE_MESSAGE } from "./src/constants/response-messages.js";
import { NotFoundError } from "./src/errors/http-errors.js";
import { errorHandlerMiddleware } from "./src/middlewares/error-handler.middleware.js";
import { requestIdMiddleware } from "./src/middlewares/request-id.middleware.js";
import { requestLoggerMiddleware } from "./src/middlewares/request-logger.middleware.js";
import { sendSuccess } from "./src/utils/api-response.js";
import { asyncHandler } from "./src/utils/async-handler.js";
import routes from "./src/features/_app/app.routes.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

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
