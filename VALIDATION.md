# GraphQL / schema validation log

Validating the hand-written GraphQL (input `run.graphql` queries) and Function
output shapes against Shopify's published schemas. Source for this pass:
shopify.dev Function API reference (the Shopify Dev MCP server is wired in
`.mcp.json` for version-exact introspection once a session reload loads its
tools — see "Pending" below).

## Fixed in this pass ✅

### Discount Functions used the legacy output shape
Target `cart.lines.discounts.generate.run` (the unified Discount API) returns
`CartLinesDiscountsGenerateRunResult { operations: [...] }`, **not** the legacy
`{ discountApplicationStrategy, discounts }`. Rewrote all five:

| App | Operation | Target type |
| --- | --- | --- |
| volume-discount, spend-save, bundle-discount, first-order-discount | `orderDiscountsAdd { selectionStrategy, candidates }` | `orderSubtotal { excludedCartLineIds }` |
| bogo | `productDiscountsAdd { selectionStrategy, candidates }` | `cartLine { id }` |

Also fixed the target field name `excludedVariantIds` → **`excludedCartLineIds`**
(the correct field on `OrderSubtotalTarget`). Candidate shape confirmed:
`{ message, value: { percentage | fixedAmount }, targets }`.

Input queries for these were already correct: `cart.lines{ id, quantity,
cost.amountPerQuantity.amount }`, `cart.cost.subtotalAmount.amount`,
`cart.buyerIdentity.customer.numberOfOrders`.

## Confirmed correct ✅

- **free-shipping** — `cart.delivery-options.discounts.generate.run` returns
  `deliveryDiscountsAdd { selectionStrategy: "ALL", candidates }` with
  `value.percentage`. Matches. (Target `deliveryGroup { id }` is plausible but
  see Pending — `DeliveryOption { handle }` is the other documented target.)
- **cart validation** (order-limits, product-limits, country-block) —
  `cart.validations.generate.run` → `operations: [{ validationAdd: { errors:
  [{ message, target }] } }]`. Matches.
- All input `run.graphql` field names verified against the schemas.

## Pending — needs MCP introspection (version-exact) ⏳

The latest docs describe the **transform** API for these, with renamed
operations and possibly renamed targets — but the exact target string for
`api_version = "2025-01"` is ambiguous from docs alone, and a legacy target with
new op names (or vice-versa) is guaranteed wrong. Deferring rather than guessing:

| App | Current (legacy) | Docs suggest (transform API) |
| --- | --- | --- |
| hide-payment | target `purchase.payment-customization.run`, op `hide{paymentMethodId}` | `paymentMethodHide{paymentMethodId}`, type `CartPaymentMethodsTransformRunResult` |
| hide-delivery | target `purchase.delivery-customization.run`, op `hide{deliveryOptionHandle}` | `deliveryOptionHide{deliveryOptionHandle}`, type `CartDeliveryOptionsTransformRunResult` |
| rename-shipping | ops `rename`/`move` | `deliveryOptionRename`/`deliveryOptionMove` |

**To resolve:** reload the session so the `shopify-dev` MCP tools load, then
introspect the payment/delivery customization schemas for `2025-01` and confirm
the exact target + operation names before changing these three.

## How this was verified

- `npm test` (41 tests) — logic + per-preset gating + fixture replay, all green
  after the discount rewrite.
- `npm run verify -- <slug>` — runs typegen/build/`function run` against the
  fixture once an app is linked (authoritative output-shape check via Shopify's
  own toolchain).
