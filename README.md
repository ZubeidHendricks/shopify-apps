# Shopify App Factory

A monorepo for shipping a **portfolio of small, monetizable Shopify apps** on a
shared core — the same "factory" model as AppFactoryKit (iOS) and wp-plugins,
adapted to Shopify Functions / checkout apps.

Why Shopify is a good fit for the 100-app play:

- **Billing is built in.** Shopify's managed Billing API does recurring charges,
  trials, and the merchant approval screen. No Stripe, no chargebacks.
- **Distribution is built in.** The App Store gives organic installs.
- **Small is normal.** Volume discounts, cart rules, free-shipping bars — single-
  feature utilities at $5–15/mo are a proven category.
- **Functions run on Shopify's infra**, so most apps need little/no backend.

## Layout

```
packages/
  function-kit/   Pure-TS helpers that run INSIDE Shopify Functions (WASM, no Node).
                  Plans/entitlements, config parsing, money math, tier resolution.
  core/           Node-side Remix admin core shared by every app:
                  app factory (OAuth+billing+webhooks), GDPR webhooks,
                  metafield-backed settings, funnel analytics.
templates/
  function-app/   A complete, runnable Shopify Remix + Function app that imports
                  the core. The generator stamps copies of this.
scripts/
  new-app.mjs     Generator: npm run new -- <slug> "Display Name"
apps/
  <slug>/         Each generated app. Mostly app/routes/app._index.tsx +
                  extensions/ differ; everything else is inherited.
```

## What's shared vs. per-app

| Concern | Where | Reuse |
| --- | --- | --- |
| OAuth, embedded auth | `@factory/core` createFactoryApp | 100% |
| Billing plans (Starter/Pro, trial) | `@factory/core/billing` | 100% (price via env) |
| GDPR/compliance webhooks | `@factory/core/webhooks` | 100% |
| Settings storage (shop metafield) | `@factory/core/settings` | 100% |
| Funnel analytics | `@factory/core/analytics` | 100% |
| Plan gating inside the Function | `@factory/function-kit` | 100% |
| The actual feature | app `app._index.tsx` + `extensions/` | per-app |

## Create a new app

Each app is generated from the base template + a **feature preset**. Presets are
what make apps genuinely distinct (different Function target, scopes, admin UI) —
not reskins. Available kinds = subdirs of `templates/presets/`:

| kind | Function target | scopes | what it does |
| --- | --- | --- | --- |
| `discount-qty` *(default)* | `cart.lines.discounts.generate.run` | write_discounts | % off at quantity thresholds |
| `discount-spend` | `cart.lines.discounts.generate.run` | write_discounts | % off at subtotal thresholds |
| `bogo` | `cart.lines.discounts.generate.run` | write_discounts | buy X get Y at a discount (per line) |
| `first-order` | `cart.lines.discounts.generate.run` | write_discounts | % off for first-time customers |
| `bundle` | `cart.lines.discounts.generate.run` | write_discounts | % off when cart has N+ different products |
| `free-shipping` | `cart.delivery-options.discounts.generate.run` | write_discounts | free shipping over a subtotal threshold |
| `cart-min-max` | `cart.validations.generate.run` | — | min order value / max item count |
| `per-product-limit` | `cart.validations.generate.run` | — | cap units per product/variant |
| `country-block` | `cart.validations.generate.run` | — | block/allow checkout by country |
| `payment-hide` | `purchase.payment-customization.run` | write_payment_customizations | hide a payment method by total/country |
| `delivery-hide` | `purchase.delivery-customization.run` | write_delivery_customizations | hide a delivery option by total/country |
| `rename-shipping` | `purchase.delivery-customization.run` | write_delivery_customizations | rename a delivery option (Pro: move to top) |

```bash
npm install                                          # links workspaces
npm run new -- spend-save "Spend & Save" discount-spend
cd apps/spend-save
npx shopify app config link                          # create/link app in Partner Dashboard
npx shopify app dev                                  # tunnel + install on a dev store (runs typegen)
# build the feature: edit app/routes/app._index.tsx + extensions/
npx shopify app deploy                               # push function + config
```

To add a new kind: create `templates/presets/<kind>/` with `preset.json`
(`{ scopes, feature, blurb }`), an `extensions/<feature>/` Function, and
`app/routes/app._index.tsx`. The generator overlays it onto the base.

Then in the Partner Dashboard: set the pricing screen, fill the listing
(screenshots, description), and submit for review.

## The bottleneck is review, not code

Each app is human-reviewed. To keep throughput high and avoid "spam cluster"
flags:

- Each app must be **genuinely distinct and useful** — not 100 reskins.
- All three mandatory GDPR webhooks must respond 200 (handled by the core).
- The billing flow must work in test mode before submission.
- Listings need real screenshots + a clear value prop.

Realistic cadence: batch 3–5 apps through `dev`/`deploy`, submit together,
iterate on reviewer feedback. See `IDEAS.md` for the backlog.

## Testing

The Function logic (discount math, plan gating, validation rules) is pure and
deterministic, so it's unit-tested directly — no Shopify auth needed:

```bash
npm test          # 41 tests, Node built-in runner, native TS type-stripping
```

- `test/function-kit.test.ts` — shared helpers (tier resolution, money, gating).
- `test/functions.test.ts` — every preset's `run()`, incl. Starter-vs-Pro gating
  and threshold edges.
- `test/fixtures.test.ts` — replays each preset's `fixtures/run.input.json`
  (the exact shape Shopify feeds the WASM) through `run()` and asserts a real
  effect.

### Schema validation (Shopify Dev MCP)

The hand-written GraphQL — each `extensions/*/src/run.graphql` input query and the
Admin GraphQL in `@factory/core/settings.ts` — is validated against the real
Shopify schemas using the [Shopify Dev MCP server](https://shopify.dev) (`@shopify/dev-mcp`),
configured in `.mcp.json`. Its `introspect_*_schema` and
`validate_graphql_codeblocks` tools catch wrong field/connection names before
`shopify app dev`. MCP validates the **input queries + admin mutations**;
`npm run verify` (typegen → build) validates the **output shapes**.

### End-to-end verify (once an app is linked)

Each app ships a fixture that doubles as input for Shopify's local function
runner. After `shopify app config link`:

```bash
npm run verify -- <slug>   # typegen → build (WASM) → function run against the fixture
```

This runs the real Function toolchain (via npx). What still needs a dev store:
live checkout behavior, billing approval, and webhook delivery (`shopify app dev`).

## Status

- `@factory/function-kit` — typechecks clean; unit-tested.
- `@factory/core` — typechecks once an app installs the `@shopify/shopify-app-remix` peer dep.
- All 12 preset `run.ts` Functions typecheck clean and pass `npm test` (41 tests).
- 12 apps generated across 5 distinct Function targets, each with its own README + fixture:
  - `apps/volume-discount` · `apps/spend-save` · `apps/bogo` · `apps/first-order-discount` · `apps/bundle-discount` — discounts
  - `apps/free-shipping` — delivery discount
  - `apps/order-limits` · `apps/product-limits` · `apps/country-block` — cart validation
  - `apps/hide-payment` — payment customization
  - `apps/hide-delivery` · `apps/rename-shipping` — delivery customization

Each still needs `shopify app config link` → `dev` → `deploy` against your
Partner account (interactive auth), then a listing + submission.
