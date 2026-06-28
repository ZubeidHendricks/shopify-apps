/**
 * Delivery customization Function: hide a named delivery option when the cart
 * subtotal is below a threshold, and (Pro) for a configured list of countries.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, toAmount, type PlanTier } from "@factory/function-kit";

interface DeliveryOption {
  handle: string;
  title: string;
}

interface DeliveryGroup {
  deliveryAddress: { countryCode: string | null } | null;
  deliveryOptions: DeliveryOption[];
}

interface RunInput {
  cart: {
    cost: { subtotalAmount: { amount: string } };
    deliveryGroups: DeliveryGroup[];
  };
  shop: {
    metafield: { value: string } | null;
  };
}

interface FunctionRunResult {
  operations: { hide: { deliveryOptionHandle: string } }[];
}

interface DeliveryConfig {
  plan: PlanTier;
  /** Exact delivery option title to hide, e.g. "Express". */
  optionTitle: string;
  /** Hide it when the cart subtotal is below this amount (0 = ignore). */
  hideBelow: number;
  /** Pro: also hide it for these ISO country codes. */
  hideCountries: string[];
}

const DEFAULT_CONFIG: DeliveryConfig = { plan: "free", optionTitle: "", hideBelow: 0, hideCountries: [] };
const NONE: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<DeliveryConfig>(input.shop.metafield?.value, DEFAULT_CONFIG);
  if (!config.optionTitle) return NONE;

  let hide = false;

  if (config.hideBelow > 0) {
    const subtotal = toAmount(input.cart.cost.subtotalAmount.amount);
    if (subtotal < config.hideBelow) hide = true;
  }

  if (!hide && planAllows(config.plan, "pro") && config.hideCountries.length > 0) {
    const countries = input.cart.deliveryGroups
      .map((g) => g.deliveryAddress?.countryCode)
      .filter((c): c is string => Boolean(c));
    if (countries.some((c) => config.hideCountries.includes(c))) hide = true;
  }

  if (!hide) return NONE;

  // Collect every matching option handle across delivery groups.
  const handles: string[] = [];
  for (const group of input.cart.deliveryGroups) {
    for (const option of group.deliveryOptions) {
      if (option.title === config.optionTitle) handles.push(option.handle);
    }
  }
  if (handles.length === 0) return NONE;

  return { operations: handles.map((deliveryOptionHandle) => ({ hide: { deliveryOptionHandle } })) };
}
