/**
 * First-order discount Function: percentage off for first-time customers.
 *
 * A logged-in customer with zero prior orders qualifies. Guests (no customer on
 * the cart) are ambiguous — Starter skips them; Pro can opt to include guests.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, clampPercent, type PlanTier } from "@factory/function-kit";

interface RunInput {
  cart: {
    buyerIdentity: {
      customer: { numberOfOrders: number } | null;
    } | null;
  };
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

interface FirstOrderConfig {
  plan: PlanTier;
  percentage: number;
  /** Pro: also apply to guest checkouts (no customer attached). */
  includeGuests: boolean;
}

const DEFAULT_CONFIG: FirstOrderConfig = { plan: "free", percentage: 10, includeGuests: false };
const EMPTY: FunctionRunResult = { discountApplicationStrategy: "FIRST", discounts: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<FirstOrderConfig>(input.discountNode.metafield?.value, DEFAULT_CONFIG);
  const pct = clampPercent(config.percentage);
  if (pct <= 0) return EMPTY;

  const customer = input.cart.buyerIdentity?.customer ?? null;
  const includeGuests = planAllows(config.plan, "pro") && config.includeGuests;

  let qualifies = false;
  if (customer) {
    qualifies = customer.numberOfOrders === 0;
  } else {
    qualifies = includeGuests;
  }
  if (!qualifies) return EMPTY;

  return {
    discountApplicationStrategy: "FIRST",
    discounts: [
      {
        message: `${pct}% off your first order`,
        value: { percentage: { value: pct.toString() } },
        targets: [{ orderSubtotal: { excludedVariantIds: [] } }],
      },
    ],
  };
}
