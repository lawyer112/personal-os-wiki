import { describe, expect, it } from "vitest";
import { captureToInboxInput } from "@/lib/capture";
import { captureCreateSchema } from "@/lib/validation";

describe("web capture", () => {
  it("normalizes a pasted link into a passive inbox item", () => {
    const input = captureCreateSchema.parse({
      content: "https://example.com/research",
    });

    const inbox = captureToInboxInput(input);

    expect(inbox).toMatchObject({
      sourceType: "link",
      sourcePlatform: "web",
      sourceUrl: "https://example.com/research",
      createdBy: "user",
    });
    expect(inbox.rawText).toBe("https://example.com/research");
    expect(inbox.attachments[0]).toMatchObject({
      kind: "web-capture",
      contentLength: 28,
      extractedUrl: "https://example.com/research",
      pendingEnrichment: true,
    });
  });

  it("keeps raw text when no link is present", () => {
    const input = captureCreateSchema.parse({
      content: "remember to review the saved research links later",
    });

    const inbox = captureToInboxInput(input);

    expect(inbox).toMatchObject({
      sourceType: "text",
      rawText: "remember to review the saved research links later",
      sourceUrl: undefined,
    });
  });

  it("rejects an empty capture before any inbox write", () => {
    const result = captureCreateSchema.safeParse({
      content: " ",
    });

    expect(result.success).toBe(false);
  });
});
