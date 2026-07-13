import { describe, it, expect } from "vitest";
import {
  applyTierBudget,
  applyContextBudget,
  getBudgetConfig,
  DEFAULT_CONTEXT_BUDGET,
} from "../src/lib/agent-context-budget";

describe("agent-context-budget", () => {
  describe("applyTierBudget", () => {
    it("keeps all items when under budget", () => {
      const items = [
        { id: 1, name: "small" },
        { id: 2, name: "tiny" },
      ];
      const result = applyTierBudget(items, 1000);
      
      expect(result.items).toHaveLength(2);
      expect(result.budget.used).toBeLessThanOrEqual(1000);
      expect(result.budget.truncated).toBe(0);
    });

    it("truncates items when over budget", () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        description: "x".repeat(500),
      }));
      const result = applyTierBudget(items, 500);
      
      expect(result.items.length).toBeLessThan(items.length);
      expect(result.budget.used).toBeLessThanOrEqual(500);
      expect(result.budget.truncated).toBeGreaterThan(0);
      expect(result.budget.truncated).toBe(items.length - result.items.length);
    });

    it("preserves order and keeps first items", () => {
      const items = [
        { id: "first", data: "a".repeat(100) },
        { id: "second", data: "b".repeat(100) },
        { id: "third", data: "c".repeat(100) },
      ];
      const result = applyTierBudget(items, 100);
      
      expect(result.items[0].id).toBe("first");
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.length).toBeLessThan(items.length);
    });
  });

  describe("applyContextBudget", () => {
    it("respects per-tier budgets when total is not exceeded", () => {
      const tiers = {
        hot: [{ id: 1, type: "hot" }],
        warm: [{ id: 2, type: "warm" }],
        cold: [{ id: 3, type: "cold" }],
      };
      const config = {
        hot: 500,
        warm: 500,
        cold: 500,
        total: 2000,
      };
      
      const result = applyContextBudget(tiers, config);
      
      expect(result.tiers.hot).toHaveLength(1);
      expect(result.tiers.warm).toHaveLength(1);
      expect(result.tiers.cold).toHaveLength(1);
      expect(result.budget.total.used).toBeLessThanOrEqual(config.total);
    });

    it("reduces cold first when total budget exceeded", () => {
      const makeLargeItem = (id: string) => ({
        id,
        data: "x".repeat(2000),
      });
      
      const tiers = {
        hot: [makeLargeItem("hot1")],
        warm: [makeLargeItem("warm1")],
        cold: Array.from({ length: 5 }, (_, i) => makeLargeItem(`cold${i}`)),
      };
      
      const config = {
        hot: 1000,
        warm: 1000,
        cold: 1000,
        total: 2000, // Forces reduction
      };
      
      const result = applyContextBudget(tiers, config);
      
      // Hot should be preserved
      expect(result.tiers.hot.length).toBeGreaterThan(0);
      // Cold should be reduced
      expect(result.tiers.cold.length).toBeLessThan(tiers.cold.length);
      expect(result.budget.wasLimited).toBe(true);
      expect(result.budget.total.used).toBeLessThanOrEqual(config.total);
    });

    it("reduces warm after cold exhausted", () => {
      const makeLargeItem = (id: string) => ({
        id,
        data: "x".repeat(2000),
      });
      
      const tiers = {
        hot: [makeLargeItem("hot1")],
        warm: Array.from({ length: 5 }, (_, i) => makeLargeItem(`warm${i}`)),
        cold: [], // Already empty
      };
      
      const config = {
        hot: 1000,
        warm: 1000,
        cold: 500,
        total: 1500, // Forces warm reduction
      };
      
      const result = applyContextBudget(tiers, config);
      
      expect(result.tiers.hot.length).toBeGreaterThan(0);
      expect(result.tiers.warm.length).toBeLessThan(tiers.warm.length);
      expect(result.budget.wasLimited).toBe(true);
    });

    it("preserves hot tier priority", () => {
      const makeLargeItem = (id: string) => ({
        id,
        data: "x".repeat(1000),
      });
      
      const tiers = {
        hot: Array.from({ length: 3 }, (_, i) => makeLargeItem(`hot${i}`)),
        warm: [],
        cold: [],
      };
      
      const config = {
        hot: 500,
        warm: 500,
        cold: 500,
        total: 1500,
      };
      
      const result = applyContextBudget(tiers, config);
      
      // Should keep at least some hot items even if they exceed budget
      expect(result.tiers.hot.length).toBeGreaterThan(0);
      expect(result.budget.total.used).toBeLessThanOrEqual(config.total);
    });

    it("reports accurate truncation counts", () => {
      const tiers = {
        hot: Array.from({ length: 10 }, (_, i) => ({ id: `hot${i}`, data: "x".repeat(200) })),
        warm: Array.from({ length: 10 }, (_, i) => ({ id: `warm${i}`, data: "x".repeat(200) })),
        cold: Array.from({ length: 10 }, (_, i) => ({ id: `cold${i}`, data: "x".repeat(200) })),
      };
      
      const config = {
        hot: 300,
        warm: 300,
        cold: 300,
        total: 900,
      };
      
      const result = applyContextBudget(tiers, config);
      
      const totalTruncated = 
        result.budget.hot.truncated +
        result.budget.warm.truncated +
        result.budget.cold.truncated;
      
      const totalKept = 
        result.tiers.hot.length +
        result.tiers.warm.length +
        result.tiers.cold.length;
      
      expect(totalKept + totalTruncated).toBe(30);
      expect(result.budget.total.truncated).toBe(totalTruncated);
    });
  });

  describe("getBudgetConfig", () => {
    it("returns defaults when env vars not set", () => {
      const config = getBudgetConfig();
      
      expect(config.hot).toBe(DEFAULT_CONTEXT_BUDGET.hot);
      expect(config.warm).toBe(DEFAULT_CONTEXT_BUDGET.warm);
      expect(config.cold).toBe(DEFAULT_CONTEXT_BUDGET.cold);
      expect(config.total).toBe(DEFAULT_CONTEXT_BUDGET.total);
    });

    it("uses valid env overrides", () => {
      const originalEnv = { ...process.env };
      process.env.AGENT_CONTEXT_BUDGET_HOT = "3000";
      process.env.AGENT_CONTEXT_BUDGET_WARM = "2000";
      process.env.AGENT_CONTEXT_BUDGET_COLD = "1500";
      process.env.AGENT_CONTEXT_BUDGET_TOTAL = "6500";
      
      const config = getBudgetConfig();
      
      expect(config.hot).toBe(3000);
      expect(config.warm).toBe(2000);
      expect(config.cold).toBe(1500);
      expect(config.total).toBe(6500);
      
      process.env = originalEnv;
    });

    it("ignores invalid env values", () => {
      const originalEnv = { ...process.env };
      process.env.AGENT_CONTEXT_BUDGET_HOT = "invalid";
      process.env.AGENT_CONTEXT_BUDGET_WARM = "-100";
      process.env.AGENT_CONTEXT_BUDGET_COLD = "0";
      
      const config = getBudgetConfig();
      
      expect(config.hot).toBe(DEFAULT_CONTEXT_BUDGET.hot);
      expect(config.warm).toBe(DEFAULT_CONTEXT_BUDGET.warm);
      expect(config.cold).toBe(DEFAULT_CONTEXT_BUDGET.cold);
      
      process.env = originalEnv;
    });
  });

  describe("edge cases", () => {
    it("handles empty tiers", () => {
      const tiers = { hot: [], warm: [], cold: [] };
      const result = applyContextBudget(tiers, DEFAULT_CONTEXT_BUDGET);
      
      expect(result.tiers.hot).toHaveLength(0);
      expect(result.tiers.warm).toHaveLength(0);
      expect(result.tiers.cold).toHaveLength(0);
      expect(result.budget.total.used).toBe(0);
      expect(result.budget.wasLimited).toBe(false);
    });

    it("handles single large item", () => {
      const tiers = {
        hot: [{ id: 1, data: "x".repeat(10000) }],
        warm: [],
        cold: [],
      };
      const result = applyContextBudget(tiers, {
        hot: 1000,
        warm: 1000,
        cold: 1000,
        total: 3000,
      });
      
      // Should keep at least partial hot tier even if over budget
      expect(result.budget.total.used).toBeLessThanOrEqual(3000);
    });

    it("ensures total never exceeds configured limit", () => {
      const makeLargeItem = (id: string) => ({
        id,
        data: "x".repeat(5000),
      });
      
      const tiers = {
        hot: Array.from({ length: 20 }, (_, i) => makeLargeItem(`hot${i}`)),
        warm: Array.from({ length: 20 }, (_, i) => makeLargeItem(`warm${i}`)),
        cold: Array.from({ length: 20 }, (_, i) => makeLargeItem(`cold${i}`)),
      };
      
      const config = {
        hot: 2000,
        warm: 1500,
        cold: 1000,
        total: 4500,
      };
      
      const result = applyContextBudget(tiers, config);
      
      expect(result.budget.total.used).toBeLessThanOrEqual(config.total);
      expect(result.budget.hot.used).toBeLessThanOrEqual(config.hot);
      expect(result.budget.warm.used).toBeLessThanOrEqual(config.warm);
      expect(result.budget.cold.used).toBeLessThanOrEqual(config.cold);
    });
  });
});
