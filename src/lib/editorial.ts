import { randomUUID } from "node:crypto";
import type { Sql } from "./db";
import { isSafeId } from "./urls";
import { POST_TYPES, type PostTypeSlug } from "./site";

const STATUSES = new Set(["draft", "published", "hidden"]);
const TYPES = new Set(POST_TYPES.map((type) => type.slug));

export async function setPostStatus(sql: Sql, ids: string[], status: "draft" | "published" | "hidden"): Promise<number> {
  if (!STATUSES.has(status)) return 0;
  const clean = ids.filter(isSafeId);
  if (!clean.length) return 0;
  if (status === "published") {
    const rows = await sql(
      `update posts set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
       where id = any($1::text[]) returning id`,
      [clean],
    );
    return rows.length;
  }
  const rows = await sql(`update posts set status = $2, updated_at = now() where id = any($1::text[]) returning id`, [clean, status]);
  return rows.length;
}

export async function savePostEditorial(
  sql: Sql,
  input: {
    id: string;
    title: string;
    excerpt: string;
    postType: string;
    primaryTopic: string;
    secondaryTopics: string[];
    tags: string[];
    approvedMedia: string[];
    collections: string[];
  },
): Promise<void> {
  if (!isSafeId(input.id)) throw new Error("Unknown post");
  const postType = TYPES.has(input.postType as PostTypeSlug) ? input.postType : "commentary";
  const topics = await sql<{ slug: string }>(`select slug from topics`);
  const topicSet = new Set(topics.map((topic) => topic.slug));
  const primary = topicSet.has(input.primaryTopic) ? input.primaryTopic : null;
  const secondary = input.secondaryTopics.filter((slug) => topicSet.has(slug) && slug !== primary);
  const knownTags = new Set((await sql<{ slug: string }>(`select slug from tags`)).map((tag) => tag.slug));
  const tags = input.tags.filter((slug) => knownTags.has(slug));
  await sql(
    `update posts set
      editorial_title = $2,
      title_locked = true,
      editorial_excerpt = $3,
      excerpt_locked = true,
      post_type = $4,
      post_type_locked = true,
      primary_topic_slug = $5,
      primary_topic_locked = true,
      updated_at = now()
    where id = $1`,
    [input.id, input.title.trim() || null, input.excerpt.trim() || null, postType, primary],
  );
  await sql(`delete from post_topics where post_id = $1`, [input.id]);
  if (primary) {
    await sql(`insert into post_topics (post_id, topic_slug, relation, origin) values ($1, $2, 'primary', 'editorial')`, [input.id, primary]);
  }
  for (const slug of secondary) {
    await sql(`insert into post_topics (post_id, topic_slug, relation, origin) values ($1, $2, 'secondary', 'editorial')`, [input.id, slug]);
  }
  const previous = await sql<{ tag_slug: string }>(`select tag_slug from post_tags where post_id = $1`, [input.id]);
  await sql(`delete from post_tags where post_id = $1`, [input.id]);
  for (const slug of tags) {
    await sql(`insert into post_tags (post_id, tag_slug, origin) values ($1, $2, 'editorial')`, [input.id, slug]);
  }
  const removed = previous.map((row) => row.tag_slug).filter((slug) => !tags.includes(slug));
  for (const slug of removed) {
    await sql(
      `insert into post_tag_rejections (post_id, tag_slug) values ($1, $2) on conflict do nothing`,
      [input.id, slug],
    );
  }
  await sql(`delete from post_tag_rejections where post_id = $1 and tag_slug = any($2::text[])`, [input.id, tags.length ? tags : ["__none__"]]);
  const media = await sql<{ id: string }>(`select id from post_media where post_id = $1`, [input.id]);
  const approved = new Set(input.approvedMedia);
  for (const item of media) {
    await sql(`update post_media set approved = $2 where id = $1 and post_id = $3`, [item.id, approved.has(item.id), input.id]);
  }
  await setPostCollections(sql, input.id, input.collections.filter((slug) => isSafeId(slug)));
}

export async function setPostCollections(sql: Sql, postId: string, slugs: string[]): Promise<void> {
  const collections = await sql<{ slug: string }>(`select slug from collections`);
  const known = new Set(collections.map((collection) => collection.slug));
  const wanted = new Set(slugs.filter((slug) => known.has(slug)));
  const current = await sql<{ collection_slug: string }>(`select collection_slug from collection_posts where post_id = $1`, [postId]);
  const currentSet = new Set(current.map((row) => row.collection_slug));
  for (const slug of wanted) {
    if (currentSet.has(slug)) continue;
    const positionRows = await sql<{ max: number | null }>(
      `select coalesce(max(position), 0) as max from collection_posts where collection_slug = $1`,
      [slug],
    );
    const position = Number(positionRows[0]?.max ?? 0) + 1;
    await sql(`delete from collection_exclusions where collection_slug = $1 and post_id = $2`, [slug, postId]);
    await sql(
      `insert into collection_posts (collection_slug, post_id, position, origin) values ($1, $2, $3, 'editorial')`,
      [slug, postId, position],
    );
    await sql(`update collections set curation_locked = true where slug = $1`, [slug]);
  }
  for (const slug of currentSet) {
    if (wanted.has(slug)) continue;
    await sql(`delete from collection_posts where collection_slug = $1 and post_id = $2`, [slug, postId]);
    await sql(
      `insert into collection_exclusions (collection_slug, post_id) values ($1, $2) on conflict do nothing`,
      [slug, postId],
    );
    await sql(`update collections set curation_locked = true where slug = $1`, [slug]);
  }
}

export async function moveCollectionPost(sql: Sql, slug: string, postId: string, direction: -1 | 1): Promise<void> {
  const rows = await sql<{ post_id: string; position: number }>(
    `select post_id, position from collection_posts where collection_slug = $1 order by position, post_id`,
    [slug],
  );
  const index = rows.findIndex((row) => row.post_id === postId);
  const swap = rows[index + direction];
  const current = rows[index];
  if (!current || !swap) return;
  await sql(`update collection_posts set position = $3, origin = 'editorial' where collection_slug = $1 and post_id = $2`, [slug, current.post_id, swap.position]);
  await sql(`update collection_posts set position = $3, origin = 'editorial' where collection_slug = $1 and post_id = $2`, [slug, swap.post_id, current.position]);
  await sql(`update collections set curation_locked = true where slug = $1`, [slug]);
}

export async function mergeTags(sql: Sql, from: string, into: string): Promise<void> {
  if (from === into || !isSafeId(from) || !isSafeId(into)) return;
  const tags = await sql<{ slug: string; name: string }>(`select slug, name from tags where slug = any($1::text[])`, [[from, into]]);
  if (tags.length !== 2) return;
  const source = tags.find((tag) => tag.slug === from);
  await sql(
    `insert into post_tags (post_id, tag_slug, origin)
     select post_id, $2, 'editorial' from post_tags where tag_slug = $1
     on conflict do nothing`,
    [from, into],
  );
  await sql(`delete from post_tags where tag_slug = $1`, [from]);
  await sql(
    `insert into post_tag_rejections (post_id, tag_slug)
     select post_id, $2 from post_tag_rejections where tag_slug = $1
     on conflict do nothing`,
    [from, into],
  );
  await sql(`delete from post_tag_rejections where tag_slug = $1`, [from]);
  if (source) {
    await sql(`insert into tag_aliases (alias, tag_slug) values ($1, $2) on conflict (alias) do update set tag_slug = excluded.tag_slug`, [
      source.name.toLowerCase(),
      into,
    ]);
  }
  await sql(`delete from tags where slug = $1`, [from]);
}

export async function setRecommendation(sql: Sql, postId: string, relatedId: string, mode: "pin" | "remove" | "clear"): Promise<void> {
  if (!isSafeId(postId) || !isSafeId(relatedId) || postId === relatedId) return;
  if (mode === "clear") {
    await sql(`delete from recommendation_overrides where post_id = $1 and related_post_id = $2`, [postId, relatedId]);
    return;
  }
  await sql(
    `insert into recommendation_overrides (post_id, related_post_id, pinned, removed) values ($1, $2, $3, $4)
     on conflict (post_id, related_post_id) do update set pinned = excluded.pinned, removed = excluded.removed`,
    [postId, relatedId, mode === "pin", mode === "remove"],
  );
}

export async function saveStartHere(sql: Sql, orderedIds: string[], notes: Record<string, string>): Promise<void> {
  const clean = orderedIds.filter(isSafeId);
  await sql(`delete from start_here where not (post_id = any($1::text[]))`, [clean.length ? clean : ["__none__"]]);
  for (const [index, id] of clean.entries()) {
    await sql(
      `insert into start_here (post_id, position, note) values ($1, $2, $3)
       on conflict (post_id) do update set position = excluded.position, note = excluded.note`,
      [id, index + 1, (notes[id] ?? "").slice(0, 280)],
    );
  }
}

export async function saveTopicStarts(sql: Sql, topicSlug: string, orderedIds: string[]): Promise<void> {
  if (!isSafeId(topicSlug)) return;
  const clean = orderedIds.filter(isSafeId);
  await sql(`delete from topic_starts where topic_slug = $1`, [topicSlug]);
  for (const [index, id] of clean.entries()) {
    await sql(`insert into topic_starts (topic_slug, post_id, position) values ($1, $2, $3)`, [topicSlug, id, index + 1]);
  }
}

export async function updateTopicDescription(sql: Sql, slug: string, description: string): Promise<void> {
  if (!isSafeId(slug)) return;
  await sql(`update topics set description = $2 where slug = $1`, [slug, description.trim().slice(0, 600)]);
}

export async function updateCollection(sql: Sql, slug: string, title: string, description: string): Promise<void> {
  if (!isSafeId(slug)) return;
  await sql(`update collections set title = $2, description = $3 where slug = $1`, [slug, title.trim().slice(0, 120), description.trim().slice(0, 800)]);
}

export async function unlockPostField(sql: Sql, id: string, field: "title" | "excerpt" | "type" | "topic"): Promise<void> {
  if (!isSafeId(id)) return;
  if (field === "title") await sql(`update posts set title_locked = false, editorial_title = null, updated_at = now() where id = $1`, [id]);
  if (field === "excerpt") await sql(`update posts set excerpt_locked = false, editorial_excerpt = null, updated_at = now() where id = $1`, [id]);
  if (field === "type") await sql(`update posts set post_type_locked = false, post_type = suggested_post_type, updated_at = now() where id = $1`, [id]);
  if (field === "topic") {
    await sql(`update posts set primary_topic_locked = false, primary_topic_slug = suggested_primary_topic, updated_at = now() where id = $1`, [id]);
  }
}

export async function resolveReview(sql: Sql, id: string): Promise<void> {
  if (!isSafeId(id)) return;
  await sql(`update review_items set status = 'resolved' where id = $1`, [id]);
}

export function newReviewId(): string {
  return randomUUID();
}
