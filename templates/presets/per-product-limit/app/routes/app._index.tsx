/**
 * Per-product limit config. Writes a SHOP metafield (validation Function).
 * Per-variant overrides are gated behind Pro.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, BlockStack, TextField, Button, Banner, Badge, Text } from "@shopify/polaris";
import { activeTier, readShopConfig, writeShopConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Config { plan: "free" | "starter" | "pro"; defaultMax: number; perVariant: Record<string, number>; }

function parsePerVariant(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const [id, max] = line.split(/[:=]/).map((s) => s.trim());
    if (id && max && Number(max) > 0) out[id] = Number(max);
  }
  return out;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  const raw = await readShopConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, defaultMax: 0, perVariant: {} };
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
    defaultMax: Number(form.get("defaultMax") || 0),
    perVariant: parsePerVariant(String(form.get("perVariant") || "")),
  });
  await track("config_saved", { app: process.env.FACTORY_APP || "app", shop: session.shop, plan: tier });
  return json({ ok: true });
};

export default function Index() {
  const { tier, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [defaultMax, setMax] = useState(String(config.defaultMax));
  const [perVariant, setPV] = useState(
    Object.entries(config.perVariant).map(([id, max]) => `${id}:${max}`).join("\n"),
  );
  const isPro = tier === "pro";

  const post = (intent: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    submit(fd, { method: "post" });
  };

  return (
    <Page title="Per-Product Limits">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock per-variant limits">
                <p>The {PLAN_STARTER} plan sets one limit for every line. Upgrade to {PLAN_PRO} to set limits per variant.</p>
                <Button onClick={() => post("upgrade")}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <TextField label="Global max units per line (0 = off)" type="number" value={defaultMax} onChange={setMax} autoComplete="off" />
            <TextField
              label="Per-variant overrides (Pro)"
              value={perVariant}
              onChange={setPV}
              autoComplete="off"
              multiline={4}
              disabled={!isPro}
              helpText={isPro ? "One per line: gid://shopify/ProductVariant/123:2" : "Pro feature"}
            />
            <Button variant="primary" onClick={() => post("save", { defaultMax, perVariant })}>Save</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
