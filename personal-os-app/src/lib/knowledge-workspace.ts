export type KnowledgeMeta = {
  space?: string; book?: string; chapter?: string; status?: string;
  owner?: string; confidence?: string; sensitivity?: string;
  created?: string; updated?: string; valid_until?: string;
  source_url?: string; tags?: string[]; [key: string]: unknown;
};
export type KnowledgeNote = {
  id: string; path: string; title: string; content: string; raw_body?: string;
  revision: string; currentRevision: string; historical: boolean;
  frontmatter: KnowledgeMeta; history: { revision: string; savedAt: string }[];
};
export type KnowledgeSummary = {
  id: string; path: string; title: string; excerpt: string; revision: string;
  space: string; book: string; chapter: string; status: string; updated: string; tags: string[];
};
export type KnowledgeCatalog = {
  notes: KnowledgeSummary[]; page: number; pageSize: number; total: number; writable: boolean;
  tree: { space: string; book: string; chapter: string; count: number }[];
};
export type KnowledgeResponse = {
  note: KnowledgeNote; writable: boolean; indexed?: boolean;
  tasks: { id: string; title: string; status: string; submittedAt?: string | null }[];
};
