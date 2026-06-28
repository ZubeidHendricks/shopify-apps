# Buy X Get Y

Buy X, get Y at a discount on the same line. Starter does classic BOGO (1:1); Pro lets you configure buy/get quantities and the discount percentage.

Part of the [Shopify app factory](../../README.md). Built from the base template
+ the `bogo` preset, so OAuth, billing, GDPR webhooks, settings, and
analytics are all inherited from `@factory/core`.

| | |
| --- | --- |
| Kind | `bogo` |
| Function target | `cart.lines.discounts.generate.run` |
| Access scopes | `write_discounts` |

## Plans

| Plan | Price | What you get |
| --- | --- | --- |
| Starter | $4.99/mo | Single rule |
| Pro | $9.99/mo | Unlimited rules + advanced options |

Both include a 7-day free trial. Prices are tunable per app via env
(`STARTER_PRICE`, `PRO_PRICE`, `TRIAL_DAYS`, `BILLING_CURRENCY`).

## Develop & ship

```bash
npm install                  # from repo root (links @factory/* workspaces)
npx shopify app config link  # create/link the app in your Partner account
npx shopify app dev          # tunnel + install on a dev store (runs function typegen)
npx shopify app deploy       # push the Function + config when ready
```

After `typegen`, swap the hand-written input/output shapes in
`extensions/*/src/run.ts` for the generated `RunInput` / `FunctionRunResult`.

Then in the Partner Dashboard: set the pricing screen, fill the listing
(screenshots + value prop), and submit for review.

## What to edit

- `app/routes/app._index.tsx` — the merchant config screen.
- `extensions/*/src/run.ts` — the Function logic (runs as WASM on Shopify infra).

Everything else is shared and shouldn't need changes.
