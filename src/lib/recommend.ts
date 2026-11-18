import type { SearchDoc } from "./search";

export type RecommendationOverride = {
  postId: string;
  relatedPostId: string;
  pinned: boolean;
  removed: boolean;
};

export type Related = {
  id: string;
  score: number;
  reason: string;
  pinned: boolean;
};

export function relatedReading(
  current: SearchDoc,
  docs: SearchDoc[],
  overrides: RecommendationOverride[],
  limit = 3,
): Related[] {
  const mine = overrides.filter((item) => item.postId === current.id);
  const removed = new Set(mine.filter((item) => item.removed).map((item) => item.relatedPostId));
  const pinnedIds = mine.filter((item) => item.pinned).map((item) => item.relatedPostId);
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const tagDf = new Map<string, number>();
  for (const doc of docs) {
    for (const tag of new Set(doc.tagSlugs)) tagDf.set(tag, (tagDf.get(tag) ?? 0) + 1);
  }

  const results: Related[] = [];
  const seen = new Set<string>([current.id]);
  for (const doc of docs) {
    if (doc.id !== current.id && doc.body && doc.body === current.body) seen.add(doc.id);
    if (doc.id !== current.id && doc.contentHash && current.contentHash && doc.contentHash === current.contentHash) seen.add(doc.id);
  }

  for (const id of pinnedIds) {
    const doc = byId.get(id);
    if (!doc || seen.has(doc.id)) continue;
    seen.add(doc.id);
    results.push({ id, score: 1000, reason: "Pinned", pinned: true });
  }

  const scored = docs
    .filter((doc) => !seen.has(doc.id) && !removed.has(doc.id))
    .map((doc) => scorePair(current, doc, tagDf))
    .filter((item) => item.strong)
    .sort((a, b) => b.score - a.score || b.postedAt.localeCompare(a.postedAt));

  for (const item of scored) {
    if (results.length >= limit) break;
    results.push({ id: item.id, score: item.score, reason: item.reason, pinned: false });
  }
  return results.slice(0, limit);
}

function scorePair(
  current: SearchDoc,
  other: SearchDoc,
  tagDf: Map<string, number>,
): { id: string; score: number; reason: string; strong: boolean; postedAt: string } {
  const shared = current.tagSlugs.filter((tag) => other.tagSlugs.includes(tag));
  let score = 0;
  const rare: string[] = [];
  for (const tag of shared) {
    const df = tagDf.get(tag) ?? 1;
    const weight = df < 40 ? 10 : df < 90 ? 6 : 3;
    score += weight;
    if (weight >= 6) rare.push(tag);
  }
  const samePrimary = current.topicSlugs[0] && current.topicSlugs[0] === other.topicSlugs[0];
  if (samePrimary) score += 2;
  const strong = shared.length > 0 && score >= 8;
  const reason = rare.length
    ? `Goes further on ${rare.slice(0, 3).join(", ")}`
    : shared.length
      ? `Shared tags: ${shared.slice(0, 3).join(", ")}`
      : "Same topic";
  return { id: other.id, score, reason, strong, postedAt: other.postedAt };
}
