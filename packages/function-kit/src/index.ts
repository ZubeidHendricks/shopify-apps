/**
 * @factory/function-kit
 *
 * Pure-TypeScript helpers shared by every Shopify Function extension in the
 * portfolio. This code is compiled to WASM (via Javy) and runs inside Shopify's
 * sandbox: NO Node APIs, NO fetch, NO async I/O. Keep it deterministic and small.
 *
 * The two cross-cutting concerns every Function app shares:
 *   1. Reading merchant configuration from a metafield (set by the admin app).
 *   2. Gating behavior by the merchant's billing plan (entitlements).
 *
 * Everything below is framework-agnostic so it works for discount, cart-
 * validation, delivery, and payment-customization functions alike.
 */

// ---------------------------------------------------------------------------
// Plans / entitlements
// ---------------------------------------------------------------------------

/** The plan tiers shared across the whole portfolio. Keep in sync with core/billing. */
export type PlanTier = "free" | "starter" | "pro";

export const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

/** True when `current` is at least as high a tier as `required`. */
export function planAllows(current: PlanTier, required: PlanTier): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

// ---------------------------------------------------------------------------
// Config parsing (metafield JSON) — never throw inside a Function
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON metafield value into a typed config object, falling back
 * to `fallback` on any error. Functions must never crash the cart, so this
 * swallows parse errors by design.
 */
export function parseConfig<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Money math — Shopify amounts are decimal strings; do math carefully
// ---------------------------------------------------------------------------

/** Parse a Shopify decimal-string amount ("19.99") to a number; 0 on failure. */
export function toAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Format a number as a 2-decimal money string Shopify accepts. */
export function money(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

/** Clamp a percentage into the valid 0–100 range. */
export function clampPercent(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

// ---------------------------------------------------------------------------
// Tiered thresholds — the backbone of volume/quantity/spend discounts
// ---------------------------------------------------------------------------

export interface Tier {
  /** Minimum quantity or spend at which this tier applies. */
  threshold: number;
  /** Percentage off (0–100) once the threshold is met. */
  percentage: number;
}

/**
 * Given an ordered (or unordered) list of tiers and a measured value (quantity
 * or subtotal), return the best-matching tier, or null if none apply.
 */
export function resolveTier(tiers: Tier[], value: number): Tier | null {
  let best: Tier | null = null;
  for (const tier of tiers) {
    if (value >= tier.threshold) {
      if (!best || tier.threshold > best.threshold) best = tier;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Telemetry stub — Functions can't call out, so we surface intent via the
// result's metadata where the platform supports it. No-op by default.
// ---------------------------------------------------------------------------

/** Standard result envelope helpers can return when a function chooses to no-op. */
export const NO_OP = Object.freeze({ discounts: [], operations: [] });
