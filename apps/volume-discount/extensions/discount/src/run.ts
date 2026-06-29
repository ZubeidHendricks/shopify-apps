/**
 * Volume discount Function (example portfolio app).
 *
 * Reads a tiered config from the discount node's metafield (written by the
 * admin app) and applies the best matching percentage off the whole cart once
 * the total item quantity crosses a threshold. Pro-only tiers are ignored when
 * the merchant isn't on Pro.
 *
 * NOTE: When you scaffold a real app, run `shopify app generate extension` and
 * `shopify app function typegen` — that produces ./generated/api with the exact
 * input/output types for your chosen discount class. This file uses hand-written
 * shapes so the template typechecks before codegen runs; swap them for the
 * generated `RunInput` / `FunctionRunResult` afterward.
 */

import {
  parseConfig,
  resolveTier,
  clampPercent,
  planAllows,
  type PlanTier,
  type Tier,
} from "@factory/function-kit";

// --- Hand-written input shape (replace with generated RunInput after typegen) ---
interface RunInput {
  cart: {
    lines: { quantity: number }[];
  };
  discountNode: {
    metafield: { value: string } | null;
  };
}

interface OrderDiscountCandidate {
  message: string;
  value: { percentage: { value: string } };
  targets: { orderSubtotal: { excludedCartLineIds: string[] } }[];
}

interface FunctionRunResult {
  operations: { orderDiscountsAdd: { selectionStrategy: "FIRST" | "MAXIMUM"; candidates: OrderDiscountCandidate[] } }[];
}

interface VolumeConfig {
  plan: PlanTier;
  tiers: Tier[];
}

const DEFAULT_CONFIG: VolumeConfig = { plan: "free", tiers: [] };

const EMPTY: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<VolumeConfig>(
    input.discountNode.metafield?.value,
    DEFAULT_CONFIG,
  );

  // Gate Pro-tier configs: if the merchant configured >1 tier but isn't on Pro,
  // only honor the first tier (Starter gets a single threshold).
  const allowMultiTier = planAllows(config.plan, "pro");
  const tiers = allowMultiTier ? config.tiers : config.tiers.slice(0, 1);
  if (tiers.length === 0) return EMPTY;

  const totalQty = input.cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const tier = resolveTier(tiers, totalQty);
  if (!tier) return EMPTY;

  const pct = clampPercent(tier.percentage);
  if (pct <= 0) return EMPTY;

  return {
    operations: [
      {
        orderDiscountsAdd: {
          selectionStrategy: "FIRST",
          candidates: [
            {
              message: `${pct}% off ${tier.threshold}+ items`,
              value: { percentage: { value: pct.toString() } },
              targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
            },
          ],
        },
      },
    ],
  };
}
