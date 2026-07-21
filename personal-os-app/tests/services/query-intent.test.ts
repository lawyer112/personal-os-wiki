import { describe, expect, it } from "vitest";

import {
  detectQueryIntent,
  ftsScoreBoost,
  intentRankBoost,
} from "@/lib/query-intent";

describe("query-intent", () => {
  it("detects deploy and review-protocol intents", () => {
    expect(detectQueryIntent("如何部署 Personal Wiki")).toBe("deploy_sop");
    expect(detectQueryIntent("docker compose 启动")).toBe("deploy_sop");
    expect(detectQueryIntent("任务复核 review")).toBe("review_protocol");
    expect(detectQueryIntent("Agent 任务认领")).toBe("review_protocol");
    expect(detectQueryIntent("长期记忆")).toBe("concept");
    expect(detectQueryIntent("WIKI_READ_TOKEN")).toBe("ops");
    expect(detectQueryIntent("今天天气怎么样")).toBe("noise");
    expect(detectQueryIntent("MCP")).toBe("fact");
  });

  it("boosts deploy docs and penalizes positioning notes", () => {
    const deployDoc = intentRankBoost("deploy_sop", {
      title: "Personal Wiki 部署手册",
      path: "vault/30_projects/personal-wiki/deploy.md",
      tags: ["type-runbook", "topic-deploy"],
      excerpt: "使用 docker compose 启动 Wiki 与 OS",
    });
    const positioning = intentRankBoost("deploy_sop", {
      title: "Hermes Agent",
      path: "vault/20_notes/2026-05-05/hermes-agent.md",
      excerpt: "定位 个人助理 / agent 调度层，连接 Personal OS、Personal Wiki 和外部输入。",
    });
    expect(deployDoc).toBeGreaterThan(20);
    expect(positioning).toBeLessThan(0);
    expect(deployDoc).toBeGreaterThan(positioning);
  });

  it("boosts OS review protocol and penalizes unrelated PR review docs", () => {
    const protocol = intentRankBoost("review_protocol", {
      title: "Agent 任务复核协议",
      path: "vault/20_notes/personal-os/task-review.md",
      tags: ["type-protocol", "topic-task-review"],
      excerpt: "claim heartbeat submit review definitionOfDone",
    });
    const prDoc = intentRankBoost("review_protocol", {
      title: "软件工程国家标准写法",
      path: "vault/20_notes/gb-t-8567.md",
      excerpt: "Kubernetes/React PR Review 通过标准",
    });
    expect(protocol).toBeGreaterThan(20);
    expect(prDoc).toBeLessThan(0);
  });

  it("maps FTS scores into bounded boosts", () => {
    expect(ftsScoreBoost(undefined)).toBe(0);
    expect(ftsScoreBoost(5)).toBeGreaterThan(0);
    expect(ftsScoreBoost(100)).toBeLessThanOrEqual(45);
  });
});