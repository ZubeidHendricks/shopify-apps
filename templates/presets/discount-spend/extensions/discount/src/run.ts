/**
 * Spend-more-save-more discount Function.
 *
 * Applies the best matching percentage off the cart subtotal once spend crosses
 * a configured threshold. Multi-tier is Pro-only (Starter gets one threshold).
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes below for the generated RunInput / FunctionRunResult.
 */

import {
  parseConfig,
  resolveTier,
  clampPercent,
  planAllows,
  toAmount,
  type PlanTier,
  type Tier,
} from "@factory/function-kit";

interface RunInput {
  cart: {
    cost: { subtotalAmount: { amount: string } };
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

interface SpendConfig {
  plan: PlanTier;
  /** thresholds expressed in store currency (subtotal), with % off. */
  tiers: Tier[];
}

const DEFAULT_CONFIG: SpendConfig = { plan: "free", tiers: [] };
const EMPTY: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<SpendConfig>(input.discountNode.metafield?.value, DEFAULT_CONFIG);

  const allowMultiTier = planAllows(config.plan, "pro");
  const tiers = allowMultiTier ? config.tiers : config.tiers.slice(0, 1);
  if (tiers.length === 0) return EMPTY;

  const subtotal = toAmount(input.cart.cost.subtotalAmount.amount);
  const tier = resolveTier(tiers, subtotal);
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
              message: `${pct}% off orders over ${tier.threshold}`,
              value: { percentage: { value: pct.toString() } },
              targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
            },
          ],
        },
      },
    ],
  };
}
