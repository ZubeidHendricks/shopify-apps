/**
 * Payment customization Function: hide a named payment method when the cart
 * total is below a threshold, and (Pro) for a configured list of countries.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, toAmount, type PlanTier } from "@factory/function-kit";

interface PaymentMethod {
  id: string;
  name: string;
}

interface RunInput {
  paymentMethods: PaymentMethod[];
  cart: {
    cost: { totalAmount: { amount: string } };
    deliveryGroups: { deliveryAddress: { countryCode: string | null } | null }[];
  };
  shop: {
    metafield: { value: string } | null;
  };
}

// CartPaymentMethodsTransformRunResult (purchase.payment-methods transform API).
interface FunctionRunResult {
  operations: { paymentMethodHide: { paymentMethodId: string } }[];
}

interface PaymentConfig {
  plan: PlanTier;
  /** Exact payment method name to hide, e.g. "Cash on Delivery". */
  methodName: string;
  /** Hide the method when the cart total is below this amount (0 = ignore). */
  hideBelow: number;
  /** Pro: also hide the method for these ISO country codes, e.g. ["US","CA"]. */
  hideCountries: string[];
}

const DEFAULT_CONFIG: PaymentConfig = { plan: "free", methodName: "", hideBelow: 0, hideCountries: [] };
const NONE: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<PaymentConfig>(input.shop.metafield?.value, DEFAULT_CONFIG);
  if (!config.methodName) return NONE;

  const target = input.paymentMethods.find((m) => m.name === config.methodName);
  if (!target) return NONE;

  let hide = false;

  if (config.hideBelow > 0) {
    const total = toAmount(input.cart.cost.totalAmount.amount);
    if (total < config.hideBelow) hide = true;
  }

  if (!hide && planAllows(config.plan, "pro") && config.hideCountries.length > 0) {
    const countries = input.cart.deliveryGroups
      .map((g) => g.deliveryAddress?.countryCode)
      .filter((c): c is string => Boolean(c));
    if (countries.some((c) => config.hideCountries.includes(c))) hide = true;
  }

  if (!hide) return NONE;
  return { operations: [{ paymentMethodHide: { paymentMethodId: target.id } }] };
}
