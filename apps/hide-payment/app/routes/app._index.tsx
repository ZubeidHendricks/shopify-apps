/**
 * Payment-method hiding config. Writes a SHOP metafield. Country-based hiding
 * is gated behind Pro.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, BlockStack, TextField, Button, Banner, Badge, Text } from "@shopify/polaris";
import { activeTier, readShopConfig, writeShopConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Config { plan: "free" | "starter" | "pro"; methodName: string; hideBelow: number; hideCountries: string[]; }

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  const raw = await readShopConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, methodName: "", hideBelow: 0, hideCountries: [] };
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
  const hideCountries = String(form.get("hideCountries") || "")
    .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  await writeShopConfig(admin.graphql, {
    plan: tier,
    methodName: String(form.get("methodName") || ""),
    hideBelow: Number(form.get("hideBelow") || 0),
    hideCountries,
  });
  await track("config_saved", { app: process.env.FACTORY_APP || "app", shop: session.shop, plan: tier });
  return json({ ok: true });
};

export default function Index() {
  const { tier, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [methodName, setMethod] = useState(config.methodName);
  const [hideBelow, setBelow] = useState(String(config.hideBelow));
  const [hideCountries, setCountries] = useState(config.hideCountries.join(", "));
  const isPro = tier === "pro";

  const post = (intent: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    submit(fd, { method: "post" });
  };

  return (
    <Page title="Hide Payment Method">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock country-based rules">
                <p>The {PLAN_STARTER} plan hides by cart total. Upgrade to {PLAN_PRO} to also hide by country.</p>
                <Button onClick={() => post("upgrade")}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <TextField label="Payment method name (exact)" value={methodName} onChange={setMethod} autoComplete="off" helpText='e.g. "Cash on Delivery"' />
            <TextField label="Hide when cart total below (0 = off)" type="number" value={hideBelow} onChange={setBelow} autoComplete="off" />
            <TextField label="Hide for countries (ISO codes, comma-separated)" value={hideCountries} onChange={setCountries} autoComplete="off" disabled={!isPro} helpText={isPro ? "e.g. US, CA" : "Pro feature"} />
            <Button variant="primary" onClick={() => post("save", { methodName, hideBelow, hideCountries })}>Save</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
