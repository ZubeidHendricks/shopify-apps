/**
 * Metafield-backed settings shared by the admin app and the Function.
 *
 * The admin UI writes a JSON config blob into an app-owned metafield; the
 * Function reads the same metafield at runtime via @factory/function-kit's
 * parseConfig(). Using the app-reserved "$app" namespace means the value is
 * private to this app and travels with the shop — no external DB required for
 * simple apps.
 *
 * Pass `admin.graphql` (from authenticate.admin()) into these helpers.
 */

export const APP_NAMESPACE = "$app:settings";
export const CONFIG_KEY = "config";

type GraphQLClient = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

/** Read the JSON config string for the current shop (null if unset). */
export async function readConfig(graphql: GraphQLClient): Promise<string | null> {
  const res = await graphql(
    `#graphql
    query FactoryReadConfig($namespace: String!, $key: String!) {
      currentAppInstallation {
        metafield(namespace: $namespace, key: $key) { value }
      }
    }`,
    { variables: { namespace: APP_NAMESPACE, key: CONFIG_KEY } },
  );
  const body = (await res.json()) as {
    data?: { currentAppInstallation?: { metafield?: { value?: string } | null } };
  };
  return body.data?.currentAppInstallation?.metafield?.value ?? null;
}

/** Persist the JSON config string for the current shop. */
export async function writeConfig<T>(graphql: GraphQLClient, config: T): Promise<void> {
  // Owner is the app installation itself, so we first fetch its id.
  const idRes = await graphql(
    `#graphql
    query FactoryAppId { currentAppInstallation { id } }`,
  );
  const idBody = (await idRes.json()) as {
    data?: { currentAppInstallation?: { id: string } };
  };
  const ownerId = idBody.data?.currentAppInstallation?.id;
  if (!ownerId) throw new Error("Could not resolve app installation id");

  const res = await graphql(
    `#graphql
    mutation FactoryWriteConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: APP_NAMESPACE,
            key: CONFIG_KEY,
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    },
  );
  const body = (await res.json()) as {
    data?: { metafieldsSet?: { userErrors: { message: string }[] } };
  };
  const errors = body.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
}

// ---------------------------------------------------------------------------
// Shop-scoped config (for validation / payment / delivery functions, which have
// no discountNode and read settings from a SHOP metafield). Uses a plain
// namespace so the function's `shop { metafield }` query can read it.
// ---------------------------------------------------------------------------

export const SHOP_NAMESPACE = "factory";

/** Read the shop-scoped JSON config string (null if unset). */
export async function readShopConfig(graphql: GraphQLClient): Promise<string | null> {
  const res = await graphql(
    `#graphql
    query FactoryReadShopConfig($namespace: String!, $key: String!) {
      shop { metafield(namespace: $namespace, key: $key) { value } }
    }`,
    { variables: { namespace: SHOP_NAMESPACE, key: CONFIG_KEY } },
  );
  const body = (await res.json()) as {
    data?: { shop?: { metafield?: { value?: string } | null } };
  };
  return body.data?.shop?.metafield?.value ?? null;
}

/** Persist the shop-scoped JSON config string. */
export async function writeShopConfig<T>(graphql: GraphQLClient, config: T): Promise<void> {
  const idRes = await graphql(`#graphql
    query FactoryShopId { shop { id } }`);
  const idBody = (await idRes.json()) as { data?: { shop?: { id: string } } };
  const ownerId = idBody.data?.shop?.id;
  if (!ownerId) throw new Error("Could not resolve shop id");

  const res = await graphql(
    `#graphql
    mutation FactoryWriteShopConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: SHOP_NAMESPACE,
            key: CONFIG_KEY,
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    },
  );
  const body = (await res.json()) as {
    data?: { metafieldsSet?: { userErrors: { message: string }[] } };
  };
  const errors = body.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
}
