# Backend Guidelines

Practical coding rules for this Node.js + Express + TypeScript backend.

## 1. Response Rules
- Always use shared response helpers (`sendSuccess`, `sendError`).
- Never return API responses with direct `res.json(...)` from handlers.
- Keep response shape consistent across all endpoints.

```ts
// Do
return sendSuccess({
  res,
  req,
  statusCode: HTTP_STATUS.OK,
  message: "Fetched successfully",
  data: result,
});

// Don't
return res.status(200).json({ ok: true, result });
```

## 2. Error Handling Rules
- Throw only custom errors (`BadRequestError`, `NotFoundError`, etc.).
- Do not throw plain `Error` for operational/API errors.
- Do not send manual error responses in route handlers.
- Let global error middleware format and return the error response.

```ts
// Do
if (!user) throw new NotFoundError("User not found");

// Don't
if (!user) return res.status(404).json({ message: "User not found" });
```

## 3. Logging Rules
- Never use `console.log`, `console.error`, etc. in application code.
- Use `logger.debug/info/warn/error`.
- Log useful context only: `requestId`, route, method, status, duration, error code, message.
- Never log secrets (tokens, passwords, DB URLs, full auth headers).

```ts
logger.error("Failed to process request", {
  requestId: req.requestId,
  method: req.method,
  url: req.originalUrl,
  errorCode: err.errorCode,
});
```

## 4. Middleware Rules
- Required order:
1. `express.json`
2. `express.urlencoded`
3. security/common middleware (`helmet`, `cors`)
4. `requestIdMiddleware`
5. `requestLoggerMiddleware`
6. routes
7. not-found handler
8. global `errorHandlerMiddleware` (always last)
- Middleware responsibilities:
  - `requestId`: assign/expose `requestId`.
  - `requestLogger`: request lifecycle logging.
  - `errorHandler`: normalize/log/send error response.

## 5. Naming Conventions
- Files: kebab-case (`request-id.middleware.ts`, `api-response.ts`).
- Functions/variables: camelCase (`sendSuccess`, `requestLoggerMiddleware`).
- Classes/types/interfaces: PascalCase (`AppError`, `ApiResponse`).
- Constants: UPPER_SNAKE_CASE (`HTTP_STATUS`, `ERROR_CODE`).

## 6. TypeScript Rules
- `strict` mode must stay enabled.
- No `any` (use `unknown` + narrowing when needed).
- Type all public function params/returns.
- Extend framework types where needed (example: `Express.Request.requestId`).
- Avoid unsafe casts; prefer proper type guards.

## 7. Folder Responsibility
- `errors/`: error classes and error typing only.
- `middlewares/`: Express middleware only (request/response pipeline behavior).
- `utils/`: reusable framework-agnostic helpers (or thin shared helpers used by multiple layers).
- Keep business/domain logic out of these shared foundation folders.

## 8. Environment Rules
- Never read `process.env` directly in feature code.
- Read env only through centralized config module (`env`).
- Validate required env values in config layer, not inside handlers/services.

```ts
// Do
import env from "../config/env.js";
const port = env.port;

// Don't
const port = Number(process.env.PORT);
```

## 9. Do & Don't
- Do use `asyncHandler` for async route handlers.
- Do throw typed custom errors.
- Do use shared constants for status codes/messages/error codes.
- Do include `requestId` in logs when available.
- Don't call `res.json` directly in controllers/handlers.
- Don't return custom error payload shapes.
- Don't add inline env reads in random files.
- Don't use console logging.

## 10. Code Review Checklist
- Response uses shared helper and standard shape.
- No direct `res.json` / manual error JSON in handlers.
- Errors are custom typed errors (no plain `Error` for API flow).
- Logging uses shared logger; no `console.*`.
- Middleware order is preserved.
- No `any`; types are explicit and safe.
- No direct `process.env` usage outside config.
- New constants/messages/error codes are centralized.
