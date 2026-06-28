/**
 * Cart checkout validation Function: enforce a minimum order value and/or a
 * maximum item count. Returns checkout-blocking errors. The max-items rule is
 * Pro-only.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, toAmount, type PlanTier } from "@factory/function-kit";

interface RunInput {
  cart: {
    cost: { subtotalAmount: { amount: string } };
    lines: { quantity: number }[];
  };
  shop: {
    metafield: { value: string } | null;
  };
}

interface ValidationError {
  message: string;
  target: string;
}

interface FunctionRunResult {
  operations: { validationAdd: { errors: ValidationError[] } }[];
}

interface MinMaxConfig {
  plan: PlanTier;
  /** Minimum order subtotal required to check out (0 = no minimum). */
  minSubtotal: number;
  /** Maximum total item count allowed (0 = no maximum). Pro only. */
  maxItems: number;
}

const DEFAULT_CONFIG: MinMaxConfig = { plan: "free", minSubtotal: 0, maxItems: 0 };
const OK: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<MinMaxConfig>(input.shop.metafield?.value, DEFAULT_CONFIG);
  const errors: ValidationError[] = [];

  if (config.minSubtotal > 0) {
    const subtotal = toAmount(input.cart.cost.subtotalAmount.amount);
    if (subtotal < config.minSubtotal) {
      errors.push({
        message: `Orders must be at least ${config.minSubtotal} to check out.`,
        target: "$.cart",
      });
    }
  }

  // Max-items cap is a Pro feature.
  if (planAllows(config.plan, "pro") && config.maxItems > 0) {
    const totalQty = input.cart.lines.reduce((sum, l) => sum + l.quantity, 0);
    if (totalQty > config.maxItems) {
      errors.push({
        message: `You can order at most ${config.maxItems} items per order.`,
        target: "$.cart",
      });
    }
  }

  if (errors.length === 0) return OK;
  return { operations: [{ validationAdd: { errors } }] };
}
