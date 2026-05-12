/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const isBlank = (value) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const PG_NUMERIC_20_12_MAX_INTEGER_DIGITS = 8;

function buildNumericError({ code, fieldName, value, message }) {
  const error = new Error(message);
  error.code = code;
  error.fieldName = fieldName;
  error.rawValue = value;
  return error;
}

function expandScientificNotation(normalized) {
  if (!/[eE]/.test(normalized)) {
    return normalized;
  }

  const sign = normalized.startsWith("-") ? "-" : "";
  const unsigned = normalized.startsWith("-") || normalized.startsWith("+") ? normalized.slice(1) : normalized;
  const [mantissaRaw, exponentRaw] = unsigned.split(/[eE]/);
  const exponent = Number(exponentRaw);
  if (!Number.isInteger(exponent)) {
    return normalized;
  }

  const [intPartRaw = "0", fracPartRaw = ""] = mantissaRaw.split(".");
  const intPart = intPartRaw.replace(/^0+/, "") || "0";
  const digits = `${intPart}${fracPartRaw}`;

  if (exponent >= 0) {
    if (exponent >= fracPartRaw.length) {
      const zeros = "0".repeat(exponent - fracPartRaw.length);
      return `${sign}${digits}${zeros}`;
    }
    const splitPos = intPart.length + exponent;
    return `${sign}${digits.slice(0, splitPos)}.${digits.slice(splitPos)}`;
  }

  const absExp = Math.abs(exponent);
  if (absExp >= intPart.length) {
    const zeros = "0".repeat(absExp - intPart.length);
    return `${sign}0.${zeros}${digits}`;
  }
  const splitPos = intPart.length - absExp;
  return `${sign}${digits.slice(0, splitPos)}.${digits.slice(splitPos)}`;
}

function trimDecimal(value) {
  const sign = value.startsWith("-") ? "-" : "";
  const unsigned = value.startsWith("-") || value.startsWith("+") ? value.slice(1) : value;
  const [integerPartRaw = "0", decimalPartRaw = ""] = unsigned.split(".");
  const integerPart = integerPartRaw.replace(/^0+/, "") || "0";
  const decimalPart = decimalPartRaw.replace(/0+$/, "");
  const normalized = decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
  if (normalized === "0") return "0";
  return sign === "-" ? `-${normalized}` : normalized;
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

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw buildNumericError({
      code: "invalid_numeric",
      fieldName,
      value,
      message: `invalid numeric in field ${fieldName}`,
    });
  }

  const expanded = expandScientificNotation(normalized);
  const normalizedNumeric = trimDecimal(expanded);
  const unsigned = normalizedNumeric.startsWith("-") ? normalizedNumeric.slice(1) : normalizedNumeric;

  const [integerPart = "0"] = unsigned.split(".");
  const trimmedIntegerPart = integerPart.replace(/^0+/, "") || "0";
  if (trimmedIntegerPart.length > PG_NUMERIC_20_12_MAX_INTEGER_DIGITS) {
    throw buildNumericError({
      code: "numeric_overflow",
      fieldName,
      value,
      message: `numeric overflow in field ${fieldName}`,
    });
  }

  return normalizedNumeric === "-0" ? "0" : normalizedNumeric;
}

const FACT_NUMERIC_FIELDS = Object.freeze([
  "billed_cost",
  "effective_cost",
  "list_cost",
  "consumed_quantity",
  "pricing_quantity",
  "public_on_demand_cost",
  "public_on_demand_rate",
  "bundled_discount",
  "discount_amount",
  "credit_amount",
  "refund_amount",
  "tax_cost",
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

  if (combined.includes("column") && combined.includes("tag_id") && combined.includes("does not exist")) {
    return {
      errorCode: "schema_mismatch_missing_tag_id",
      errorMessage:
        "database schema mismatch: fact_cost_line_items.tag_id is missing (run latest backend migrations)",
    };
  }

  if (
    combined.includes("column") &&
    combined.includes("of relation") &&
    combined.includes("fact_cost_line_items") &&
    combined.includes("does not exist")
  ) {
    return {
      errorCode: "schema_mismatch_fact_cost_line_items_columns",
      errorMessage:
        "database schema mismatch: fact_cost_line_items is missing one or more expected columns (run latest backend migrations)",
    };
  }

  if (combined.includes("relation") && combined.includes("dim_tag") && combined.includes("does not exist")) {
    return {
      errorCode: "schema_mismatch_missing_dim_tag",
      errorMessage: "database schema mismatch: dim_tag table is missing (run latest backend migrations)",
    };
  }

  return {
    errorCode: "fact_insert_error",
    errorMessage: message,
  };
}

export { sanitizeNumeric18_6, sanitizeFactMeasureNumerics, classifyFactInsertError };




