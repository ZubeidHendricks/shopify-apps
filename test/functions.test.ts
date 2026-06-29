import { test } from "node:test";
import assert from "node:assert/strict";

import { run as volume } from "../templates/presets/discount-qty/extensions/discount/src/run.ts";
import { run as spend } from "../templates/presets/discount-spend/extensions/discount/src/run.ts";
import { run as bogo } from "../templates/presets/bogo/extensions/discount/src/run.ts";
import { run as firstOrder } from "../templates/presets/first-order/extensions/discount/src/run.ts";
import { run as bundle } from "../templates/presets/bundle/extensions/discount/src/run.ts";
import { run as minMax } from "../templates/presets/cart-min-max/extensions/validation/src/run.ts";
import { run as productLimit } from "../templates/presets/per-product-limit/extensions/validation/src/run.ts";
import { run as hidePayment } from "../templates/presets/payment-hide/extensions/payment/src/run.ts";
import { run as hideDelivery } from "../templates/presets/delivery-hide/extensions/delivery/src/run.ts";
import { run as renameShipping } from "../templates/presets/rename-shipping/extensions/delivery/src/run.ts";
import { run as freeShipping } from "../templates/presets/free-shipping/extensions/discount/src/run.ts";
import { run as countryBlock } from "../templates/presets/country-block/extensions/validation/src/run.ts";

// Helpers to build the metafield envelope the Functions read.
const node = (cfg: unknown) => ({ metafield: { value: JSON.stringify(cfg) } });
const shop = (cfg: unknown) => ({ metafield: { value: JSON.stringify(cfg) } });

// Accessors for the unified Discount API result shape (operations[]).
const orderCands = (r: any) => r.operations[0]?.orderDiscountsAdd?.candidates ?? [];
const productCands = (r: any) => r.operations[0]?.productDiscountsAdd?.candidates ?? [];
const noOps = (r: any) => (r.operations?.length ?? 0) === 0;

// ---------------------------------------------------------------------------
// discount-qty (volume)
// ---------------------------------------------------------------------------
test("volume: no config => no discount", () => {
  const r = volume({ cart: { lines: [{ quantity: 9 }] }, discountNode: { metafield: null } } as any);
  assert.ok(noOps(r));
});

test("volume: applies tier when quantity threshold met", () => {
  const cfg = { plan: "starter", tiers: [{ threshold: 3, percentage: 10 }] };
  const r = volume({ cart: { lines: [{ quantity: 2 }, { quantity: 2 }] }, discountNode: node(cfg) } as any);
  assert.equal(orderCands(r)[0].value.percentage.value, "10");
  assert.deepEqual(orderCands(r)[0].targets, [{ orderSubtotal: { excludedCartLineIds: [] } }]);
});

test("volume: starter ignores extra tiers, pro honors them", () => {
  const tiers = [{ threshold: 3, percentage: 10 }, { threshold: 6, percentage: 25 }];
  const lines = [{ quantity: 6 }];
  const starter = volume({ cart: { lines }, discountNode: node({ plan: "starter", tiers }) } as any);
  const pro = volume({ cart: { lines }, discountNode: node({ plan: "pro", tiers }) } as any);
  assert.equal(orderCands(starter)[0].value.percentage.value, "10"); // capped to first tier
  assert.equal(orderCands(pro)[0].value.percentage.value, "25");
});

// ---------------------------------------------------------------------------
// discount-spend
// ---------------------------------------------------------------------------
test("spend: discount keyed off subtotal", () => {
  const cfg = { plan: "pro", tiers: [{ threshold: 50, percentage: 10 }, { threshold: 100, percentage: 20 }] };
  const below = spend({ cart: { cost: { subtotalAmount: { amount: "40.00" } } }, discountNode: node(cfg) } as any);
  const high = spend({ cart: { cost: { subtotalAmount: { amount: "120.00" } } }, discountNode: node(cfg) } as any);
  assert.ok(noOps(below));
  assert.equal(orderCands(high)[0].value.percentage.value, "20");
});

// ---------------------------------------------------------------------------
// bogo
// ---------------------------------------------------------------------------
test("bogo: starter is buy-1-get-1-free regardless of config", () => {
  const cfg = { plan: "starter", buyQty: 5, getQty: 5, percentage: 50 };
  const r = bogo({ cart: { lines: [{ id: "l1", quantity: 4, cost: { amountPerQuantity: { amount: "10.00" } } }] }, discountNode: node(cfg) } as any);
  // groupSize=2, sets=2, freeItems=2, unit 10 => 20.00 off
  assert.equal(productCands(r)[0].value.fixedAmount.amount, "20.00");
  assert.deepEqual(productCands(r)[0].targets, [{ cartLine: { id: "l1" } }]);
});

test("bogo: pro honors custom buy/get/percentage", () => {
  const cfg = { plan: "pro", buyQty: 2, getQty: 1, percentage: 50 };
  const r = bogo({ cart: { lines: [{ id: "l1", quantity: 3, cost: { amountPerQuantity: { amount: "30.00" } } }] }, discountNode: node(cfg) } as any);
  // groupSize=3, sets=1, discounted=1 unit @50% of 30 => 15.00
  assert.equal(productCands(r)[0].value.fixedAmount.amount, "15.00");
});

test("bogo: below group size => no discount", () => {
  const r = bogo({ cart: { lines: [{ id: "l1", quantity: 1, cost: { amountPerQuantity: { amount: "10.00" } } }] }, discountNode: node({ plan: "starter" }) } as any);
  assert.ok(noOps(r));
});

// ---------------------------------------------------------------------------
// first-order
// ---------------------------------------------------------------------------
test("first-order: new logged-in customer qualifies, returning does not", () => {
  const cfg = { plan: "starter", percentage: 15, includeGuests: false };
  const newC = firstOrder({ cart: { buyerIdentity: { customer: { numberOfOrders: 0 } } }, discountNode: node(cfg) } as any);
  const ret = firstOrder({ cart: { buyerIdentity: { customer: { numberOfOrders: 3 } } }, discountNode: node(cfg) } as any);
  assert.equal(orderCands(newC)[0].value.percentage.value, "15");
  assert.ok(noOps(ret));
});

test("first-order: guests only when pro + includeGuests", () => {
  const guestCart = { cart: { buyerIdentity: { customer: null } } };
  const starter = firstOrder({ ...guestCart, discountNode: node({ plan: "starter", percentage: 15, includeGuests: true }) } as any);
  const pro = firstOrder({ ...guestCart, discountNode: node({ plan: "pro", percentage: 15, includeGuests: true }) } as any);
  assert.ok(noOps(starter));
  assert.equal(orderCands(pro)[0].value.percentage.value, "15");
});

// ---------------------------------------------------------------------------
// bundle
// ---------------------------------------------------------------------------
test("bundle: needs minItems distinct lines; starter locked to 2", () => {
  const oneLine = { cart: { lines: [{ id: "a" }] } };
  const twoLines = { cart: { lines: [{ id: "a" }, { id: "b" }] } };
  assert.ok(noOps(bundle({ ...oneLine, discountNode: node({ plan: "starter", minItems: 2, percentage: 10 }) } as any)));
  assert.equal(orderCands(bundle({ ...twoLines, discountNode: node({ plan: "starter", minItems: 99, percentage: 10 }) } as any))[0].value.percentage.value, "10");
});

test("bundle: pro can raise the threshold", () => {
  const threeLines = { cart: { lines: [{ id: "a" }, { id: "b" }, { id: "c" }] } };
  const r = bundle({ ...threeLines, discountNode: node({ plan: "pro", minItems: 4, percentage: 10 }) } as any);
  assert.ok(noOps(r)); // 3 < 4
});

// ---------------------------------------------------------------------------
// cart-min-max (validation)
// ---------------------------------------------------------------------------
test("min-max: blocks below minimum subtotal", () => {
  const cfg = { plan: "starter", minSubtotal: 50, maxItems: 0 };
  const r = minMax({ cart: { cost: { subtotalAmount: { amount: "30.00" } }, lines: [{ quantity: 1 }] }, shop: shop(cfg) } as any);
  assert.equal(r.operations[0].validationAdd.errors.length, 1);
});

test("min-max: max-items is pro-only", () => {
  const cfg = (plan: string) => ({ plan, minSubtotal: 0, maxItems: 5 });
  const cart = { cost: { subtotalAmount: { amount: "999.00" } }, lines: [{ quantity: 10 }] };
  assert.equal(minMax({ cart, shop: shop(cfg("starter")) } as any).operations.length, 0);
  assert.equal(minMax({ cart, shop: shop(cfg("pro")) } as any).operations[0].validationAdd.errors.length, 1);
});

// ---------------------------------------------------------------------------
// per-product-limit (validation)
// ---------------------------------------------------------------------------
test("product-limit: global cap blocks oversized line", () => {
  const cfg = { plan: "starter", defaultMax: 2, perVariant: {} };
  const line = { quantity: 3, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/1", title: "Tee" } };
  const r = productLimit({ cart: { lines: [line] }, shop: shop(cfg) } as any);
  assert.match(r.operations[0].validationAdd.errors[0].message, /at most 2 of Tee/);
});

test("product-limit: per-variant override is pro-only", () => {
  const variant = "gid://shopify/ProductVariant/42";
  const cfg = (plan: string) => ({ plan, defaultMax: 0, perVariant: { [variant]: 1 } });
  const line = { quantity: 2, merchandise: { __typename: "ProductVariant", id: variant, title: "Hat" } };
  assert.equal(productLimit({ cart: { lines: [line] }, shop: shop(cfg("starter")) } as any).operations.length, 0);
  assert.equal(productLimit({ cart: { lines: [line] }, shop: shop(cfg("pro")) } as any).operations[0].validationAdd.errors.length, 1);
});

// ---------------------------------------------------------------------------
// payment-hide
// ---------------------------------------------------------------------------
test("payment-hide: hides named method below threshold", () => {
  const cfg = { plan: "starter", methodName: "Cash on Delivery", hideBelow: 100, hideCountries: [] };
  const input = {
    paymentMethods: [{ id: "pm1", name: "Cash on Delivery" }, { id: "pm2", name: "Card" }],
    cart: { cost: { totalAmount: { amount: "50.00" } }, deliveryGroups: [] },
    shop: shop(cfg),
  };
  const r = hidePayment(input as any);
  assert.deepEqual(r.operations, [{ hide: { paymentMethodId: "pm1" } }]);
});

test("payment-hide: country rule is pro-only", () => {
  const cfg = (plan: string) => ({ plan, methodName: "Card", hideBelow: 0, hideCountries: ["US"] });
  const input = (plan: string) => ({
    paymentMethods: [{ id: "pm2", name: "Card" }],
    cart: { cost: { totalAmount: { amount: "999.00" } }, deliveryGroups: [{ deliveryAddress: { countryCode: "US" } }] },
    shop: shop(cfg(plan)),
  });
  assert.equal(hidePayment(input("starter") as any).operations.length, 0);
  assert.equal(hidePayment(input("pro") as any).operations.length, 1);
});

// ---------------------------------------------------------------------------
// delivery-hide
// ---------------------------------------------------------------------------
test("delivery-hide: hides matching option below subtotal", () => {
  const cfg = { plan: "starter", optionTitle: "Express", hideBelow: 75, hideCountries: [] };
  const input = {
    cart: {
      cost: { subtotalAmount: { amount: "40.00" } },
      deliveryGroups: [{ deliveryAddress: { countryCode: "US" }, deliveryOptions: [{ handle: "exp", title: "Express" }, { handle: "std", title: "Standard" }] }],
    },
    shop: shop(cfg),
  };
  const r = hideDelivery(input as any);
  assert.deepEqual(r.operations, [{ hide: { deliveryOptionHandle: "exp" } }]);
});

// ---------------------------------------------------------------------------
// rename-shipping
// ---------------------------------------------------------------------------
test("rename-shipping: renames; pro adds move-to-top", () => {
  const base = {
    cart: { deliveryGroups: [{ deliveryOptions: [{ handle: "std", title: "Standard" }] }] },
  };
  const starter = renameShipping({ ...base, shop: shop({ plan: "starter", matchTitle: "Standard", newName: "Free Shipping", moveToTop: true }) } as any);
  assert.deepEqual(starter.operations, [{ rename: { deliveryOptionHandle: "std", title: "Free Shipping" } }]);

  const pro = renameShipping({ ...base, shop: shop({ plan: "pro", matchTitle: "Standard", newName: "Free Shipping", moveToTop: true }) } as any);
  assert.equal(pro.operations.length, 2);
  assert.deepEqual(pro.operations[1], { move: { deliveryOptionHandle: "std", index: 0 } });
});

// ---------------------------------------------------------------------------
// free-shipping (delivery discount)
// ---------------------------------------------------------------------------
test("free-shipping: grants free shipping per delivery group over threshold", () => {
  const cfg = { plan: "starter", tiers: [{ threshold: 75, percentage: 100 }] };
  const input = (subtotal: string) => ({
    cart: { cost: { subtotalAmount: { amount: subtotal } }, deliveryGroups: [{ id: "dg1" }, { id: "dg2" }] },
    discountNode: node(cfg),
  });
  assert.equal(freeShipping(input("40.00") as any).operations.length, 0);
  const r = freeShipping(input("100.00") as any);
  assert.equal(r.operations[0].deliveryDiscountsAdd.candidates.length, 2);
  assert.equal(r.operations[0].deliveryDiscountsAdd.candidates[0].value.percentage.value, "100");
});

test("free-shipping: second threshold is pro-only", () => {
  const tiers = [{ threshold: 75, percentage: 100 }, { threshold: 50, percentage: 50 }];
  const input = (plan: string) => ({
    cart: { cost: { subtotalAmount: { amount: "60.00" } }, deliveryGroups: [{ id: "dg1" }] },
    discountNode: node({ plan, tiers }),
  });
  // subtotal 60: starter only sees the first tier (threshold 75 -> not met) => no-op
  assert.equal(freeShipping(input("starter") as any).operations.length, 0);
  // pro sees both; the 50-threshold/50% tier applies
  assert.equal(freeShipping(input("pro") as any).operations[0].deliveryDiscountsAdd.candidates[0].value.percentage.value, "50");
});

// ---------------------------------------------------------------------------
// country-block (validation)
// ---------------------------------------------------------------------------
test("country-block: blocklist blocks listed country", () => {
  const cfg = { plan: "starter", blockedCountries: ["RU"], allowedCountries: [], allowlistMode: false };
  const blocked = countryBlock({ cart: { deliveryGroups: [{ deliveryAddress: { countryCode: "RU" } }] }, shop: shop(cfg) } as any);
  const ok = countryBlock({ cart: { deliveryGroups: [{ deliveryAddress: { countryCode: "US" } }] }, shop: shop(cfg) } as any);
  assert.equal(blocked.operations.length, 1);
  assert.equal(ok.operations.length, 0);
});

test("country-block: allowlist mode is pro-only", () => {
  const cfg = (plan: string) => ({ plan, blockedCountries: [], allowedCountries: ["US"], allowlistMode: true });
  const cart = { deliveryGroups: [{ deliveryAddress: { countryCode: "GB" } }] };
  // starter ignores allowlist (no blocked list) => allowed through
  assert.equal(countryBlock({ cart, shop: shop(cfg("starter")) } as any).operations.length, 0);
  // pro enforces allowlist: GB not allowed => blocked
  assert.equal(countryBlock({ cart, shop: shop(cfg("pro")) } as any).operations.length, 1);
});
