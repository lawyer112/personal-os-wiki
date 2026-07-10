import { describe, expect, it } from "vitest";

import {
  buildIntakePayload,
  parseArgs,
} from "../../scripts/personal_os_intake.mjs";

describe("personal_os_intake helper", () => {
  it("normalizes the old string source into the current object contract", () => {
    const args = parseArgs([
      "--base-url",
      "http://os.local:3100/",
      "--project",
      "Personal OS",
    ]);
    const payload = buildIntakePayload(args, {
      source: "旧模板写回摘要",
      projectEvents: [{ title: "done", body: "verified" }],
    });

    expect(payload).toMatchObject({
      source: {
        sourceType: "agent-output",
        sourcePlatform: "codex",
        rawText: "旧模板写回摘要",
        attachments: [],
        createdBy: "codex",
      },
      agent: { model: "codex" },
      project: { name: "Personal OS" },
    });
    expect(args.baseUrl).toBe("http://os.local:3100");
  });

  it("preserves an already valid source object", () => {
    const args = parseArgs(["--base-url", "http://os.local:3100"]);
    const payload = buildIntakePayload(args, {
      source: {
        sourceType: "user-note",
        sourcePlatform: "voice",
        rawText: "用户口述内容",
      },
    });

    expect(payload.source).toMatchObject({
      sourceType: "user-note",
      sourcePlatform: "voice",
      rawText: "用户口述内容",
    });
  });
});
