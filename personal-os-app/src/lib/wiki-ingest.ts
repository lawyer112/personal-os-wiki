import { wikiOpenUrl } from "@/lib/app-config";
import { wikiClient } from "@/lib/wiki-client";
import type { WikiIngestInput } from "@/lib/validation";

export type WikiIngestResult = {
  ok: boolean;
  title: string;
  status?: string;
  note_path?: string;
  url?: string;
  error?: string;
};

type WikiIngestResponse = {
  status?: string;
  note_path?: string;
  url?: string;
  error?: string;
  message?: string;
};

export async function ingestWikiNote(
  input: WikiIngestInput,
): Promise<WikiIngestResult> {
  try {
    const result = await wikiClient.write<WikiIngestResponse>("/api/ingest", {
      body: input,
    });
    const body = result.body ?? {};

    if (!result.ok) {
      return {
        ok: false,
        title: input.title,
        error: body.error ?? body.message ?? `Personal Wiki returned ${result.status}`,
      };
    }

    return {
      ok: true,
      title: input.title,
      status: body.status,
      note_path: body.note_path,
      url: body.url ? wikiOpenUrl(body.url) : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      title: input.title,
      error: error instanceof Error ? error.message : "Personal Wiki ingest failed",
    };
  }
}
