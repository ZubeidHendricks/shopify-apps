/**
 * Shared billing configuration for every app in the portfolio.
 *
 * Shopify's managed Billing API (via @shopify/shopify-app-remix) handles the
 * recurring charge, trials, and the merchant approval screen. We just declare
 * the plans here and pass them to the app factory. Each app can override the
 * price/trial via env without forking this file.
 *
 * Plan tiers mirror @factory/function-kit's PlanTier so the admin app and the
 * Function agree on what "pro" means.
 */

import type { BillingConfig } from "@shopify/shopify-app-remix/server";

export const PLAN_FREE = "Free" as const;
export const PLAN_STARTER = "Starter" as const;
export const PLAN_PRO = "Pro" as const;

export type PlanName = typeof PLAN_STARTER | typeof PLAN_PRO;

export interface PortfolioBillingOptions {
  /** Monthly price for the Starter plan in the store's currency. Default 4.99. */
  starterPrice?: number;
  /** Monthly price for the Pro plan. Default 9.99. */
  proPrice?: number;
  /** Free trial length in days applied to paid plans. Default 7. */
  trialDays?: number;
  /** ISO currency code. Default "USD". */
  currencyCode?: string;
}

/**
 * Build the BillingConfig the app factory expects. Reads sensible defaults but
 * lets each app tune price/trial through env (see appBilling()).
 */
export function buildBilling(opts: PortfolioBillingOptions = {}): BillingConfig {
  const {
    starterPrice = 4.99,
    proPrice = 9.99,
    trialDays = 7,
    currencyCode = "USD",
  } = opts;

  return {
    [PLAN_STARTER]: {
      lineItems: [
        {
          amount: starterPrice,
          currencyCode,
          interval: "EVERY_30_DAYS",
        },
      ],
      trialDays,
    },
    [PLAN_PRO]: {
      lineItems: [
        {
          amount: proPrice,
          currencyCode,
          interval: "EVERY_30_DAYS",
        },
      ],
      trialDays,
    },
  };
}

/** Read billing options from env so a generated app needs zero code edits to reprice. */
export function billingFromEnv(env: Record<string, string | undefined> = process.env): BillingConfig {
  return buildBilling({
    starterPrice: env.STARTER_PRICE ? Number(env.STARTER_PRICE) : undefined,
    proPrice: env.PRO_PRICE ? Number(env.PRO_PRICE) : undefined,
    trialDays: env.TRIAL_DAYS ? Number(env.TRIAL_DAYS) : undefined,
    currencyCode: env.BILLING_CURRENCY,
  });
}

/**
 * Resolve the active plan tier for a shop from the result of billing.check().
 * Returns the highest active paid plan, or "free".
 */
export function activeTier(activePlanNames: string[]): "free" | "starter" | "pro" {
  if (activePlanNames.includes(PLAN_PRO)) return "pro";
  if (activePlanNames.includes(PLAN_STARTER)) return "starter";
  return "free";
}
