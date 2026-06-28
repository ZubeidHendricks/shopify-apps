/**
 * The app factory. Each app's app/shopify.server.ts is a 5-line file that calls
 * createFactoryApp() with its env — billing, GDPR webhooks, scopes, and session
 * storage are all wired here once and reused across the portfolio.
 */

import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  type ShopifyApp,
} from "@shopify/shopify-app-remix/server";
import { billingFromEnv } from "./billing.js";
import { complianceWebhooks } from "./webhooks.js";

export interface FactoryAppOptions {
  /** Session storage instance (e.g. PrismaSessionStorage or MemorySessionStorage). */
  sessionStorage: any;
  /** OAuth scopes this specific app needs, comma-separated. Default: none extra. */
  scopes?: string[];
  /** Override env source (mainly for tests). */
  env?: Record<string, string | undefined>;
}

/**
 * Build a fully-configured Shopify app instance. Reads SHOPIFY_API_KEY,
 * SHOPIFY_API_SECRET, SHOPIFY_APP_URL, and billing/* from env.
 */
export function createFactoryApp(opts: FactoryAppOptions): ShopifyApp<any> {
  const env = opts.env ?? process.env;

  return shopifyApp({
    apiKey: env.SHOPIFY_API_KEY,
    apiSecretKey: env.SHOPIFY_API_SECRET || "",
    apiVersion: ApiVersion.January25,
    scopes: opts.scopes,
    appUrl: env.SHOPIFY_APP_URL || "",
    authPathPrefix: "/auth",
    sessionStorage: opts.sessionStorage,
    distribution: AppDistribution.AppStore,
    billing: billingFromEnv(env),
    webhooks: complianceWebhooks(DeliveryMethod.Http),
    future: {
      unstable_newEmbeddedAuthStrategy: true,
    },
    ...(env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [env.SHOP_CUSTOM_DOMAIN] } : {}),
  });
}
