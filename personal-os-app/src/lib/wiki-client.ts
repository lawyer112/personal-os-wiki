import { wikiOpenUrl, wikiUrl } from "@/lib/app-config";

export type WikiNoteSummary = {
  title: string;
  path: string;
  created?: string;
  source_type?: string;
  source_url?: string;
  status?: string;
  tags?: string[];
  concepts?: string[];
  excerpt?: string;
  metadata?: Record<string, unknown>;
  personal_os_inbox_id?: string;
  personal_os_agent_run_id?: string;
  personal_os_project_id?: string;
  personal_os_task_id?: string;
};

export type WikiContextCandidate = WikiNoteSummary & {
  url: string;
  matchedQueries: string[];
  score: number;
};

type WikiNotesResponse = {
  notes?: WikiNoteSummary[];
};

export function wikiNoteUrl(path: string) {
  return wikiOpenUrl(`/note?path=${encodeURIComponent(path)}`);
}

export async function searchWikiNotes(query: string, pageSize = 8) {
  const params = new URLSearchParams({
    q: query,
    page: "1",
    page_size: String(pageSize),
  });
  const token = process.env.WIKI_READ_TOKEN;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(wikiUrl(`/api/notes?${params.toString()}`), {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Personal Wiki search failed: ${response.status}`);
  }

  const body = (await response.json()) as WikiNotesResponse;
  return body.notes ?? [];
}
