import {
  CANONICAL_COLUMNS,
  REQUIRED_COLUMNS,
  buildAliasLookup as buildSchemaAliasLookup,
  normalizeHeaderName,
} from "../schema/schema-definition.js";

/**
 * This service normalizes file schema shape into canonical raw billing columns.
 * CSV has no embedded schema, so validation is based on the header row.
 * Parquet stores schema metadata, so validation should run on schema columns
 * before full row reads. This keeps mapper/dimension/fact services unchanged.
 */

const CANONICAL_COLUMN_SET = new Set(CANONICAL_COLUMNS);
const ALIAS_LOOKUP = buildSchemaAliasLookup();

const toSortedArray = (setLike) => Array.from(setLike).sort((a, b) => a.localeCompare(b));

function sortByHeader(a, b) {
  return String(a?.header ?? "").localeCompare(String(b?.header ?? ""));
}

function toSet(value) {
  if (!value) return new Set();
  if (value instanceof Set) return value;
  return new Set([value]);
}

function findCanonicalCandidates(header) {
  const rawHeader = String(header ?? "");
  const lowerHeader = rawHeader.toLowerCase();
  const normalizedHeader = normalizeHeaderName(rawHeader);

  // Step 1: exact match
  if (CANONICAL_COLUMN_SET.has(rawHeader)) {
    return { matchedBy: "exact", candidates: new Set([rawHeader]) };
  }

  // Step 2: case-insensitive match against canonical names
  const caseInsensitiveCanonicalMatches = new Set(
    CANONICAL_COLUMNS.filter((canonical) => canonical.toLowerCase() === lowerHeader),
  );
  if (caseInsensitiveCanonicalMatches.size > 0) {
    return { matchedBy: "case-insensitive", candidates: caseInsensitiveCanonicalMatches };
  }

  // Step 3: normalized canonical-name match
  const normalizedCanonicalMatches = new Set(
    CANONICAL_COLUMNS.filter((canonical) => normalizeHeaderName(canonical) === normalizedHeader),
  );
  if (normalizedCanonicalMatches.size > 0) {
    return { matchedBy: "normalized", candidates: normalizedCanonicalMatches };
  }

  // Step 4: alias lookup match (exact -> case-insensitive -> normalized)
  const exactAliasMatches = toSet(ALIAS_LOOKUP.exactAliasLookup.get(rawHeader));
  if (exactAliasMatches.size > 0) {
    return { matchedBy: "alias-exact", candidates: exactAliasMatches };
  }

  const lowerAliasMatches = toSet(ALIAS_LOOKUP.lowerAliasLookup.get(lowerHeader));
  if (lowerAliasMatches.size > 0) {
    return { matchedBy: "alias-case-insensitive", candidates: lowerAliasMatches };
  }

  const normalizedAliasMatches = toSet(ALIAS_LOOKUP.normalizedAliasLookup.get(normalizedHeader));
  if (normalizedAliasMatches.size > 0) {
    return { matchedBy: "alias-normalized", candidates: normalizedAliasMatches };
  }

  return { matchedBy: "none", candidates: new Set() };
}

function buildCanonicalHeaderMap(headers = []) {
  const canonicalHeaderMap = {};
  const unknownHeaders = [];
  const ambiguousHeaders = [];

  for (const header of headers) {
    const originalHeader = String(header ?? "");
    const { matchedBy, candidates } = findCanonicalCandidates(originalHeader);

    if (candidates.size === 0) {
      unknownHeaders.push(originalHeader);
      continue;
    }

    if (candidates.size > 1) {
      ambiguousHeaders.push({
        header: originalHeader,
        reason: "header_matches_multiple_canonical_columns",
        candidates: toSortedArray(candidates),
        matchedBy,
      });
      continue;
    }

    const [canonicalColumn] = candidates;
    const existingHeader = canonicalHeaderMap[canonicalColumn];

    if (existingHeader && existingHeader !== originalHeader) {
      ambiguousHeaders.push({
        header: originalHeader,
        canonicalColumn,
        reason: "multiple_input_headers_for_same_canonical_column",
        candidates: [existingHeader, originalHeader].sort((a, b) => a.localeCompare(b)),
      });
      continue;
    }

    canonicalHeaderMap[canonicalColumn] = originalHeader;
  }

  return {
    canonicalHeaderMap,
    unknownHeaders: unknownHeaders.sort((a, b) => a.localeCompare(b)),
    ambiguousHeaders: ambiguousHeaders.sort(sortByHeader),
  };
}

function validateHeaders(headers = []) {
  const { canonicalHeaderMap, unknownHeaders, ambiguousHeaders } = buildCanonicalHeaderMap(headers);

  const missingRequiredColumns = REQUIRED_COLUMNS.filter(
    (requiredColumn) => !canonicalHeaderMap[requiredColumn],
  );

  const success = missingRequiredColumns.length === 0 && ambiguousHeaders.length === 0;

  return {
    success,
    canonicalHeaderMap,
    missingRequiredColumns,
    unknownHeaders,
    ambiguousHeaders,
  };
}

function validateSchemaByFormat({ fileFormat, headers = [], schemaColumns = [] } = {}) {
  const normalizedFormat = String(fileFormat ?? "").trim().toLowerCase();

  if (normalizedFormat === "csv") {
    return validateHeaders(headers);
  }

  if (normalizedFormat === "parquet") {
    return validateHeaders(schemaColumns);
  }

  throw new Error(`Unsupported file format for schema validation: ${fileFormat}`);
}

function normalizeRowToCanonical(rawRow = {}, canonicalHeaderMap = {}) {
  const normalizedRow = {};

  for (const canonicalColumn of CANONICAL_COLUMNS) {
    const sourceHeader = canonicalHeaderMap[canonicalColumn];

    if (!sourceHeader) {
      normalizedRow[canonicalColumn] = null;
      continue;
    }

    const value = rawRow[sourceHeader];
    normalizedRow[canonicalColumn] = value === undefined ? null : value;
  }

  return normalizedRow;
}

function validateAndNormalizeRows({ headers = [], rows = [] } = {}) {
  const validation = validateHeaders(headers);

  if (!validation.success) {
    return {
      ...validation,
      normalizedRows: [],
    };
  }

  const normalizedRows = rows.map((rawRow) =>
    normalizeRowToCanonical(rawRow, validation.canonicalHeaderMap),
  );

  return {
    ...validation,
    normalizedRows,
  };
}

function validateAndNormalizeByFormat({
  fileFormat,
  headers = [],
  schemaColumns = [],
  rows = [],
} = {}) {
  const validation = validateSchemaByFormat({
    fileFormat,
    headers,
    schemaColumns,
  });

  if (!validation.success) {
    return {
      ...validation,
      normalizedRows: [],
    };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ...validation,
      normalizedRows: [],
    };
  }

  const normalizedRows = rows.map((rawRow) =>
    normalizeRowToCanonical(rawRow, validation.canonicalHeaderMap),
  );

  return {
    ...validation,
    normalizedRows,
  };
}

function buildSchemaValidationErrorMessage(validation) {
  const missingRequiredColumns = Array.isArray(validation?.missingRequiredColumns)
    ? validation.missingRequiredColumns
    : [];
  const ambiguousHeaders = Array.isArray(validation?.ambiguousHeaders) ? validation.ambiguousHeaders : [];
  const unknownHeaders = Array.isArray(validation?.unknownHeaders) ? validation.unknownHeaders : [];

  const parts = ["Schema validation failed."];

  if (missingRequiredColumns.length > 0) {
    parts.push(`Missing required columns: ${missingRequiredColumns.join(", ")}.`);
  }

  if (ambiguousHeaders.length > 0) {
    const ambiguousHeaderNames = ambiguousHeaders
      .map((item) => (typeof item === "string" ? item : item?.header))
      .filter(Boolean);
    parts.push(`Ambiguous headers: ${ambiguousHeaderNames.join(", ")}.`);
  }

  if (unknownHeaders.length > 0) {
    parts.push(`Unknown headers: ${unknownHeaders.join(", ")}.`);
  }

  return parts.join(" ");
}

export {
  normalizeHeaderName,
  buildCanonicalHeaderMap,
  validateHeaders,
  validateSchemaByFormat,
  normalizeRowToCanonical,
  validateAndNormalizeRows,
  validateAndNormalizeByFormat,
  buildSchemaValidationErrorMessage,
};
