/**
 * Country-block validation Function.
 *
 * Starter: blocklist mode — checkout is blocked if any shipping address is in a
 * listed country. Pro: allowlist mode — checkout is blocked unless every
 * address is in the allowed list.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, type PlanTier } from "@factory/function-kit";

interface RunInput {
  cart: {
    deliveryGroups: { deliveryAddress: { countryCode: string | null } | null }[];
  };
  shop: { metafield: { value: string } | null };
}

interface ValidationError {
  message: string;
  target: string;
}

interface FunctionRunResult {
  operations: { validationAdd: { errors: ValidationError[] } }[];
}

interface CountryConfig {
  plan: PlanTier;
  /** Countries to block (Starter blocklist mode). */
  blockedCountries: string[];
  /** Countries allowed (Pro allowlist mode — everything else is blocked). */
  allowedCountries: string[];
  /** Pro: when true, use allowlist mode instead of blocklist. */
  allowlistMode: boolean;
}

const DEFAULT_CONFIG: CountryConfig = {
  plan: "free",
  blockedCountries: [],
  allowedCountries: [],
  allowlistMode: false,
};
const OK: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<CountryConfig>(input.shop.metafield?.value, DEFAULT_CONFIG);
  const usingAllowlist = planAllows(config.plan, "pro") && config.allowlistMode;

  const countries = input.cart.deliveryGroups
    .map((g) => g.deliveryAddress?.countryCode)
    .filter((c): c is string => Boolean(c));
  if (countries.length === 0) return OK; // no address yet, nothing to validate

  let blocked = false;
  if (usingAllowlist) {
    blocked = countries.some((c) => !config.allowedCountries.includes(c));
  } else {
    blocked = countries.some((c) => config.blockedCountries.includes(c));
  }
  if (!blocked) return OK;

  return {
    operations: [
      {
        validationAdd: {
          errors: [{ message: "We don't ship to your country.", target: "$.cart" }],
        },
      },
    ],
  };
}
