/**
 * Merchant config screen. Reads the active billing tier, reads/writes the JSON
 * config the Function consumes, and gates multi-tier discounts behind Pro.
 *
 * This is the per-app "feature surface" — for a different app you mostly change
 * this file and extensions/. Everything else is inherited from @factory/core.
 */
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  TextField,
  Button,
  Banner,
  Badge,
  Text,
} from "@shopify/polaris";
import { activeTier, readConfig, writeConfig, track, PLAN_STARTER, PLAN_PRO } from "@factory/core";
import { authenticate } from "../shopify.server";

interface Tier {
  threshold: number;
  percentage: number;
}
interface Config {
  plan: "free" | "starter" | "pro";
  tiers: Tier[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check();
  const tier = activeTier(appSubscriptions.map((s) => s.name));

  const raw = await readConfig(admin.graphql);
  const config: Config = raw ? JSON.parse(raw) : { plan: tier, tiers: [{ threshold: 3, percentage: 10 }] };
  config.plan = tier; // plan is authoritative from billing, not stored config

  return json({ tier, config, shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "upgrade") {
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

  const save = () => {
    const fd = new FormData();
    fd.set("intent", "save");
    fd.set("tiers", JSON.stringify(tiers));
    submit(fd, { method: "post" });
  };

  const upgrade = () => {
    const fd = new FormData();
    fd.set("intent", "upgrade");
    submit(fd, { method: "post" });
  };

  return (
    <Page title="Volume Discounts">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Plan: <Badge tone={isPro ? "success" : "info"}>{tier}</Badge>
            </Text>
            {!isPro && (
              <Banner tone="info" title="Unlock multiple discount tiers">
                <p>The {PLAN_STARTER} plan applies one threshold. Upgrade to {PLAN_PRO} for unlimited tiers.</p>
                <Button onClick={upgrade}>Upgrade to Pro</Button>
              </Banner>
            )}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            {tiers.map((t, i) => (
              <BlockStack key={i} gap="100">
                <TextField
                  label={`Tier ${i + 1}: minimum quantity`}
                  type="number"
                  value={String(t.threshold)}
                  onChange={(v) => {
                    const next = [...tiers];
                    next[i] = { ...next[i], threshold: Number(v) };
                    setTiers(next);
                  }}
                  autoComplete="off"
                />
                <TextField
                  label="% off"
                  type="number"
                  value={String(t.percentage)}
                  onChange={(v) => {
                    const next = [...tiers];
                    next[i] = { ...next[i], percentage: Number(v) };
                    setTiers(next);
                  }}
                  autoComplete="off"
                />
              </BlockStack>
            ))}
            {isPro && (
              <Button onClick={() => setTiers([...tiers, { threshold: 5, percentage: 15 }])}>
                Add tier
              </Button>
            )}
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
