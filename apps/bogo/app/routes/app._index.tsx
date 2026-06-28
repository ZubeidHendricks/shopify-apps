/**
 * BOGO config screen. Writes the discount-node metafield (discount Function).
 * Starter is locked to 1:1 free BOGO; Pro unlocks buy/get quantities + percent.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, BlockStack, TextField, Button, Banner, Badge, Text } from "@shopify/polaris";
import { activeTier, readConfig, writeConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Config { plan: "free" | "starter" | "pro"; buyQty: number; getQty: number; percentage: number; }

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  const raw = await readConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, buyQty: 1, getQty: 1, percentage: 100 };
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
  await writeConfig(admin.graphql, {
    plan: tier,
    buyQty: Number(form.get("buyQty") || 1),
    getQty: Number(form.get("getQty") || 1),
    percentage: Number(form.get("percentage") || 100),
  });
  await track("config_saved", { app: process.env.FACTORY_APP || "app", shop: session.shop, plan: tier });
  return json({ ok: true });
};

export default function Index() {
  const { tier, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [buyQty, setBuy] = useState(String(config.buyQty));
  const [getQty, setGet] = useState(String(config.getQty));
  const [percentage, setPct] = useState(String(config.percentage));
  const isPro = tier === "pro";

  const post = (intent: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    submit(fd, { method: "post" });
  };

  return (
    <Page title="Buy X Get Y">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock custom quantities & percentage">
                <p>The {PLAN_STARTER} plan runs classic buy-1-get-1-free. Upgrade to {PLAN_PRO} to set buy/get quantities and the discount percentage.</p>
                <Button onClick={() => post("upgrade")}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <TextField label="Buy quantity" type="number" value={buyQty} onChange={setBuy} autoComplete="off" disabled={!isPro} />
            <TextField label="Get quantity" type="number" value={getQty} onChange={setGet} autoComplete="off" disabled={!isPro} />
            <TextField label="% off the 'get' items" type="number" value={percentage} onChange={setPct} autoComplete="off" disabled={!isPro} helpText={isPro ? "100 = free" : "Starter = buy 1 get 1 free"} />
            <Button variant="primary" onClick={() => post("save", { buyQty, getQty, percentage })}>Save</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
