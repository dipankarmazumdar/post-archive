import type { Sql } from "./db";
import { isSafeId, safeHttpUrl } from "./urls";

const MAX_BYTES = 8_000_000;
const STATUSES = new Set(["draft", "published", "hidden"]);

export async function exportBundle(sql: Sql): Promise<string> {
  const posts = await sql(`select * from posts order by posted_at`);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    posts,
    postTopics: await sql(`select * from post_topics`),
    postTags: await sql(`select * from post_tags`),
    postTagRejections: await sql(`select * from post_tag_rejections`),
    postMedia: await sql(`select * from post_media`),
    collections: await sql(`select * from collections`),
    collectionPosts: await sql(`select * from collection_posts`),
    collectionExclusions: await sql(`select * from collection_exclusions`),
    recommendationOverrides: await sql(`select * from recommendation_overrides`),
    startHere: await sql(`select * from start_here`),
    topicStarts: await sql(`select * from topic_starts`),
    topicDescriptions: await sql(`select slug, description from topics`),
  };
  return JSON.stringify(payload);
}

export async function importBundle(sql: Sql, raw: string): Promise<{ posts: number }> {
  if (raw.length > MAX_BYTES) throw new Error("Bundle is too large");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("Bundle is not valid JSON");
  }
  if (data.version !== 1) throw new Error("Unsupported bundle version");
  const posts = asRows(data.posts);
  if (posts.length > 5000) throw new Error("Bundle has too many posts");
  let count = 0;
  for (const post of posts) {
    const id = text(post.id);
    const externalKey = text(post.external_key);
    const status = text(post.status);
    if (!isSafeId(id) || !externalKey || !STATUSES.has(status)) continue;
    const linkedin = text(post.linkedin_url);
    const shared = text(post.shared_url);
    await sql(
      `insert into posts (
        id, external_key, source, posted_at, posted_at_precision, body, content_hash, linkedin_url, shared_url,
        status, suggested_title, suggested_excerpt, suggested_post_type, suggested_primary_topic,
        suggestion_ambiguous, suggestion_note, editorial_title, editorial_excerpt, title_locked, excerpt_locked,
        post_type, post_type_locked, primary_topic_slug, primary_topic_locked, published_at, updated_at
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,
        $15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25, now()
      )
      on conflict (external_key) do update set
        body = excluded.body,
        content_hash = excluded.content_hash,
        linkedin_url = excluded.linkedin_url,
        shared_url = excluded.shared_url,
        status = excluded.status,
        suggested_title = excluded.suggested_title,
        suggested_excerpt = excluded.suggested_excerpt,
        suggested_post_type = excluded.suggested_post_type,
        suggested_primary_topic = excluded.suggested_primary_topic,
        suggestion_ambiguous = excluded.suggestion_ambiguous,
        suggestion_note = excluded.suggestion_note,
        editorial_title = excluded.editorial_title,
        editorial_excerpt = excluded.editorial_excerpt,
        title_locked = excluded.title_locked,
        excerpt_locked = excluded.excerpt_locked,
        post_type = excluded.post_type,
        post_type_locked = excluded.post_type_locked,
        primary_topic_slug = excluded.primary_topic_slug,
        primary_topic_locked = excluded.primary_topic_locked,
        published_at = excluded.published_at,
        updated_at = now()`,
      [
        id,
        externalKey,
        text(post.source) || "shares",
        text(post.posted_at),
        text(post.posted_at_precision) === "day" ? "day" : "minute",
        text(post.body),
        text(post.content_hash),
        linkedin ? safeHttpUrl(linkedin) : null,
        shared ? safeHttpUrl(shared) : null,
        status,
        textOrNull(post.suggested_title),
        textOrNull(post.suggested_excerpt),
        textOrNull(post.suggested_post_type),
        textOrNull(post.suggested_primary_topic),
        Boolean(post.suggestion_ambiguous),
        textOrNull(post.suggestion_note),
        textOrNull(post.editorial_title),
        textOrNull(post.editorial_excerpt),
        Boolean(post.title_locked),
        Boolean(post.excerpt_locked),
        textOrNull(post.post_type),
        Boolean(post.post_type_locked),
        textOrNull(post.primary_topic_slug),
        Boolean(post.primary_topic_locked),
        textOrNull(post.published_at),
      ],
    );
    count += 1;
  }
  await replaceChild(sql, "post_topics", ["post_id", "topic_slug", "relation", "origin"], asRows(data.postTopics));
  await replaceChild(sql, "post_tags", ["post_id", "tag_slug", "origin"], asRows(data.postTags));
  await replaceChild(sql, "post_tag_rejections", ["post_id", "tag_slug"], asRows(data.postTagRejections));
  await replaceChild(sql, "collection_posts", ["collection_slug", "post_id", "position", "origin"], asRows(data.collectionPosts));
  await replaceChild(sql, "collection_exclusions", ["collection_slug", "post_id"], asRows(data.collectionExclusions));
  await replaceChild(sql, "recommendation_overrides", ["post_id", "related_post_id", "pinned", "removed"], asRows(data.recommendationOverrides));
  await replaceChild(sql, "start_here", ["post_id", "position", "note"], asRows(data.startHere));
  await replaceChild(sql, "topic_starts", ["topic_slug", "post_id", "position"], asRows(data.topicStarts));
  for (const topic of asRows(data.topicDescriptions)) {
    const slug = text(topic.slug);
    if (!isSafeId(slug)) continue;
    await sql(`update topics set description = $2 where slug = $1`, [slug, text(topic.description).slice(0, 600)]);
  }
  return { posts: count };
}

async function replaceChild(sql: Sql, table: string, columns: string[], rows: Record<string, unknown>[]): Promise<void> {
  const allowed = new Set([
    "post_topics",
    "post_tags",
    "post_tag_rejections",
    "collection_posts",
    "collection_exclusions",
    "recommendation_overrides",
    "start_here",
    "topic_starts",
  ]);
  if (!allowed.has(table)) throw new Error("Unexpected bundle table");
  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    if (values.some((value, index) => typeof value === "string" && value.length > 4000 && columns[index] !== "note")) continue;
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    await sql(
      `insert into ${table} (${columns.join(", ")}) values (${placeholders}) on conflict do nothing`,
      values,
    );
  }
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value instanceof Date ? value.toISOString() : "";
}

function textOrNull(value: unknown): string | null {
  const result = text(value).trim();
  return result ? result : null;
}
