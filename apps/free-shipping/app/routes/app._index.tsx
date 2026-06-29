/**
 * Free-shipping config. Writes the discount-node metafield. A second threshold
 * is gated behind Pro.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, BlockStack, TextField, Button, Banner, Badge, Text } from "@shopify/polaris";
import { activeTier, readConfig, writeConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Tier { threshold: number; percentage: number; }
interface Config { plan: "free" | "starter" | "pro"; tiers: Tier[]; }

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  const raw = await readConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, tiers: [{ threshold: 75, percentage: 100 }] };
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
  const tiers = JSON.parse(String(form.get("tiers") || "[]")) as Tier[];
  await writeConfig(admin.graphql, { plan: tier, tiers });
  await track("config_saved", { app: process.env.FACTORY_APP || "app", shop: session.shop, plan: tier });
  return json({ ok: true });
};

export default function Index() {
  const { tier, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [tiers, setTiers] = useState<Tier[]>(config.tiers);
  const isPro = tier === "pro";

  const post = (intent: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    submit(fd, { method: "post" });
  };

  return (
    <Page title="Free Shipping">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock a second threshold">
                <p>The {PLAN_STARTER} plan uses one free-shipping threshold. Upgrade to {PLAN_PRO} to add a higher tier.</p>
                <Button onClick={() => post("upgrade")}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            {tiers.map((t, i) => (
              <BlockStack key={i} gap="100">
                <TextField label={`Free shipping when subtotal reaches`} type="number" value={String(t.threshold)}
                  onChange={(v) => { const n = [...tiers]; n[i] = { ...n[i], threshold: Number(v) }; setTiers(n); }} autoComplete="off" />
                <TextField label="% off shipping (100 = free)" type="number" value={String(t.percentage)}
                  onChange={(v) => { const n = [...tiers]; n[i] = { ...n[i], percentage: Number(v) }; setTiers(n); }} autoComplete="off" />
              </BlockStack>
            ))}
            {isPro && <Button onClick={() => setTiers([...tiers, { threshold: 150, percentage: 100 }])}>Add threshold</Button>}
            <Button variant="primary" onClick={() => post("save", { tiers: JSON.stringify(tiers) })}>Save</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
