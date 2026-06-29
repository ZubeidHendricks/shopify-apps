/**
 * Per-app Shopify server. Thanks to @factory/core this is the entire wiring —
 * billing, GDPR webhooks, OAuth, and embedded auth are all inherited.
 */
import { createFactoryApp } from "@factory/core";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = createFactoryApp({
  sessionStorage: new PrismaSessionStorage(prisma),
  // Scopes are kind-specific (e.g. write_discounts, write_payment_customizations).
  // The generator writes SCOPES into .env from the chosen preset.
  scopes: (process.env.SCOPES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
});

export default shopify;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const sessionStorage = shopify.sessionStorage;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
