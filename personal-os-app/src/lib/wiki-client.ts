import { personalWikiUrl, wikiApiUrl, wikiOpenUrl } from "@/lib/app-config";

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

export type WikiIngestFrontmatter = {
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

export type WikiIngestPayload = {
  frontmatter: WikiIngestFrontmatter;
  content: string;
};

export type WikiIngestResponse = {
  status: string;
  path: string;
  directory: string;
  url?: string;
  task_id?: string;
  rolled_to?: string;
};

type WikiErrorBody = {
  error?: string;
  code?: string;
  message?: string;
  details?: unknown;
};

export class WikiClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export class WikiAuthError extends WikiClientError {}

export class WikiSourceConflict extends WikiClientError {}

export class WikiPayloadTooLarge extends WikiClientError {}

export class WikiLockTimeout extends WikiClientError {}

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

  const response = await fetch(wikiApiUrl(`/api/notes?${params.toString()}`), {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Personal Wiki search failed: ${response.status}`);
  }

  const body = (await response.json()) as WikiNotesResponse;
  return body.notes ?? [];
}

export const ingestWiki = async (
  payload: WikiIngestPayload,
): Promise<WikiIngestResponse> => {
  let lastLockTimeout: WikiLockTimeout | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(wikiApiUrl("/api/ingest"), {
      method: "POST",
      headers: wikiWriteHeaders(),
      body: JSON.stringify(payload),
    });
    const body = await readWikiJson(response);

    if (response.ok) {
      return normalizeIngestResponse(body);
    }

    const error = wikiErrorForResponse(response, body);
    if (error instanceof WikiLockTimeout && attempt === 0) {
      lastLockTimeout = error;
      continue;
    }
    throw error;
  }

  throw lastLockTimeout ?? new WikiClientError("Personal Wiki ingest failed");
};

const wikiWriteHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = process.env.WIKI_API_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const readWikiJson = async (response: Response) => {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
};

const normalizeIngestResponse = (body: Record<string, unknown>): WikiIngestResponse => {
  const rawUrl = stringValue(body.url);
  return {
    status: stringValue(body.status) ?? "created",
    path: stringValue(body.path) ?? "",
    directory: stringValue(body.directory) ?? "",
    url: rawUrl ? wikiOpenFromIngestUrl(rawUrl) : undefined,
    task_id: stringValue(body.task_id),
    rolled_to: stringValue(body.rolled_to),
  };
};

const wikiOpenFromIngestUrl = (url: string) => {
  try {
    const parsed = new URL(url, personalWikiUrl);
    return wikiOpenUrl(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return wikiOpenUrl(url);
  }
};

const wikiErrorForResponse = (
  response: Response,
  body: Record<string, unknown>,
) => {
  const errorBody = body as WikiErrorBody;
  const code = stringValue(errorBody.code);
  const message =
    stringValue(errorBody.error) ??
    stringValue(errorBody.message) ??
    `Personal Wiki returned ${response.status}`;

  if (response.status === 401) {
    return new WikiAuthError(message, response.status, code, errorBody.details);
  }
  if (response.status === 409 && code === "source-immutable") {
    return new WikiSourceConflict(message, response.status, code, errorBody.details);
  }
  if (response.status === 413) {
    return new WikiPayloadTooLarge(message, response.status, code, errorBody.details);
  }
  if (response.status === 503 && code === "lock-timeout") {
    return new WikiLockTimeout(message, response.status, code, errorBody.details);
  }

  return new WikiClientError(message, response.status, code, errorBody.details);
};

const stringValue = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;
