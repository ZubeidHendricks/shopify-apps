import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planAllows,
  parseConfig,
  toAmount,
  money,
  clampPercent,
  resolveTier,
  PLAN_RANK,
} from "@factory/function-kit";

test("planAllows respects tier ranking", () => {
  assert.equal(planAllows("pro", "starter"), true);
  assert.equal(planAllows("pro", "pro"), true);
  assert.equal(planAllows("starter", "pro"), false);
  assert.equal(planAllows("free", "starter"), false);
  assert.ok(PLAN_RANK.pro > PLAN_RANK.starter);
});

test("parseConfig merges over fallback and never throws", () => {
  const fallback = { plan: "free", percentage: 0 };
  assert.deepEqual(parseConfig(null, fallback), fallback);
  assert.deepEqual(parseConfig("not json", fallback), fallback);
  assert.deepEqual(parseConfig('{"percentage":25}', fallback), { plan: "free", percentage: 25 });
});

test("toAmount parses decimal strings, guards garbage", () => {
  assert.equal(toAmount("19.99"), 19.99);
  assert.equal(toAmount(5), 5);
  assert.equal(toAmount("abc"), 0);
  assert.equal(toAmount(null), 0);
  assert.equal(toAmount(undefined), 0);
});

test("money formats to 2dp with rounding", () => {
  assert.equal(money(19.999), "20.00");
  assert.equal(money(10), "10.00");
  assert.equal(money(0.1 + 0.2), "0.30");
});

test("clampPercent bounds 0..100", () => {
  assert.equal(clampPercent(150), 100);
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent(42), 42);
  assert.equal(clampPercent(NaN), 0);
});

test("resolveTier picks the highest threshold met", () => {
  const tiers = [
    { threshold: 3, percentage: 10 },
    { threshold: 5, percentage: 20 },
    { threshold: 10, percentage: 30 },
  ];
  assert.equal(resolveTier(tiers, 2), null);
  assert.equal(resolveTier(tiers, 3)?.percentage, 10);
  assert.equal(resolveTier(tiers, 7)?.percentage, 20);
  assert.equal(resolveTier(tiers, 100)?.percentage, 30);
  assert.equal(resolveTier([], 5), null);
});
