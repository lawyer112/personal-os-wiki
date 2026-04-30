import type { CaptureCreateInput, InboxCreateInput } from "@/lib/validation";

export function captureToInboxInput(input: CaptureCreateInput): InboxCreateInput {
  const rawText = input.content ?? "";
  const sourceUrl = extractFirstUrl(rawText);

  return {
    sourceType: sourceUrl ? "link" : "text",
    sourcePlatform: input.sourcePlatform,
    rawText,
    sourceUrl,
    attachments: [captureMetadata(rawText, sourceUrl)],
    createdBy: input.createdBy,
  };
}

function captureMetadata(rawText: string, sourceUrl?: string) {
  return {
    kind: "web-capture",
    contentLength: rawText.length,
    extractedUrl: sourceUrl,
    pendingEnrichment: true,
  };
}

function extractFirstUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"')\]]+/i);
  if (!match) {
    return undefined;
  }

  try {
    return new URL(match[0]).toString();
  } catch {
    return undefined;
  }
}
