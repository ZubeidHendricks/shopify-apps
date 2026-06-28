/**
 * Lightweight funnel analytics shared across the portfolio.
 *
 * Mirrors the AppFactoryKit funnel approach: every app emits the same handful
 * of lifecycle events so you can compare install→activate→paid conversion
 * across all 100 apps in one dashboard. Transport is pluggable — default is a
 * console line; point FACTORY_ANALYTICS_URL at a collector (PostHog, your own
 * endpoint) to ship events.
 */

export type FunnelEvent =
  | "app_installed"
  | "onboarding_started"
  | "config_saved" // = activation: merchant actually set the feature up
  | "plan_viewed"
  | "checkout_started" // merchant clicked upgrade
  | "plan_activated" // paid conversion
  | "app_uninstalled";

export interface AnalyticsContext {
  /** App slug, e.g. "volume-discount". Set per app via FACTORY_APP env. */
  app: string;
  shop: string;
  plan?: "free" | "starter" | "pro";
}

export async function track(
  event: FunnelEvent,
  ctx: AnalyticsContext,
  props: Record<string, unknown> = {},
): Promise<void> {
  const payload = { event, ...ctx, props, ts: new Date().toISOString() };
  const url = process.env.FACTORY_ANALYTICS_URL;
  if (!url) {
    // Dev / no-collector mode: structured log line, greppable per app.
    console.log(`[funnel] ${JSON.stringify(payload)}`);
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Never let analytics break a request.
    console.error("[funnel] send failed", err);
  }
}
