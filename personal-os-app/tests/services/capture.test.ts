import { describe, expect, it } from "vitest";
import { captureToInboxInput } from "@/lib/capture";
import { captureCreateSchema } from "@/lib/validation";

describe("web capture", () => {
  it("normalizes a captured page into a passive inbox item", () => {
    const input = captureCreateSchema.parse({
      url: "https://example.com/research",
      title: "Research memo",
      selection: "Important paragraph",
      note: "Review during the next agent intake pass.",
    });

    const inbox = captureToInboxInput(input);

    expect(inbox).toMatchObject({
      sourceType: "link",
      sourcePlatform: "web",
      sourceUrl: "https://example.com/research",
      createdBy: "user",
    });
    expect(inbox.rawText).toContain("Title: Research memo");
    expect(inbox.rawText).toContain("URL: https://example.com/research");
    expect(inbox.rawText).toContain("Selection:\nImportant paragraph");
    expect(inbox.rawText).toContain(
      "Note:\nReview during the next agent intake pass.",
    );
    expect(inbox.attachments[0]).toMatchObject({
      kind: "web-capture",
      title: "Research memo",
      selectionLength: 19,
    });
  });

  it("rejects an empty capture before any inbox write", () => {
    const result = captureCreateSchema.safeParse({
      url: " ",
      title: "",
      selection: "",
      note: "",
    });

    expect(result.success).toBe(false);
  });
});
