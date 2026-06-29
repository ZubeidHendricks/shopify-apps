/**
 * Bundle (distinct-items) discount Function.
 *
 * Applies a percentage off the order once the cart contains at least `minItems`
 * DIFFERENT products (distinct cart lines). Starter is locked to 2 distinct
 * items; Pro lets the merchant raise the threshold.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, clampPercent, type PlanTier } from "@factory/function-kit";

interface RunInput {
  cart: { lines: { id: string }[] };
  discountNode: { metafield: { value: string } | null };
}

interface Discount {
  message: string;
  value: { percentage: { value: string } };
  targets: { orderSubtotal: { excludedVariantIds: string[] } }[];
}

interface FunctionRunResult {
  discountApplicationStrategy: "FIRST" | "MAXIMUM" | "ALL";
  discounts: Discount[];
}

interface BundleConfig {
  plan: PlanTier;
  minItems: number;
  percentage: number;
}

const DEFAULT_CONFIG: BundleConfig = { plan: "free", minItems: 2, percentage: 10 };
const EMPTY: FunctionRunResult = { discountApplicationStrategy: "FIRST", discounts: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<BundleConfig>(input.discountNode.metafield?.value, DEFAULT_CONFIG);

  // Starter is locked to 2 distinct items; Pro can raise the threshold.
  const isPro = planAllows(config.plan, "pro");
  const minItems = isPro ? Math.max(2, Math.floor(config.minItems)) : 2;
  const pct = clampPercent(config.percentage);
  if (pct <= 0) return EMPTY;

  const distinctItems = input.cart.lines.length;
  if (distinctItems < minItems) return EMPTY;

  return {
    discountApplicationStrategy: "FIRST",
    discounts: [
      {
        message: `${pct}% off when you buy ${minItems}+ different products`,
        value: { percentage: { value: pct.toString() } },
        targets: [{ orderSubtotal: { excludedVariantIds: [] } }],
      },
    ],
  };
}
