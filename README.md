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
| `cart-min-max` | `cart.validations.generate.run` | — | min order value / max item count |
| `payment-hide` | `purchase.payment-customization.run` | write_payment_customizations | hide a payment method by total/country |

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

## Status

- `@factory/function-kit` — typechecks clean (`npm run typecheck -w @factory/function-kit`).
- `@factory/core` — typechecks once an app installs the `@shopify/shopify-app-remix` peer dep.
- All four preset `run.ts` Functions typecheck clean against function-kit.
- First review batch generated (4 apps, 3 distinct Function targets):
  - `apps/volume-discount` — quantity-threshold discount
  - `apps/spend-save` — subtotal-threshold discount
  - `apps/order-limits` — cart validation (min value / max items)
  - `apps/hide-payment` — payment-method hiding by total/country

Each still needs `shopify app config link` → `dev` → `deploy` against your
Partner account (interactive auth), then a listing + submission.
