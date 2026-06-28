/**
 * First-order discount config. Writes the discount-node metafield. Including
 * guest checkouts is gated behind Pro.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, BlockStack, TextField, Button, Banner, Badge, Text, Checkbox } from "@shopify/polaris";
import { activeTier, readConfig, writeConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Config { plan: "free" | "starter" | "pro"; percentage: number; includeGuests: boolean; }

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  const raw = await readConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, percentage: 10, includeGuests: false };
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
    percentage: Number(form.get("percentage") || 0),
    includeGuests: form.get("includeGuests") === "true",
  });
  await track("config_saved", { app: process.env.FACTORY_APP || "app", shop: session.shop, plan: tier });
  return json({ ok: true });
};

export default function Index() {
  const { tier, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [percentage, setPct] = useState(String(config.percentage));
  const [includeGuests, setGuests] = useState(config.includeGuests);
  const isPro = tier === "pro";

  const post = (intent: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    submit(fd, { method: "post" });
  };

  return (
    <Page title="First-Order Discount">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock guest checkouts">
                <p>The {PLAN_STARTER} plan rewards logged-in new customers. Upgrade to {PLAN_PRO} to also discount guest first orders.</p>
                <Button onClick={() => post("upgrade")}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <TextField label="% off the first order" type="number" value={percentage} onChange={setPct} autoComplete="off" />
            <Checkbox label="Include guest checkouts (Pro)" checked={includeGuests} onChange={setGuests} disabled={!isPro} />
            <Button variant="primary" onClick={() => post("save", { percentage, includeGuests: String(includeGuests) })}>Save</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
