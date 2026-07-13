import { wikiOpenUrl } from "@/lib/app-config";
import { wikiClient } from "@/lib/wiki-client";

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

type WikiIngestNoteInput = {
  frontmatter?: {
    title: string;
    type: string;
    created_by: string;
    source_type: string;
    tags: string[];
    created_at?: string;
    task_id?: string;
    agent_id?: string;
    project?: string;
    last_reviewed?: string;
    migration?: string;
  };
  title?: string;
  content: string;
  source_type?: string;
  source_url?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

type WikiIngestOptions = {
  light?: boolean;
};

const wikiIngestTitle = (input: WikiIngestNoteInput) =>
  input.frontmatter?.title ?? input.title ?? "untitled-wiki-note";

export async function ingestWikiNote(
  input: WikiIngestNoteInput,
  options: WikiIngestOptions = {},
): Promise<WikiIngestResult> {
  const title = wikiIngestTitle(input);
  const payload = {
    ...input,
    metadata: input.metadata ?? {},
  };
  const endpoint = options.light ? "/api/ingest?mode=light" : "/api/ingest";

  try {
    const result = await wikiClient.write<WikiIngestResponse>(endpoint, {
      body: payload,
    });
    const body = result.body ?? {};

    if (!result.ok) {
      return {
        ok: false,
        title,
        error: body.error ?? body.message ?? `Personal Wiki returned ${result.status}`,
      };
    }

    return {
      ok: true,
      title,
      status: body.status,
      note_path: body.note_path,
      url: body.url ? wikiOpenUrl(body.url) : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      title,
      error: error instanceof Error ? error.message : "Personal Wiki ingest failed",
    };
  }
}
