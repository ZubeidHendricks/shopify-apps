/**
 * Free-shipping (delivery discount) Function.
 *
 * Applies 100% off shipping for every delivery group once the cart subtotal
 * crosses a configured threshold. Starter honors one threshold; Pro can set a
 * second, higher threshold (the function picks the best one met).
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, resolveTier, toAmount, type PlanTier, type Tier } from "@factory/function-kit";

interface RunInput {
  cart: {
    cost: { subtotalAmount: { amount: string } };
    deliveryGroups: { id: string }[];
  };
  discountNode: { metafield: { value: string } | null };
}

interface DeliveryDiscountCandidate {
  message: string;
  targets: { deliveryGroup: { id: string } }[];
  value: { percentage: { value: string } };
}

interface FunctionRunResult {
  operations: {
    deliveryDiscountsAdd: { selectionStrategy: "ALL"; candidates: DeliveryDiscountCandidate[] };
  }[];
}

interface FreeShipConfig {
  plan: PlanTier;
  /** thresholds (subtotal) that grant free shipping; percentage is the % off shipping (100 = free). */
  tiers: Tier[];
}

const DEFAULT_CONFIG: FreeShipConfig = { plan: "free", tiers: [] };
const NONE: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<FreeShipConfig>(input.discountNode.metafield?.value, DEFAULT_CONFIG);

  // Starter honors a single threshold; Pro can layer a second.
  const tiers = planAllows(config.plan, "pro") ? config.tiers : config.tiers.slice(0, 1);
  if (tiers.length === 0) return NONE;

  const subtotal = toAmount(input.cart.cost.subtotalAmount.amount);
  const tier = resolveTier(tiers, subtotal);
  if (!tier || tier.percentage <= 0) return NONE;

  const candidates: DeliveryDiscountCandidate[] = input.cart.deliveryGroups.map((group) => ({
    message: `Free shipping over ${tier.threshold}`,
    targets: [{ deliveryGroup: { id: group.id } }],
    value: { percentage: { value: Math.min(100, tier.percentage).toString() } },
  }));
  if (candidates.length === 0) return NONE;

  return { operations: [{ deliveryDiscountsAdd: { selectionStrategy: "ALL", candidates } }] };
}
