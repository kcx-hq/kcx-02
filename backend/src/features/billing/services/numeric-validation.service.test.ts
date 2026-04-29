import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeNumeric18_6, sanitizeFactMeasureNumerics } from "./numeric-validation.service.js";

test("sanitizeNumeric18_6 parses scientific notation 8e-7", () => {
  const result = sanitizeNumeric18_6("8e-7", "billed_cost");
  assert.equal(result, "0.0000008");
});

test("sanitizeNumeric18_6 parses scientific notation 1e-5", () => {
  const result = sanitizeNumeric18_6("1e-5", "effective_cost");
  assert.equal(result, "0.00001");
});

test("sanitizeNumeric18_6 keeps null nullable fields", () => {
  assert.equal(sanitizeNumeric18_6(null, "discount_amount"), null);
});

test("sanitizeFactMeasureNumerics normalizes public_on_demand fields from exponent", () => {
  const result = sanitizeFactMeasureNumerics({
    billed_cost: "8e-7",
    effective_cost: "1e-5",
    list_cost: null,
    consumed_quantity: null,
    pricing_quantity: null,
    public_on_demand_cost: "8e-7",
    public_on_demand_rate: "1e-5",
    bundled_discount: null,
    discount_amount: null,
    credit_amount: null,
    refund_amount: null,
    tax_cost: null,
  });

  assert.equal(result.billed_cost, "0.0000008");
  assert.equal(result.effective_cost, "0.00001");
  assert.equal(result.public_on_demand_cost, "0.0000008");
  assert.equal(result.public_on_demand_rate, "0.00001");
  assert.equal(result.discount_amount, null);
});
