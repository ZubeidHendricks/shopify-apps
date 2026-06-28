/**
 * Buy-X-get-Y discount Function (per cart line).
 *
 * For each line, every (buyQty + getQty) units forms a group; getQty units in
 * each complete group get `percentage` off. Starter is locked to classic BOGO
 * (buy 1 get 1 free); Pro unlocks configurable quantities and percentage.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import {
  parseConfig,
  planAllows,
  clampPercent,
  toAmount,
  money,
  type PlanTier,
} from "@factory/function-kit";

interface CartLine {
  id: string;
  quantity: number;
  cost: { amountPerQuantity: { amount: string } };
}

interface RunInput {
  cart: { lines: CartLine[] };
  discountNode: { metafield: { value: string } | null };
}

interface Discount {
  message: string;
  value: { fixedAmount: { amount: string } };
  targets: { cartLine: { id: string } }[];
}

interface FunctionRunResult {
  discountApplicationStrategy: "FIRST" | "MAXIMUM" | "ALL";
  discounts: Discount[];
}

interface BogoConfig {
  plan: PlanTier;
  buyQty: number;
  getQty: number;
  percentage: number; // % off the "get" units (100 = free)
}

const DEFAULT_CONFIG: BogoConfig = { plan: "free", buyQty: 1, getQty: 1, percentage: 100 };
const EMPTY: FunctionRunResult = { discountApplicationStrategy: "MAXIMUM", discounts: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<BogoConfig>(input.discountNode.metafield?.value, DEFAULT_CONFIG);

  // Starter is locked to classic 1:1 free BOGO; Pro unlocks the knobs.
  const isPro = planAllows(config.plan, "pro");
  const buyQty = isPro ? Math.max(1, Math.floor(config.buyQty)) : 1;
  const getQty = isPro ? Math.max(1, Math.floor(config.getQty)) : 1;
  const percentage = isPro ? clampPercent(config.percentage) : 100;
  if (percentage <= 0) return EMPTY;

  const groupSize = buyQty + getQty;
  const discounts: Discount[] = [];

  for (const line of input.cart.lines) {
    const sets = Math.floor(line.quantity / groupSize);
    if (sets <= 0) continue;
    const discountedItems = sets * getQty;
    const unit = toAmount(line.cost.amountPerQuantity.amount);
    const amount = discountedItems * unit * (percentage / 100);
    if (amount <= 0) continue;
    discounts.push({
      message: `Buy ${buyQty} get ${getQty} at ${percentage}% off`,
      value: { fixedAmount: { amount: money(amount) } },
      targets: [{ cartLine: { id: line.id } }],
    });
  }

  if (discounts.length === 0) return EMPTY;
  return { discountApplicationStrategy: "MAXIMUM", discounts };
}
