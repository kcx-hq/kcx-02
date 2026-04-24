/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { sequelize } from "../../../models/index.js";

let isTagSchemaValidated = false;

const hasColumn = (tableDefinition, columnName) =>
  Boolean(tableDefinition && typeof tableDefinition === "object" && columnName in tableDefinition);

async function assertTagDimensionSchemaReady() {
  if (isTagSchemaValidated) return;

  const queryInterface = sequelize.getQueryInterface();
  const [factTable, dimTagTable, factTagsTable] = await Promise.all([
    queryInterface.describeTable("fact_cost_line_items"),
    queryInterface.describeTable("dim_tag"),
    queryInterface.describeTable("fact_cost_line_item_tags"),
  ]);

  if (!hasColumn(factTable, "tag_id")) {
    throw new Error(
      "Billing schema is outdated: fact_cost_line_items.tag_id is missing. Run backend migrations before ingestion.",
    );
  }

  const requiredFactColumns = [
    "product_usage_type",
    "product_family",
    "from_location",
    "to_location",
    "from_region_code",
    "to_region_code",
    "bill_type",
    "line_item_description",
    "legal_entity",
    "public_on_demand_rate",
    "bundled_discount",
  ];
  const missingFactColumns = requiredFactColumns.filter((columnName) => !hasColumn(factTable, columnName));
  if (missingFactColumns.length > 0) {
    throw new Error(
      `Billing schema is outdated: fact_cost_line_items is missing columns (${missingFactColumns.join(", ")}). Run backend migrations before ingestion.`,
    );
  }

  if (!hasColumn(dimTagTable, "id")) {
    throw new Error(
      "Billing schema is outdated: dim_tag table is missing. Run backend migrations before ingestion.",
    );
  }

  if (!hasColumn(factTagsTable, "fact_id") || !hasColumn(factTagsTable, "tag_id")) {
    throw new Error(
      "Billing schema is outdated: fact_cost_line_item_tags table is missing. Run backend migrations before ingestion.",
    );
  }

  isTagSchemaValidated = true;
}

export { assertTagDimensionSchemaReady };
