import assert from "node:assert/strict";
import test from "node:test";

import { hasRenderableCoordinate } from "./TopRegionsGeoMap";

test("map rendering guard returns false for region without coordinates", () => {
  assert.equal(
    hasRenderableCoordinate({
      name: "No Region",
      latitude: null,
      longitude: null,
    }),
    false,
  );
});

test("map rendering guard returns true when coordinates are present", () => {
  assert.equal(
    hasRenderableCoordinate({
      name: "No Region",
      latitude: 10,
      longitude: 20,
    }),
    true,
  );
});

