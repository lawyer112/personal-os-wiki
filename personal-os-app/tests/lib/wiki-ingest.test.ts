import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestWiki } from "@/lib/wiki-client";
import { buildWikiIngestPayload, ingestWikiNote } from "@/lib/wiki-ingest";

vi.mock("@/lib/wiki-client", () => ({
  ingestWiki: vi.fn().mockResolvedValue({
    status: "created",
    path: "30_projects/tokyo/summary.md",
    directory: "30_projects/tokyo",
    task_id: "task_1",
    url: "http://os.local/api/wiki/open?next=%2Fnote",
  }),
}));

const mockedIngestWiki = vi.mocked(ingestWiki);

const frontmatter = {
  title: "东京行完成总结",
  type: "project",
  created_by: "hermes:worker",
  task_id: "task_1",
  agent_id: "agent_1",
  project: "2026-05 东京行",
  source_type: "agent-output",
  tags: ["tokyo"],
};

describe("wiki ingest payload adapter", () => {
  beforeEach(() => {
    mockedIngestWiki.mockClear();
  });

  it("sends the new frontmatter payload to the wiki client", async () => {
    const result = await ingestWikiNote({
      frontmatter,
      content: "Ready for review.",
    });

    expect(mockedIngestWiki).toHaveBeenCalledWith({
      frontmatter,
      content: "Ready for review.",
    });
    expect(result).toMatchObject({
      ok: true,
      title: "东京行完成总结",
      path: "30_projects/tokyo/summary.md",
      note_path: "30_projects/tokyo/summary.md",
      task_id: "task_1",
    });
  });

  it("translates deprecated metadata input into frontmatter", () => {
    const payload = buildWikiIngestPayload({
      title: "旧入口",
      content: "Body",
      source_type: "agent-output",
      source_url: "https://example.com/source",
      tags: ["legacy"],
      metadata: {
        type: "project",
        created_by: "hermes:worker",
        task_id: "task_1",
        agent_id: "agent_1",
        project: "旧项目",
        canonical_url: "https://example.com/canonical",
        text_hash: "text-hash-1",
        source_domain: "example.com",
        personal_os_inbox_id: "inbox_1",
      },
    });

    expect(payload.frontmatter).toMatchObject({
      title: "旧入口",
      type: "project",
      created_by: "hermes:worker",
      source_type: "agent-output",
      source_url: "https://example.com/source",
      canonical_url: "https://example.com/canonical",
      text_hash: "text-hash-1",
      source_domain: "example.com",
      personal_os_inbox_id: "inbox_1",
      tags: ["legacy"],
      project: "旧项目",
    });
  });

  it.each([
    ["created_by", { created_by: undefined }],
    ["type", { type: undefined }],
    ["source_type", { source_type: undefined }],
    ["tags", { tags: undefined }],
  ])("throws before HTTP when %s is missing", (_field, override) => {
    const malformedInput = {
      frontmatter: { ...frontmatter, ...override },
      content: "Body",
    } as unknown as Parameters<typeof buildWikiIngestPayload>[0];

    expect(() => buildWikiIngestPayload(malformedInput)).toThrow(/required/);
    expect(mockedIngestWiki).not.toHaveBeenCalled();
  });

  it("returns a failed result instead of throwing on local payload errors", async () => {
    const result = await ingestWikiNote({
      title: "缺少元数据",
      content: "Body",
      source_type: "agent-output",
      tags: ["legacy"],
      metadata: {
        type: "project",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      title: "缺少元数据",
      error: "created_by is required",
    });
    expect(mockedIngestWiki).not.toHaveBeenCalled();
  });

  it("throws before HTTP when a hermes writer omits task_id", () => {
    expect(() =>
      buildWikiIngestPayload({
        frontmatter: { ...frontmatter, task_id: undefined },
        content: "Body",
      }),
    ).toThrow(/task_id/);
  });
});
