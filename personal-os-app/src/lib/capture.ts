import type { CaptureCreateInput, InboxCreateInput } from "@/lib/validation";

export function captureToInboxInput(input: CaptureCreateInput): InboxCreateInput {
  const parts = [
    input.title ? `Title: ${input.title}` : null,
    input.url ? `URL: ${input.url}` : null,
    input.selection ? `Selection:\n${input.selection}` : null,
    input.note ? `Note:\n${input.note}` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    sourceType: input.url ? "link" : "text",
    sourcePlatform: input.sourcePlatform,
    rawText: parts.join("\n\n"),
    sourceUrl: input.url,
    attachments: [captureMetadata(input)],
    createdBy: input.createdBy,
  };
}

function captureMetadata(input: CaptureCreateInput) {
  const metadata: Record<string, unknown> = {
    kind: "web-capture",
  };

  if (input.title) {
    metadata.title = input.title;
  }
  if (input.selection) {
    metadata.selectionLength = input.selection.length;
  }
  if (input.note) {
    metadata.noteLength = input.note.length;
  }

  return metadata;
}
