import { cache } from "react";
import { sql } from "./db";
import type { Sql } from "./db";
import { utcYear } from "./format";
import type { LibraryPost } from "./library";
import { displayExcerpt, displayTitle, displayType, effectiveTopics } from "./library";
import { toPublicPost, type PublicPost } from "./public";
import type { SearchDoc } from "./search";

type PostRow = {
  id: string;
  external_key: string;
  source: string;
  status: "draft" | "published" | "hidden";
  posted_at: string | Date;
  posted_at_precision: "minute" | "day";
  body: string;
  content_hash: string;
  linkedin_url: string | null;
  shared_url: string | null;
  suggested_title: string | null;
  suggested_excerpt: string | null;
  suggested_post_type: string | null;
  suggested_primary_topic: string | null;
  suggestion_ambiguous: boolean;
  suggestion_note: string | null;
  editorial_title: string | null;
  editorial_excerpt: string | null;
  title_locked: boolean;
  excerpt_locked: boolean;
  post_type: string | null;
  post_type_locked: boolean;
  primary_topic_slug: string | null;
  primary_topic_locked: boolean;
  published_at: string | Date | null;
};

export type TopicRecord = { slug: string; name: string; description: string; sortOrder: number; publishedCount: number };
export type CollectionRecord = {
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  curationLocked: boolean;
  postIds: string[];
};

export type Library = {
  posts: LibraryPost[];
  topics: TopicRecord[];
  tags: { slug: string; name: string; description: string }[];
  collections: CollectionRecord[];
  startHere: { postId: string; position: number; note: string }[];
  topicStarts: { topicSlug: string; postId: string; position: number }[];
};

function topicSearchName(slug: string, name: string): string {
  if (slug === "ai-agents") return "AI agents";
  return name;
}

function iso(value: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export async function loadLibrary(query: Sql = sql, publishedOnly = false): Promise<Library> {
  const posts = await query<PostRow>(
    `select id, external_key, source, status, posted_at, posted_at_precision, body, content_hash,
            linkedin_url, shared_url, suggested_title, suggested_excerpt, suggested_post_type,
            suggested_primary_topic, suggestion_ambiguous, suggestion_note, editorial_title,
            editorial_excerpt, title_locked, excerpt_locked, post_type, post_type_locked,
            primary_topic_slug, primary_topic_locked, published_at
     from posts
     where ($1::boolean = false or status = 'published')
     order by posted_at desc`,
    [publishedOnly],
  );
  const topicNames = await query<{ slug: string; name: string; description: string; sort_order: number }>(
    `select slug, name, description, sort_order from topics order by sort_order`,
  );
  const tagNames = await query<{ slug: string; name: string; description: string }>(
    `select slug, name, description from tags order by name`,
  );
  const postTopics = await query<{ post_id: string; topic_slug: string; relation: "primary" | "secondary" }>(
    `select post_id, topic_slug, relation from post_topics`,
  );
  const postTags = await query<{ post_id: string; tag_slug: string; origin: string }>(
    `select post_id, tag_slug, origin from post_tags`,
  );
  const media = await query<{
    id: string;
    post_id: string;
    url: string;
    association: string;
    approved: boolean;
    durable: boolean;
    expires_at: string | Date | null;
    alt_text: string | null;
  }>(`select id, post_id, url, association, approved, durable, expires_at, alt_text from post_media`);
  const collectionRows = await query<{ slug: string; title: string; description: string; sort_order: number; curation_locked: boolean }>(
    `select slug, title, description, sort_order, curation_locked from collections order by sort_order`,
  );
  const collectionPosts = await query<{ collection_slug: string; post_id: string; position: number }>(
    `select collection_slug, post_id, position from collection_posts order by position`,
  );
  const startHere = await query<{ post_id: string; position: number; note: string }>(
    `select post_id, position, note from start_here order by position`,
  );
  const topicStarts = await query<{ topic_slug: string; post_id: string; position: number }>(
    `select topic_slug, post_id, position from topic_starts order by position`,
  );

  const topicName = new Map(topicNames.map((topic) => [topic.slug, topic.name]));
  const tagName = new Map(tagNames.map((tag) => [tag.slug, tag.name]));
  const visible = new Set(posts.map((post) => post.id));

  const libraryPosts: LibraryPost[] = posts.map((post) => ({
    id: post.id,
    externalKey: post.external_key,
    source: post.source,
    status: post.status,
    postedAt: iso(post.posted_at) ?? new Date(0).toISOString(),
    postedAtPrecision: post.posted_at_precision,
    body: post.body,
    contentHash: post.content_hash,
    linkedinUrl: post.linkedin_url,
    sharedUrl: post.shared_url,
    suggestedTitle: post.suggested_title,
    suggestedExcerpt: post.suggested_excerpt,
    suggestedPostType: post.suggested_post_type,
    suggestedPrimaryTopic: post.suggested_primary_topic,
    suggestionAmbiguous: post.suggestion_ambiguous,
    suggestionNote: post.suggestion_note,
    editorialTitle: post.editorial_title,
    editorialExcerpt: post.editorial_excerpt,
    titleLocked: post.title_locked,
    excerptLocked: post.excerpt_locked,
    postType: post.post_type,
    postTypeLocked: post.post_type_locked,
    primaryTopicSlug: post.primary_topic_slug,
    primaryTopicLocked: post.primary_topic_locked,
    publishedAt: iso(post.published_at),
    topics: postTopics
      .filter((topic) => topic.post_id === post.id && topicName.has(topic.topic_slug))
      .map((topic) => ({ slug: topic.topic_slug, name: topicName.get(topic.topic_slug) ?? topic.topic_slug, relation: topic.relation })),
    tags: postTags
      .filter((tag) => tag.post_id === post.id && tagName.has(tag.tag_slug))
      .map((tag) => ({ slug: tag.tag_slug, name: tagName.get(tag.tag_slug) ?? tag.tag_slug, origin: tag.origin })),
    media: media
      .filter((item) => item.post_id === post.id)
      .map((item) => ({
        id: item.id,
        url: item.url,
        association: item.association,
        approved: item.approved,
        durable: item.durable,
        expiresAt: iso(item.expires_at),
        altText: item.alt_text,
      })),
    collectionSlugs: collectionPosts.filter((item) => item.post_id === post.id).map((item) => item.collection_slug),
  }));

  const publishedIds = new Set(libraryPosts.filter((post) => post.status === "published").map((post) => post.id));
  return {
    posts: libraryPosts,
    topics: topicNames.map((topic) => ({
      slug: topic.slug,
      name: topic.name,
      description: topic.description,
      sortOrder: topic.sort_order,
      publishedCount: libraryPosts.filter((post) => post.status === "published" && effectiveTopics(post).some((item) => item.slug === topic.slug)).length,
    })),
    tags: tagNames,
    collections: collectionRows.map((collection) => ({
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      sortOrder: collection.sort_order,
      curationLocked: collection.curation_locked,
      postIds: collectionPosts
        .filter((item) => item.collection_slug === collection.slug && visible.has(item.post_id))
        .sort((a, b) => a.position - b.position)
        .map((item) => item.post_id),
    })),
    startHere: startHere.filter((item) => !publishedOnly || publishedIds.has(item.post_id)).map((item) => ({
      postId: item.post_id,
      position: item.position,
      note: item.note,
    })),
    topicStarts: topicStarts.filter((item) => !publishedOnly || publishedIds.has(item.post_id)).map((item) => ({
      topicSlug: item.topic_slug,
      postId: item.post_id,
      position: item.position,
    })),
  };
}

export const getPublishedLibrary = cache(async () => loadLibrary(sql, true));
export const getEditorLibrary = cache(async () => loadLibrary(sql, false));

export function publicPosts(library: Library): PublicPost[] {
  return library.posts.map((post) => toPublicPost(post)).filter((post): post is PublicPost => Boolean(post));
}

export function searchDocsFromPublic(posts: PublicPost[], collections: CollectionRecord[]): SearchDoc[] {
  const titles = new Map(collections.map((collection) => [collection.slug, collection.title]));
  const membership = new Map<string, string[]>();
  for (const collection of collections) {
    for (const postId of collection.postIds) {
      const names = membership.get(postId) ?? [];
      const title = titles.get(collection.slug);
      if (title) names.push(title);
      membership.set(postId, names);
    }
  }
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    topicNames: post.topics.map((topic) => topicSearchName(topic.slug, topic.name)),
    tagNames: post.tags.map((tag) => tag.name),
    collectionNames: membership.get(post.id) ?? [],
    postType: post.postType,
    topicSlugs: post.topics.map((topic) => topic.slug),
    tagSlugs: post.tags.map((tag) => tag.slug),
    postedAt: post.postedAt,
    year: post.year || utcYear(post.postedAt),
    contentHash: undefined,
  }));
}

export function editorSearchDocs(posts: LibraryPost[], collections: CollectionRecord[]): SearchDoc[] {
  return posts.map((post) => ({
    id: post.id,
    title: displayTitle(post),
    excerpt: displayExcerpt(post),
    body: post.body,
    topicNames: effectiveTopics(post).map((topic) => topicSearchName(topic.slug, topic.name)),
    tagNames: post.tags.map((tag) => tag.name),
    collectionNames: collections.filter((collection) => collection.postIds.includes(post.id)).map((collection) => collection.title),
    postType: displayType(post),
    topicSlugs: effectiveTopics(post).map((topic) => topic.slug),
    tagSlugs: post.tags.map((tag) => tag.slug),
    postedAt: post.postedAt,
    year: utcYear(post.postedAt),
    contentHash: post.contentHash,
  }));
}
