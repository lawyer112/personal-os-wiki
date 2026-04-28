import { wikiOpenUrl, wikiUrl } from "@/lib/app-config";
import type { WikiIngestInput } from "@/lib/validation";

export type WikiIngestResult = {
  ok: boolean;
  title: string;
  status?: string;
  note_path?: string;
  url?: string;
  error?: string;
};

export async function ingestWikiNote(
  input: WikiIngestInput,
): Promise<WikiIngestResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = process.env.WIKI_API_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(wikiUrl("/api/ingest"), {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });

    const body = (await response.json().catch(() => ({}))) as {
      status?: string;
      note_path?: string;
      url?: string;
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        title: input.title,
        error: body.error ?? body.message ?? `Personal Wiki returned ${response.status}`,
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
