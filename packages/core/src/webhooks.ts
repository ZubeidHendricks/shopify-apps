/**
 * Mandatory + lifecycle webhook handling shared by every app.
 *
 * Shopify REQUIRES the three GDPR/compliance webhooks for App Store approval:
 *   - customers/data_request : merchant's customer asks for their data
 *   - customers/redact       : delete a specific customer's data
 *   - shop/redact            : delete all data 48h after uninstall
 * Plus app/uninstalled and app/scopes_update for hygiene.
 *
 * Most portfolio apps store little-to-no customer PII (config lives in shop
 * metafields), so the default handlers just log + acknowledge. Override per app
 * by passing your own functions to registerComplianceWebhooks().
 */

import type { DeliveryMethod } from "@shopify/shopify-api";

export interface ComplianceHandlers {
  onCustomerDataRequest?: (payload: unknown, shop: string) => Promise<void> | void;
  onCustomerRedact?: (payload: unknown, shop: string) => Promise<void> | void;
  onShopRedact?: (payload: unknown, shop: string) => Promise<void> | void;
  onAppUninstalled?: (shop: string) => Promise<void> | void;
}

/**
 * Returns the `webhooks` map for the Shopify app factory. The HTTP delivery
 * method points all topics at a single Remix route (/webhooks) that dispatches
 * by topic — see templates/function-app/app/routes/webhooks.tsx.
 */
export function complianceWebhooks(deliveryMethod: DeliveryMethod.Http) {
  const callbackUrl = "/webhooks";
  return {
    CUSTOMERS_DATA_REQUEST: { deliveryMethod, callbackUrl },
    CUSTOMERS_REDACT: { deliveryMethod, callbackUrl },
    SHOP_REDACT: { deliveryMethod, callbackUrl },
    APP_UNINSTALLED: { deliveryMethod, callbackUrl },
    APP_SCOPES_UPDATE: { deliveryMethod, callbackUrl },
  };
}

/**
 * Dispatch a verified webhook (already authenticated by the Remix loader) to
 * the right handler. For apps that hold no PII, the defaults are compliant:
 * acknowledge with 200 and nothing to delete.
 */
export async function dispatchWebhook(
  topic: string,
  shop: string,
  payload: unknown,
  handlers: ComplianceHandlers = {},
): Promise<void> {
  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      await handlers.onCustomerDataRequest?.(payload, shop);
      return;
    case "CUSTOMERS_REDACT":
      await handlers.onCustomerRedact?.(payload, shop);
      return;
    case "SHOP_REDACT":
      // Default: remove any shop-scoped rows you persisted. No-op if stateless.
      await handlers.onShopRedact?.(payload, shop);
      return;
    case "APP_UNINSTALLED":
      await handlers.onAppUninstalled?.(shop);
      return;
    default:
      // APP_SCOPES_UPDATE and anything else: acknowledge.
      return;
  }
}
