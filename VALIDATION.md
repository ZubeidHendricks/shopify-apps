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

## Migrated to the transform API ✅

The customization Functions used the legacy `purchase.*-customization.run`
targets with unprefixed `hide`/`rename`/`move` operations. Migrated all three to
the current transform API (target + operation names + result type) per the
shopify.dev reference:

| App | Now |
| --- | --- |
| hide-payment | target `cart.payment-methods.transform.run`, op `paymentMethodHide{paymentMethodId}`, type `CartPaymentMethodsTransformRunResult` |
| hide-delivery | target `cart.delivery-options.transform.run`, op `deliveryOptionHide{deliveryOptionHandle}`, type `CartDeliveryOptionsTransformRunResult` |
| rename-shipping | target `cart.delivery-options.transform.run`, ops `deliveryOptionRename{handle,title}` / `deliveryOptionMove{handle,index}` |

Scopes unchanged (`write_payment_customizations` / `write_delivery_customizations`).
Input `run.graphql` field names were already correct.

> Confidence: medium-high (doc-sourced). The version-exact backstop is
> `npm run verify -- <slug>`, which runs `shopify app function run` against the
> fixture — confirm the target/ops there once an app is linked, or re-introspect
> with the `shopify-dev` MCP after a session restart.

## How this was verified

- `npm test` (41 tests) — logic + per-preset gating + fixture replay, all green
  after the discount rewrite.
- `npm run verify -- <slug>` — runs typegen/build/`function run` against the
  fixture once an app is linked (authoritative output-shape check via Shopify's
  own toolchain).
