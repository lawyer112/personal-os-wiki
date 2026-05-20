import { ingestWiki } from "@/lib/wiki-client";
import type { WikiIngestPayload as WikiClientIngestPayload } from "@/lib/wiki-client";

type LegacyMetadata = Record<string, unknown>;

export interface WikiIngestFrontmatter {
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
}

export interface WikiIngestPayload {
  frontmatter: WikiIngestFrontmatter;
  content: string;
}

export type LegacyWikiIngestInput = {
  title: string;
  content: string;
  source_type?: string;
  source_url?: string;
  tags?: string[];
  // Deprecated: callers should send `frontmatter` directly. Kept to translate older intake payloads.
  metadata?: LegacyMetadata;
};

export type WikiIngestInput = WikiIngestPayload | LegacyWikiIngestInput;

export type WikiIngestResult = {
  ok: boolean;
  title: string;
  status?: string;
  path?: string;
  note_path?: string;
  directory?: string;
  url?: string;
  task_id?: string;
  error?: string;
};

export const buildWikiIngestPayload = (
  input: WikiIngestInput,
): WikiIngestPayload => {
  const payload = hasFrontmatter(input)
    ? {
        frontmatter: { ...input.frontmatter },
        content: input.content,
      }
    : legacyToPayload(input);

  validatePayload(payload);
  return payload;
};

export const ingestWikiNote = async (
  input: WikiIngestInput,
): Promise<WikiIngestResult> => {
  const payload = buildWikiIngestPayload(input);
  try {
    const result = await ingestWiki(payload as WikiClientIngestPayload);
    return {
      ok: true,
      title: payload.frontmatter.title,
      status: result.status,
      path: result.path,
      note_path: result.path,
      directory: result.directory,
      url: result.url,
      task_id: result.task_id,
    };
  } catch (error) {
    return {
      ok: false,
      title: payload.frontmatter.title,
      error: error instanceof Error ? error.message : "Personal Wiki ingest failed",
    };
  }
};

const hasFrontmatter = (input: WikiIngestInput): input is WikiIngestPayload =>
  "frontmatter" in input && typeof input.frontmatter === "object" && input.frontmatter !== null;

const legacyToPayload = (input: LegacyWikiIngestInput): WikiIngestPayload => {
  const metadata = input.metadata ?? {};
  return {
    frontmatter: {
      title: input.title,
      type: requiredMetadataString(metadata, "type"),
      created_by: requiredMetadataString(metadata, "created_by"),
      task_id: optionalMetadataString(metadata, "task_id"),
      agent_id: optionalMetadataString(metadata, "agent_id"),
      project: optionalMetadataString(metadata, "project"),
      created_at: optionalMetadataString(metadata, "created_at"),
      source_type: input.source_type ?? requiredMetadataString(metadata, "source_type"),
      tags: input.tags ?? metadataStringArray(metadata, "tags"),
    },
    content: input.content,
  };
};

const validatePayload = (payload: WikiIngestPayload) => {
  const { frontmatter } = payload;
  requireText(frontmatter.created_by, "created_by");
  requireText(frontmatter.type, "type");
  requireText(frontmatter.source_type, "source_type");
  if (!Array.isArray(frontmatter.tags)) {
    throw new Error("tags is required");
  }
  if (frontmatter.created_by.startsWith("hermes:")) {
    requireText(frontmatter.task_id, "task_id");
  }
};

const requireText = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
};

const requiredMetadataString = (metadata: LegacyMetadata, field: string) => {
  const value = optionalMetadataString(metadata, field);
  if (!value) {
    throw new Error(`${field} is required`);
  }
  return value;
};

const optionalMetadataString = (metadata: LegacyMetadata, field: string) => {
  const value = metadata[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const metadataStringArray = (metadata: LegacyMetadata, field: string) => {
  const value = metadata[field];
  if (!Array.isArray(value)) {
    throw new Error(`${field} is required`);
  }
  return value.map((item) => String(item));
};
