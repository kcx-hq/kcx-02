// @ts-nocheck
const isBlank = (value) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const PG_NUMERIC_18_6_MAX_INTEGER_DIGITS = 12;

function buildNumericError({ code, fieldName, value, message }) {
  const error = new Error(message);
  error.code = code;
  error.fieldName = fieldName;
  error.rawValue = value;
  return error;
}

function sanitizeNumeric18_6(value, fieldName) {
  if (isBlank(value)) {
    return null;
  }

  const normalized =
    typeof value === "string"
      ? value.trim().replace(/,/g, "")
      : typeof value === "number"
        ? String(value)
        : String(value ?? "").trim();

  const numericShape = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!numericShape.test(normalized)) {
    throw buildNumericError({
      code: "invalid_numeric",
      fieldName,
      value,
      message: `invalid numeric in field ${fieldName}`,
    });
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw buildNumericError({
      code: "invalid_numeric",
      fieldName,
      value,
      message: `invalid numeric in field ${fieldName}`,
    });
  }

  const roundedFixed = parsed.toFixed(6);
  const normalizedRounded = roundedFixed.startsWith("-0.000000") ? "0.000000" : roundedFixed;
  const unsigned = normalizedRounded.startsWith("-")
    ? normalizedRounded.slice(1)
    : normalizedRounded.startsWith("+")
      ? normalizedRounded.slice(1)
      : normalizedRounded;

  const [integerPart = "0"] = unsigned.split(".");
  const trimmedIntegerPart = integerPart.replace(/^0+/, "") || "0";
  if (trimmedIntegerPart.length > PG_NUMERIC_18_6_MAX_INTEGER_DIGITS) {
    throw buildNumericError({
      code: "numeric_overflow",
      fieldName,
      value,
      message: `numeric overflow in field ${fieldName}`,
    });
  }

  return normalizedRounded;
}

const FACT_NUMERIC_FIELDS = Object.freeze([
  "billed_cost",
  "effective_cost",
  "list_cost",
  "consumed_quantity",
  "pricing_quantity",
  "public_on_demand_cost",
]);

function sanitizeFactMeasureNumerics(rawMeasures) {
  const sanitized = { ...rawMeasures };
  for (const fieldName of FACT_NUMERIC_FIELDS) {
    sanitized[fieldName] = sanitizeNumeric18_6(rawMeasures[fieldName], fieldName);
  }
  return sanitized;
}

function classifyFactInsertError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const parentMessage =
    error && typeof error === "object" && "parent" in error && error.parent?.message
      ? String(error.parent.message)
      : "";
  const detailMessage =
    error && typeof error === "object" && "parent" in error && error.parent?.detail
      ? String(error.parent.detail)
      : "";
  const combined = `${message} ${parentMessage} ${detailMessage}`.toLowerCase();

  if (combined.includes("numeric field overflow")) {
    return {
      errorCode: "numeric_overflow",
      errorMessage: "numeric overflow detected while inserting cost fields",
    };
  }

  if (combined.includes("value too long for type character varying")) {
    return {
      errorCode: "value_too_long",
      errorMessage: "one or more text fields exceeded the allowed length",
    };
  }

  return {
    errorCode: "fact_insert_error",
    errorMessage: message,
  };
}

export { sanitizeNumeric18_6, sanitizeFactMeasureNumerics, classifyFactInsertError };

