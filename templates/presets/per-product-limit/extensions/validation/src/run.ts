/**
 * Per-product quantity-limit validation Function.
 *
 * Blocks checkout when a line's quantity exceeds the allowed maximum. Starter
 * applies one global per-line limit; Pro adds per-variant overrides keyed by
 * variant GID.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, type PlanTier } from "@factory/function-kit";

interface CartLine {
  quantity: number;
  merchandise: { __typename: string; id?: string; title?: string };
}

interface RunInput {
  cart: { lines: CartLine[] };
  shop: { metafield: { value: string } | null };
}

interface ValidationError {
  message: string;
  target: string;
}

interface FunctionRunResult {
  operations: { validationAdd: { errors: ValidationError[] } }[];
}

interface LimitConfig {
  plan: PlanTier;
  /** Global max units per line item (0 = no global limit). */
  defaultMax: number;
  /** Pro: per-variant overrides, keyed by ProductVariant GID. */
  perVariant: Record<string, number>;
}

const DEFAULT_CONFIG: LimitConfig = { plan: "free", defaultMax: 0, perVariant: {} };
const OK: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<LimitConfig>(input.shop.metafield?.value, DEFAULT_CONFIG);
  const allowPerVariant = planAllows(config.plan, "pro");
  const errors: ValidationError[] = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;
    const id = line.merchandise.id;
    const override = allowPerVariant && id ? config.perVariant[id] : undefined;
    const limit = override ?? config.defaultMax;
    if (limit > 0 && line.quantity > limit) {
      const label = line.merchandise.title || "this product";
      errors.push({
        message: `You can buy at most ${limit} of ${label} per order.`,
        target: "$.cart",
      });
    }
  }

  if (errors.length === 0) return OK;
  return { operations: [{ validationAdd: { errors } }] };
}
