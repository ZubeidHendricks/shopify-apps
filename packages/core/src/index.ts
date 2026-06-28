/**
 * @factory/core — shared admin-side core for the Shopify app portfolio.
 *
 * Re-exports the building blocks each generated app composes:
 *   - createFactoryApp : the app factory (OAuth + billing + webhooks)
 *   - billing          : shared plans + tier resolution
 *   - webhooks         : mandatory GDPR/compliance handling
 *   - settings         : metafield-backed config the Function reads
 *   - analytics        : portfolio-wide funnel tracking
 */

export { createFactoryApp } from "./shopify.server.js";
export type { FactoryAppOptions } from "./shopify.server.js";

export {
  buildBilling,
  billingFromEnv,
  activeTier,
  PLAN_FREE,
  PLAN_STARTER,
  PLAN_PRO,
} from "./billing.js";
export type { PlanName, PortfolioBillingOptions } from "./billing.js";

export { complianceWebhooks, dispatchWebhook } from "./webhooks.js";
export type { ComplianceHandlers } from "./webhooks.js";

export {
  readConfig,
  writeConfig,
  readShopConfig,
  writeShopConfig,
  APP_NAMESPACE,
  SHOP_NAMESPACE,
  CONFIG_KEY,
} from "./settings.js";

export { track } from "./analytics.js";
export type { FunnelEvent, AnalyticsContext } from "./analytics.js";
