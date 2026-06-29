#!/usr/bin/env node
/**
 * End-to-end verify harness for one app.
 *
 *   node scripts/verify-app.mjs <slug>
 *
 * Runs the local Shopify Function pipeline against the app's committed fixture:
 *   1. function typegen  — generate RunInput/FunctionRunResult types
 *   2. function build    — compile the Function to WASM (Javy)
 *   3. function run      — execute the WASM against fixtures/run.input.json
 *
 * Steps 1–3 need the Shopify CLI (pulled via npx) and, for build, the Function
 * toolchain. This script orchestrates them and fails loudly if a step errors —
 * so once you've run `shopify app config link`, a single command verifies the
 * Function end-to-end. (Pure-logic verification without any of this: `npm test`.)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!slug) fail("Usage: node scripts/verify-app.mjs <slug>");

const appDir = join(ROOT, "apps", slug);
if (!existsSync(appDir)) fail(`apps/${slug} not found. Generate it first: npm run new -- ${slug} "Name" <kind>`);

const extRoot = join(appDir, "extensions");
const features = existsSync(extRoot) ? readdirSync(extRoot) : [];
if (features.length === 0) fail(`apps/${slug} has no extensions/`);
const feature = features[0];
const extDir = join(extRoot, feature);
const fixture = join(extDir, "fixtures", "run.input.json");
if (!existsSync(fixture)) fail(`No fixture at ${fixture}`);

function step(title, cmd, args, cwd) {
  console.log(`\n→ ${title}\n  $ ${cmd} ${args.join(" ")}  (in ${cwd.replace(ROOT, ".")})`);
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (res.error) fail(`${title} could not start: ${res.error.message}`);
  if (res.status !== 0) fail(`${title} exited with code ${res.status}`);
}

console.log(`Verifying apps/${slug} (extension: ${feature})`);
console.log("Note: typegen/build/run require the Shopify CLI + Function toolchain (via npx).");

step("Generate Function types", "npx", ["shopify", "app", "function", "typegen"], appDir);
step("Build Function (WASM)", "npx", ["shopify", "app", "function", "build"], appDir);
step("Run Function against fixture", "npx", ["shopify", "app", "function", "run", "--path", join("extensions", feature), "--input", join("extensions", feature, "fixtures", "run.input.json")], appDir);

console.log(`\n✓ ${slug}: Function built and executed against its fixture.\n`);
