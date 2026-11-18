import type { SearchDoc, SearchHit, Segment } from "./search";
import { searchDocuments } from "./search";
import { PAGE_SIZE, POST_TYPES } from "./site";

export type ExploreParams = {
  q: string;
  topic: string;
  year: string;
  type: string;
  sort: "relevance" | "newest" | "oldest";
  page: number;
};

export type ExploreResult = {
  hits: { doc: SearchDoc; score: number; snippet: Segment[] | null }[];
  total: number;
  page: number;
  pages: number;
};

const TYPES = new Set(POST_TYPES.map((type) => type.slug));

export function parseExploreParams(input: Record<string, string | string[] | undefined>): ExploreParams {
  const q = one(input.q).slice(0, 200);
  const topic = /^[a-z0-9-]{0,80}$/.test(one(input.topic)) ? one(input.topic) : "";
  const year = /^\d{4}$/.test(one(input.year)) ? one(input.year) : "";
  const type = TYPES.has(one(input.type) as (typeof POST_TYPES)[number]["slug"]) ? one(input.type) : "";
  const requested = one(input.sort);
  const sort = requested === "oldest" || requested === "relevance" || requested === "newest" ? requested : q ? "relevance" : "newest";
  const page = Math.min(10_000, Math.max(1, Number.parseInt(one(input.page) || "1", 10) || 1));
  return { q, topic, year, type, sort, page };
}

export function exploreHref(params: Partial<ExploreParams> & { q?: string }, updates: Partial<ExploreParams> = {}): string {
  const next = { ...params, ...updates };
  const search = new URLSearchParams();
  if (next.q) search.set("q", next.q);
  if (next.topic) search.set("topic", next.topic);
  if (next.year) search.set("year", next.year);
  if (next.type) search.set("type", next.type);
  if (next.sort && next.sort !== "newest") search.set("sort", next.sort);
  if (next.page && next.page > 1) search.set("page", String(next.page));
  const query = search.toString();
  return query ? `/explore?${query}` : "/explore";
}

export function runExplore(docs: SearchDoc[], params: ExploreParams, aliasGroups?: string[][]): ExploreResult {
  const filtered = docs.filter((doc) => {
    if (params.topic && !doc.topicSlugs.includes(params.topic)) return false;
    if (params.year && String(doc.year) !== params.year) return false;
    if (params.type && doc.postType !== params.type) return false;
    return true;
  });
  let ranked: { doc: SearchDoc; score: number; snippet: Segment[] | null }[];
  if (params.q.trim()) {
    const hits = new Map<string, SearchHit>(searchDocuments(filtered, params.q, aliasGroups).map((hit) => [hit.id, hit]));
    ranked = filtered
      .filter((doc) => hits.has(doc.id))
      .map((doc) => ({ doc, score: hits.get(doc.id)?.score ?? 0, snippet: hits.get(doc.id)?.snippet ?? null }));
    if (params.sort === "newest") ranked.sort((a, b) => b.doc.postedAt.localeCompare(a.doc.postedAt));
    else if (params.sort === "oldest") ranked.sort((a, b) => a.doc.postedAt.localeCompare(b.doc.postedAt));
    else ranked.sort((a, b) => b.score - a.score || b.doc.postedAt.localeCompare(a.doc.postedAt));
  } else {
    ranked = filtered.map((doc) => ({ doc, score: 0, snippet: null }));
    ranked.sort((a, b) => (params.sort === "oldest" ? a.doc.postedAt.localeCompare(b.doc.postedAt) : b.doc.postedAt.localeCompare(a.doc.postedAt)));
  }
  const pages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const page = Math.min(params.page, pages);
  const start = (page - 1) * PAGE_SIZE;
  return { hits: ranked.slice(start, start + PAGE_SIZE), total: ranked.length, page, pages };
}

function one(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
