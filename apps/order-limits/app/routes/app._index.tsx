/**
 * Order min/max config screen. Writes a SHOP metafield (validation functions
 * read shop metafields, not discount nodes). Max-items cap gated behind Pro.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, BlockStack, TextField, Button, Banner, Badge, Text } from "@shopify/polaris";
import { activeTier, readShopConfig, writeShopConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Config { plan: "free" | "starter" | "pro"; minSubtotal: number; maxItems: number; }

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  const raw = await readShopConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, minSubtotal: 0, maxItems: 0 };
  config.plan = tier;
  return json({ tier, config, shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const form = await request.formData();
  if (form.get("intent") === "upgrade") {
    await track("checkout_started", { app: process.env.FACTORY_APP || "app", shop: session.shop });
    return billing.request({ plan: PLAN_PRO, isTest: process.env.NODE_ENV !== "production" });
  }
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  await writeShopConfig(admin.graphql, {
    plan: tier,
    minSubtotal: Number(form.get("minSubtotal") || 0),
    maxItems: Number(form.get("maxItems") || 0),
  });
  await track("config_saved", { app: process.env.FACTORY_APP || "app", shop: session.shop, plan: tier });
  return json({ ok: true });
};

export default function Index() {
  const { tier, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [minSubtotal, setMin] = useState(String(config.minSubtotal));
  const [maxItems, setMax] = useState(String(config.maxItems));
  const isPro = tier === "pro";

  const post = (intent: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    submit(fd, { method: "post" });
  };

  return (
    <Page title="Order Limits">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock the maximum-items rule">
                <p>The {PLAN_STARTER} plan enforces a minimum order value. Upgrade to {PLAN_PRO} to also cap item count.</p>
                <Button onClick={() => post("upgrade")}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <TextField label="Minimum order value (0 = off)" type="number" value={minSubtotal} onChange={setMin} autoComplete="off" />
            <TextField label="Maximum items per order (0 = off)" type="number" value={maxItems} onChange={setMax} autoComplete="off" disabled={!isPro} helpText={isPro ? undefined : "Pro feature"} />
            <Button variant="primary" onClick={() => post("save", { minSubtotal, maxItems })}>Save</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
