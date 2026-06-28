#!/usr/bin/env node
/**
 * App generator. Copies the base template + a feature preset into apps/<slug>,
 * substitutes name/scope placeholders, and prints the Shopify CLI steps.
 *
 *   npm run new -- <slug> "Display Name" [kind]
 *   e.g. npm run new -- spend-save "Spend & Save" discount-spend
 *
 * kind defaults to "discount-qty". Available kinds = subdirs of templates/presets.
 * Each preset supplies its Function extension + admin route + required scopes,
 * so every generated app is a genuinely distinct product (not a reskin).
 */
import { cp, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TEMPLATE = join(ROOT, "templates", "function-app");
const PRESETS = join(ROOT, "templates", "presets");

const [, , slug, ...rest] = process.argv;

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function listKinds() {
  const entries = await readdir(PRESETS, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

// Last arg is the kind if it matches a preset; otherwise everything after slug is the name.
const kinds = await listKinds();
let kind = "discount-qty";
let nameParts = rest;
if (rest.length && kinds.includes(rest[rest.length - 1])) {
  kind = rest[rest.length - 1];
  nameParts = rest.slice(0, -1);
}
const name = nameParts.join(" ").trim();

if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  fail('Provide a kebab-case slug: npm run new -- <slug> "Display Name" [kind]');
}
if (!name) fail('Provide a display name: npm run new -- <slug> "Display Name" [kind]');
if (!kinds.includes(kind)) fail(`Unknown kind "${kind}". Available: ${kinds.join(", ")}`);

const dest = join(ROOT, "apps", slug);
if (existsSync(dest)) fail(`apps/${slug} already exists`);

const preset = JSON.parse(await readFile(join(PRESETS, kind, "preset.json"), "utf8"));
const scopes = preset.scopes ?? "";

async function substituteInFile(path) {
  const original = await readFile(path, "utf8");
  const replaced = original
    .replaceAll("__APP_SLUG__", slug)
    .replaceAll("__APP_NAME__", name)
    .replaceAll("__APP_SCOPES__", scopes);
  if (replaced !== original) await writeFile(path, replaced);
}

async function walk(dir) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) await walk(full);
    else if (!full.endsWith("preset.json")) await substituteInFile(full);
  }
}

// 1. base template
await cp(TEMPLATE, dest, { recursive: true });
// 2. overlay the chosen preset (extensions/ + app/routes/app._index.tsx)
await cp(join(PRESETS, kind, "extensions"), join(dest, "extensions"), { recursive: true });
await cp(join(PRESETS, kind, "app"), join(dest, "app"), { recursive: true });
// 3. .env so `shopify app dev` has a target (gitignored)
await cp(join(dest, ".env.example"), join(dest, ".env"));
// 4. substitute placeholders everywhere
await walk(dest);

console.log(`
✓ Created apps/${slug}  ("${name}")  kind=${kind}
  ${preset.blurb || ""}
  scopes: ${scopes || "(none)"}

Next steps (from apps/${slug}):
  1. npm install                         # repo root: links @factory/* workspaces
  2. npx shopify app config link         # create/link the app in your Partner account
  3. npx shopify app dev                 # tunnel + install on a dev store (runs typegen)
  4. npx shopify app deploy              # push function + config when ready

Then in the Partner Dashboard: set pricing, fill the listing, submit for review.
`);
