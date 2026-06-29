/**
 * Country-block config. Writes a SHOP metafield. Allowlist mode is gated
 * behind Pro.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, BlockStack, TextField, Button, Banner, Badge, Text, Checkbox } from "@shopify/polaris";
import { activeTier, readShopConfig, writeShopConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Config { plan: "free" | "starter" | "pro"; blockedCountries: string[]; allowedCountries: string[]; allowlistMode: boolean; }

const toList = (s: string) => s.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));
  const raw = await readShopConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, blockedCountries: [], allowedCountries: [], allowlistMode: false };
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
    blockedCountries: toList(String(form.get("blockedCountries") || "")),
    allowedCountries: toList(String(form.get("allowedCountries") || "")),
    allowlistMode: form.get("allowlistMode") === "true",
  });
  await track("config_saved", { app: process.env.FACTORY_APP || "app", shop: session.shop, plan: tier });
  return json({ ok: true });
};

export default function Index() {
  const { tier, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [blocked, setBlocked] = useState(config.blockedCountries.join(", "));
  const [allowed, setAllowed] = useState(config.allowedCountries.join(", "));
  const [allowlistMode, setMode] = useState(config.allowlistMode);
  const isPro = tier === "pro";

  const post = (intent: string, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("intent", intent);
    Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    submit(fd, { method: "post" });
  };

  return (
    <Page title="Country Block">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock allowlist mode">
                <p>The {PLAN_STARTER} plan blocks listed countries. Upgrade to {PLAN_PRO} to allow only listed countries instead.</p>
                <Button onClick={() => post("upgrade")}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <Checkbox label="Allowlist mode — only allow listed countries (Pro)" checked={allowlistMode} onChange={setMode} disabled={!isPro} />
            {allowlistMode && isPro ? (
              <TextField label="Allowed countries (ISO codes)" value={allowed} onChange={setAllowed} autoComplete="off" helpText="e.g. US, CA, GB" />
            ) : (
              <TextField label="Blocked countries (ISO codes)" value={blocked} onChange={setBlocked} autoComplete="off" helpText="e.g. RU, KP" />
            )}
            <Button variant="primary" onClick={() => post("save", { blockedCountries: blocked, allowedCountries: allowed, allowlistMode: String(allowlistMode) })}>Save</Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
