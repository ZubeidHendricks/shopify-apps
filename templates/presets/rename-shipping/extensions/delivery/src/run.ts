/**
 * Delivery rename/reorder Function: rename a delivery option whose title matches
 * `matchTitle` to `newName`, and (Pro) move it to the top of the list.
 *
 * After scaffolding run `shopify app function typegen` and swap the hand-written
 * shapes for the generated RunInput / FunctionRunResult.
 */

import { parseConfig, planAllows, type PlanTier } from "@factory/function-kit";

interface DeliveryOption {
  handle: string;
  title: string;
}

interface RunInput {
  cart: {
    deliveryGroups: { deliveryOptions: DeliveryOption[] }[];
  };
  shop: { metafield: { value: string } | null };
}

type Operation =
  | { rename: { deliveryOptionHandle: string; title: string } }
  | { move: { deliveryOptionHandle: string; index: number } };

interface FunctionRunResult {
  operations: Operation[];
}

interface RenameConfig {
  plan: PlanTier;
  /** Exact current title to match, e.g. "Standard". */
  matchTitle: string;
  /** New title to display. */
  newName: string;
  /** Pro: move the matched option to the top of the list. */
  moveToTop: boolean;
}

const DEFAULT_CONFIG: RenameConfig = { plan: "free", matchTitle: "", newName: "", moveToTop: false };
const NONE: FunctionRunResult = { operations: [] };

export function run(input: RunInput): FunctionRunResult {
  const config = parseConfig<RenameConfig>(input.shop.metafield?.value, DEFAULT_CONFIG);
  if (!config.matchTitle || !config.newName) return NONE;

  const canMove = planAllows(config.plan, "pro") && config.moveToTop;
  const operations: Operation[] = [];

  for (const group of input.cart.deliveryGroups) {
    for (const option of group.deliveryOptions) {
      if (option.title !== config.matchTitle) continue;
      operations.push({ rename: { deliveryOptionHandle: option.handle, title: config.newName } });
      if (canMove) {
        operations.push({ move: { deliveryOptionHandle: option.handle, index: 0 } });
      }
    }
  }

  if (operations.length === 0) return NONE;
  return { operations };
}
