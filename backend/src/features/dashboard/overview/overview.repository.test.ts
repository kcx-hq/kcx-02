import assert from "node:assert/strict";
import test from "node:test";

import { computeContributionPct } from "./overview.repository.js";

test("contributionPct returns null when totalSpend is near zero", () => {
  assert.equal(computeContributionPct(10, 0.009), null);
  assert.equal(computeContributionPct(-5, -0.009), null);
});

