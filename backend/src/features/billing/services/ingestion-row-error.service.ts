// @ts-nocheck
import { BillingIngestionRowError } from "../../../models/index.js";

async function recordIngestionRowErrors({ rowErrors }) {
  if (!Array.isArray(rowErrors) || rowErrors.length === 0) {
    return { insertedCount: 0 };
  }

  await BillingIngestionRowError.bulkCreate(rowErrors);
  return { insertedCount: rowErrors.length };
}

export { recordIngestionRowErrors };

