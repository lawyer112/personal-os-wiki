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

export type WikiNoteDocument = {
  content: string;
  frontmatter: Record<string, unknown>;
  path: string;
  raw_body?: string;
  title: string;
};

type WikiNotesResponse = {
  notes?: WikiNoteSummary[];
};

export type WikiClientResult<TBody = unknown> = {
  ok: boolean;
  status: number;
  body: TBody | null;
  url: string;
};

type WikiClientBaseOptions = Omit<RequestInit, "body" | "headers" | "method"> & {
  headers?: Record<string, string>;
};

type WikiReadOptions = WikiClientBaseOptions & {
  method?: "GET" | "HEAD";
};

type WikiWriteOptions = WikiClientBaseOptions & {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

type WikiRequestOptions = WikiClientBaseOptions & {
  method: string;
  body?: unknown;
};

const READ_METHODS = new Set(["GET", "HEAD"]);
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function authHeaders(token?: string): Record<string, string> {
  if (!token) {
    return {};
  }

  const scheme = "Bearer";
  return { Authorization: scheme + " " + token };
}

function normalizeMethod(method: string) {
  return method.toUpperCase();
}

function assertAllowedWikiMethod(
  method: string,
  allowed: Set<string>,
  clientKind: "read" | "write",
) {
  if (!allowed.has(method)) {
    throw new Error(`Personal Wiki ${clientKind} client cannot use ${method}`);
  }
}

function assertReadHasNoBody(options: WikiReadOptions) {
  const unsafeBody = (options as WikiReadOptions & { body?: unknown }).body;
  if (unsafeBody !== undefined) {
    throw new Error("Personal Wiki read client cannot send a request body");
  }
}

function encodeBody(body: unknown) {
  if (body === undefined) {
    return undefined;
  }
  if (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }

  return JSON.stringify(body);
}

function jsonHeaders(body: unknown, headers: Record<string, string>) {
  if (
    body === undefined ||
    Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
  ) {
    return headers;
  }

  return { ...headers, "Content-Type": "application/json" };
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

async function requestWiki<TBody>(
  path: string,
  token: string | undefined,
  options: WikiRequestOptions,
): Promise<WikiClientResult<TBody>> {
  const { body, headers = {}, method, ...init } = options;
  const requestHeaders = jsonHeaders(body, {
    ...authHeaders(token),
    ...headers,
  });
  const url = wikiUrl(path);

  const response = await fetch(url, {
    cache: init.cache ?? "no-store",
    ...init,
    method,
    headers: requestHeaders,
    body: encodeBody(body),
  });

  return {
    ok: response.ok,
    status: response.status,
    body: (await parseBody(response)) as TBody | null,
    url,
  };
}

export const wikiClient = {
  read<TBody = unknown>(path: string, options: WikiReadOptions = {}) {
    const method = normalizeMethod(options.method ?? "GET");
    assertAllowedWikiMethod(method, READ_METHODS, "read");
    assertReadHasNoBody(options);

    return requestWiki<TBody>(path, process.env.WIKI_READ_TOKEN, {
      ...options,
      method,
      body: undefined,
    });
  },
  write<TBody = unknown>(path: string, options: WikiWriteOptions = {}) {
    const method = normalizeMethod(options.method ?? "POST");
    assertAllowedWikiMethod(method, WRITE_METHODS, "write");

    return requestWiki<TBody>(path, process.env.WIKI_API_TOKEN, {
      ...options,
      method,
    });
  },
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

  const result = await wikiClient.read<WikiNotesResponse>(
    `/api/notes?${params.toString()}`,
  );

  if (!result.ok) {
    throw new Error(`Personal Wiki search failed: ${result.status}`);
  }

  return result.body?.notes ?? [];
}

export const readWikiNote = async (path: string) => {
  const params = new URLSearchParams({ path });
  const result = await wikiClient.read<WikiNoteDocument>(
    `/api/note?${params.toString()}`,
  );

  if (!result.ok || !result.body) {
    throw new Error(`Personal Wiki note read failed: ${result.status}`);
  }

  return result.body;
};
