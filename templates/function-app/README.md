# __APP_NAME__

__APP_BLURB__

Part of the [Shopify app factory](../../README.md). Built from the base template
+ the `__APP_KIND__` preset, so OAuth, billing, GDPR webhooks, settings, and
analytics are all inherited from `@factory/core`.

| | |
| --- | --- |
| Kind | `__APP_KIND__` |
| Function target | `__APP_TARGET__` |
| Access scopes | `__APP_SCOPES__` |

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
