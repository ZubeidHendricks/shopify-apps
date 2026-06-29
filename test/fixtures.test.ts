/**
 * Fixture replay: every preset ships a fixtures/run.input.json that is BOTH
 * (a) the input fed here through run(), and (b) a drop-in for the Shopify local
 * function runner: `shopify app function run --input fixtures/run.input.json`.
 *
 * This proves each fixture is correctly shaped for its Function and produces a
 * real effect — the same fixtures verify locally once the app is linked.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { run as volume } from "../templates/presets/discount-qty/extensions/discount/src/run.ts";
import { run as spend } from "../templates/presets/discount-spend/extensions/discount/src/run.ts";
import { run as bogo } from "../templates/presets/bogo/extensions/discount/src/run.ts";
import { run as firstOrder } from "../templates/presets/first-order/extensions/discount/src/run.ts";
import { run as bundle } from "../templates/presets/bundle/extensions/discount/src/run.ts";
import { run as freeShipping } from "../templates/presets/free-shipping/extensions/discount/src/run.ts";
import { run as minMax } from "../templates/presets/cart-min-max/extensions/validation/src/run.ts";
import { run as productLimit } from "../templates/presets/per-product-limit/extensions/validation/src/run.ts";
import { run as countryBlock } from "../templates/presets/country-block/extensions/validation/src/run.ts";
import { run as hidePayment } from "../templates/presets/payment-hide/extensions/payment/src/run.ts";
import { run as hideDelivery } from "../templates/presets/delivery-hide/extensions/delivery/src/run.ts";
import { run as renameShipping } from "../templates/presets/rename-shipping/extensions/delivery/src/run.ts";

const fixture = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));

const hasDiscount = (r: any) => Array.isArray(r.discounts) && r.discounts.length > 0;
const hasOps = (r: any) => Array.isArray(r.operations) && r.operations.length > 0;

const cases: Array<{ kind: string; run: (i: any) => any; path: string; expect: (r: any) => boolean }> = [
  { kind: "discount-qty", run: volume, path: "../templates/presets/discount-qty/extensions/discount/fixtures/run.input.json", expect: hasDiscount },
  { kind: "discount-spend", run: spend, path: "../templates/presets/discount-spend/extensions/discount/fixtures/run.input.json", expect: hasDiscount },
  { kind: "bogo", run: bogo, path: "../templates/presets/bogo/extensions/discount/fixtures/run.input.json", expect: hasDiscount },
  { kind: "first-order", run: firstOrder, path: "../templates/presets/first-order/extensions/discount/fixtures/run.input.json", expect: hasDiscount },
  { kind: "bundle", run: bundle, path: "../templates/presets/bundle/extensions/discount/fixtures/run.input.json", expect: hasDiscount },
  { kind: "free-shipping", run: freeShipping, path: "../templates/presets/free-shipping/extensions/discount/fixtures/run.input.json", expect: hasOps },
  { kind: "cart-min-max", run: minMax, path: "../templates/presets/cart-min-max/extensions/validation/fixtures/run.input.json", expect: hasOps },
  { kind: "per-product-limit", run: productLimit, path: "../templates/presets/per-product-limit/extensions/validation/fixtures/run.input.json", expect: hasOps },
  { kind: "country-block", run: countryBlock, path: "../templates/presets/country-block/extensions/validation/fixtures/run.input.json", expect: hasOps },
  { kind: "payment-hide", run: hidePayment, path: "../templates/presets/payment-hide/extensions/payment/fixtures/run.input.json", expect: hasOps },
  { kind: "delivery-hide", run: hideDelivery, path: "../templates/presets/delivery-hide/extensions/delivery/fixtures/run.input.json", expect: hasOps },
  { kind: "rename-shipping", run: renameShipping, path: "../templates/presets/rename-shipping/extensions/delivery/fixtures/run.input.json", expect: hasOps },
];

for (const c of cases) {
  test(`fixture[${c.kind}] produces an effect`, () => {
    const result = c.run(fixture(c.path));
    assert.ok(c.expect(result), `expected a non-empty result for ${c.kind}, got ${JSON.stringify(result)}`);
  });
}
