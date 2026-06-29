/**
 * Delivery rename/reorder config. Writes a SHOP metafield. Moving the option to
 * the top is gated behind Pro.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, BlockStack, TextField, Button, Banner, Badge, Text, Checkbox } from "@shopify/polaris";
import { activeTier, readShopConfig, writeShopConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Config { plan: "free" | "starter" | "pro"; matchTitle: string; newName: string; moveToTop: boolean; }

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  const raw = await readShopConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, matchTitle: "", newName: "", moveToTop: false };
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
    matchTitle: String(form.get("matchTitle") || ""),
    newName: String(form.get("newName") || ""),
    moveToTop: form.get("moveToTop") === "true",
  });
  await track("config_saved", { app: process.env.FACTORY_APP || "app", shop: session.shop, plan: tier });
  return json({ ok: true });
};

export default function Index() {
  const { tier, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [matchTitle, setMatch] = useState(config.matchTitle);
  const [newName, setNew] = useState(config.newName);
  const [moveToTop, setMove] = useState(config.moveToTop);
  const isPro = tier === "pro";

  const post = (intent: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    submit(fd, { method: "post" });
  };

  return (
    <Page title="Rename Shipping">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock reordering">
                <p>The {PLAN_STARTER} plan renames an option. Upgrade to {PLAN_PRO} to also move it to the top.</p>
                <Button onClick={() => post("upgrade")}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <TextField label="Match option title (exact)" value={matchTitle} onChange={setMatch} autoComplete="off" helpText='e.g. "Standard"' />
            <TextField label="New title" value={newName} onChange={setNew} autoComplete="off" helpText='e.g. "Free Shipping (3-5 days)"' />
            <Checkbox label="Move to top of list (Pro)" checked={moveToTop} onChange={setMove} disabled={!isPro} />
            <Button variant="primary" onClick={() => post("save", { matchTitle, newName, moveToTop: String(moveToTop) })}>Save</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
