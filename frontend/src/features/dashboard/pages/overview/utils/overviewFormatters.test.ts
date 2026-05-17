import assert from "node:assert/strict";
import test from "node:test";

import { formatContributionPct, formatMoney } from "./overviewFormatters";

test("formatMoney normalizes tiny negative value to $0.00", () => {
  assert.equal(formatMoney(-0.0000000114), "$0.00");
});

test("formatMoney rounds -0.004 to $0.00 and keeps real negatives", () => {
  assert.equal(formatMoney(-0.004), "$0.00");
  assert.equal(formatMoney(-1.23), "-$1.23");
});

test("formatContributionPct returns N/A for null", () => {
  assert.equal(formatContributionPct(null), "N/A");
});

