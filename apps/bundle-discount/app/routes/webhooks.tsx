/**
 * Single webhook endpoint that all topics post to. The Shopify factory verifies
 * the HMAC; we just dispatch to the shared compliance handlers.
 */
import type { ActionFunctionArgs } from "@remix-run/node";
import { dispatchWebhook } from "@factory/core";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  await dispatchWebhook(topic, shop, payload, {
    // This app stores config only in shop metafields (deleted with the shop),
    // so the compliance defaults are sufficient. Add handlers here if you ever
    // persist customer PII.
  });

  return new Response(null, { status: 200 });
};
