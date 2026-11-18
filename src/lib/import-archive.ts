import { randomUUID } from "node:crypto";
import type { Sql } from "./db";
import { matchRichMedia, type AmbiguousRecord, type ParsedExport, type ParsedPost } from "./parse-export";
import { isDurableMediaUrl, mediaExpiry } from "./urls";
import { classifyPost, planCollections, type CollectionCandidate } from "./taxonomy";

export type ImportReport = {
  mode: "dry-run" | "apply";
  files: ParsedExport["inventory"];
  ignoredFiles: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  ambiguous: number;
  skippedReasons: Record<string, number>;
  ambiguousKeys: string[];
  mediaAttached: number;
  ambiguousMedia: number;
};

type Existing = {
  id: string;
  external_key: string;
  content_hash: string;
  title_locked: boolean;
  excerpt_locked: boolean;
  post_type_locked: boolean;
  primary_topic_locked: boolean;
  status: string;
};

export async function importParsed(sql: Sql, parsed: ParsedExport, mode: "dry-run" | "apply"): Promise<ImportReport> {
  const existingRows = await sql<Existing>(
    `select id, external_key, content_hash, title_locked, excerpt_locked, post_type_locked, primary_topic_locked, status from posts`,
  );
  const existing = new Map(existingRows.map((row) => [row.external_key, row]));
  const report: ImportReport = {
    mode,
    files: parsed.inventory,
    ignoredFiles: parsed.ignoredFiles,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: parsed.skipped.length,
    ambiguous: parsed.ambiguous.length,
    skippedReasons: countReasons(parsed.skipped.map((item) => item.reason)),
    ambiguousKeys: unique(parsed.ambiguous.map((item) => item.externalKey)).slice(0, 50),
    mediaAttached: 0,
    ambiguousMedia: 0,
  };

  const ready: { post: ParsedPost; action: "create" | "update" | "unchanged"; existing?: Existing }[] = [];
  for (const post of parsed.posts) {
    const prior = existing.get(post.externalKey);
    if (!prior) {
      report.created += 1;
      ready.push({ post, action: "create" });
    } else if (prior.content_hash !== post.contentHash) {
      report.updated += 1;
      ready.push({ post, action: "update", existing: prior });
    } else {
      report.unchanged += 1;
      ready.push({ post, action: "unchanged", existing: prior });
    }
  }

  const knownPosts = [
    ...existingRows.map((row) => ({ id: row.id, externalKey: row.external_key })),
    ...ready.filter((item) => item.action === "create").map((item) => ({ id: item.post.id, externalKey: item.post.externalKey })),
  ];
  const mediaTargets = knownPosts
    .map((item) => {
      const incoming = parsed.posts.find((post) => post.externalKey === item.externalKey);
      const prior = existing.get(item.externalKey);
      return incoming
        ? { id: prior?.id ?? incoming.id, postedAt: incoming.postedAt, body: incoming.body, media: incoming.media }
        : null;
    })
    .filter((item): item is { id: string; postedAt: string; body: string; media: ParsedPost["media"] } => Boolean(item));

  const inferred = matchRichMedia(mediaTargets, parsed.richMedia);
  report.ambiguous += inferred.ambiguous.length;
  report.ambiguousMedia = inferred.ambiguous.length;
  report.mediaAttached = ready.reduce((sum, item) => sum + item.post.media.length, 0);
  report.ambiguousKeys = unique([...report.ambiguousKeys, ...inferred.ambiguous.map((item) => item.externalKey)]).slice(0, 50);

  if (mode === "dry-run") return report;

  const importId = randomUUID();
  for (const item of ready) {
    if (item.action === "create") await insertPost(sql, item.post, importId);
    else if (item.action === "update" && item.existing) await updatePost(sql, item.existing, item.post, importId);
    await attachMedia(sql, item.existing?.id ?? item.post.id, item.post.media);
  }
  for (const match of inferred.matches) {
    await attachMedia(sql, match.postId, [
      {
        url: match.url,
        association: "inferred",
        durable: isDurableMediaUrl(match.url),
        expiresAt: mediaExpiry(match.url),
        altText: match.altText,
      },
    ]);
  }
  await writeReview(sql, importId, [...parsed.ambiguous, ...inferred.ambiguous]);
  await refreshSuggestions(sql, ready.filter((item) => item.action !== "unchanged").map((item) => item.existing?.id ?? item.post.id));
  await rebuildSuggestedCollections(sql);
  await sql(
    `insert into import_runs (id, mode, status, finished_at, stats, message) values ($1, 'apply', 'complete', now(), $2, $3)`,
    [importId, JSON.stringify(publicStats(report)), "Import applied"],
  );
  return report;
}

async function insertPost(sql: Sql, post: ParsedPost, importId: string): Promise<void> {
  const suggestion = classifyPost({ body: post.body, source: post.source, postedAt: post.postedAt });
  await sql(
    `insert into posts (
      id, external_key, source, posted_at, posted_at_precision, body, content_hash, linkedin_url, shared_url,
      status, suggested_title, suggested_excerpt, suggested_post_type, suggested_primary_topic,
      suggestion_ambiguous, suggestion_note, post_type, primary_topic_slug, last_import_id
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      'draft',$10,$11,$12,$13,
      $14,$15,$16,$17,$18
    )`,
    [
      post.id,
      post.externalKey,
      post.source,
      post.postedAt,
      post.postedAtPrecision,
      post.body,
      post.contentHash,
      post.linkedinUrl,
      post.sharedUrl,
      suggestion.title,
      suggestion.excerpt,
      suggestion.postType,
      suggestion.primaryTopic,
      suggestion.ambiguous,
      suggestion.note,
      suggestion.postType,
      suggestion.primaryTopic,
      importId,
    ],
  );
  await replaceSuggestedTaxonomy(sql, post.id, suggestion.primaryTopic, suggestion.secondaryTopics, suggestion.tags);
}

async function updatePost(sql: Sql, existing: Existing, post: ParsedPost, importId: string): Promise<void> {
  const suggestion = classifyPost({ body: post.body, source: post.source, postedAt: post.postedAt });
  await sql(
    `update posts set
      posted_at = $2,
      posted_at_precision = $3,
      body = $4,
      content_hash = $5,
      linkedin_url = $6,
      shared_url = $7,
      suggested_title = $8,
      suggested_excerpt = $9,
      suggested_post_type = $10,
      suggested_primary_topic = $11,
      suggestion_ambiguous = $12,
      suggestion_note = $13,
      post_type = case when post_type_locked then post_type else $10 end,
      primary_topic_slug = case when primary_topic_locked then primary_topic_slug else $11 end,
      updated_at = now(),
      last_import_id = $14
    where id = $1`,
    [
      existing.id,
      post.postedAt,
      post.postedAtPrecision,
      post.body,
      post.contentHash,
      post.linkedinUrl,
      post.sharedUrl,
      suggestion.title,
      suggestion.excerpt,
      suggestion.postType,
      suggestion.primaryTopic,
      suggestion.ambiguous,
      suggestion.note,
      importId,
    ],
  );
  if (!existing.primary_topic_locked) {
    await replaceSuggestedTaxonomy(sql, existing.id, suggestion.primaryTopic, suggestion.secondaryTopics, suggestion.tags);
  }
}

async function replaceSuggestedTaxonomy(
  sql: Sql,
  postId: string,
  primary: string | null,
  secondary: string[],
  tags: string[],
): Promise<void> {
  await sql(`delete from post_topics where post_id = $1 and origin = 'suggested'`, [postId]);
  const editorialTopics = await sql<{ topic_slug: string }>(`select topic_slug from post_topics where post_id = $1`, [postId]);
  const taken = new Set(editorialTopics.map((row) => row.topic_slug));
  const relations = [
    ...(primary ? [{ slug: primary, relation: "primary" }] : []),
    ...secondary.map((slug) => ({ slug, relation: "secondary" })),
  ];
  for (const relation of relations) {
    if (taken.has(relation.slug)) continue;
    await sql(
      `insert into post_topics (post_id, topic_slug, relation, origin) values ($1, $2, $3, 'suggested') on conflict do nothing`,
      [postId, relation.slug, relation.relation],
    );
    taken.add(relation.slug);
  }
  const rejected = await sql<{ tag_slug: string }>(`select tag_slug from post_tag_rejections where post_id = $1`, [postId]);
  const rejectedSlugs = new Set(rejected.map((row) => row.tag_slug));
  await sql(`delete from post_tags where post_id = $1 and origin = 'suggested'`, [postId]);
  for (const tag of tags) {
    if (rejectedSlugs.has(tag)) continue;
    await sql(
      `insert into post_tags (post_id, tag_slug, origin) values ($1, $2, 'suggested') on conflict do nothing`,
      [postId, tag],
    );
  }
}

async function attachMedia(sql: Sql, postId: string, media: ParsedPost["media"]): Promise<void> {
  for (const item of media) {
    await sql(
      `insert into post_media (id, post_id, url, association, approved, durable, expires_at, alt_text)
       values ($1, $2, $3, $4, false, $5, $6, $7)
       on conflict (post_id, url) do nothing`,
      [randomUUID(), postId, item.url, item.association, item.durable, item.expiresAt, item.altText],
    );
  }
}

async function writeReview(sql: Sql, importId: string, items: AmbiguousRecord[]): Promise<void> {
  for (const item of items) {
    await sql(
      `insert into review_items (id, import_run_id, kind, external_key, reason, detail)
       select $1, $2, $3, $4, $5, $6
       where not exists (
         select 1 from review_items where external_key = $4 and reason = $5 and status = 'open'
       )`,
      [randomUUID(), importId, item.reason, item.externalKey, item.reason, JSON.stringify(item.detail)],
    );
  }
}

export async function refreshSuggestions(sql: Sql, ids?: string[]): Promise<number> {
  if (ids && ids.length === 0) return 0;
  const rows = await sql<{
    id: string;
    source: "shares" | "articles";
    body: string;
    posted_at: string | Date;
    primary_topic_locked: boolean;
  }>(
    ids && ids.length
      ? `select id, source, body, posted_at, primary_topic_locked from posts where id = any($1::text[])`
      : `select id, source, body, posted_at, primary_topic_locked from posts`,
    ids && ids.length ? [ids] : [],
  );
  for (const row of rows) {
    const postedAt = row.posted_at instanceof Date ? row.posted_at.toISOString() : String(row.posted_at);
    const suggestion = classifyPost({ body: row.body, source: row.source, postedAt });
    await sql(
      `update posts set
        suggested_title = $2,
        suggested_excerpt = $3,
        suggested_post_type = $4,
        suggested_primary_topic = $5,
        suggestion_ambiguous = $6,
        suggestion_note = $7,
        post_type = case when post_type_locked then post_type else $4 end,
        primary_topic_slug = case when primary_topic_locked then primary_topic_slug else $5 end,
        updated_at = now()
      where id = $1`,
      [row.id, suggestion.title, suggestion.excerpt, suggestion.postType, suggestion.primaryTopic, suggestion.ambiguous, suggestion.note],
    );
    if (!row.primary_topic_locked) {
      await replaceSuggestedTaxonomy(sql, row.id, suggestion.primaryTopic, suggestion.secondaryTopics, suggestion.tags);
    }
  }
  await rebuildSuggestedCollections(sql);
  return rows.length;
}

export async function rebuildSuggestedCollections(sql: Sql): Promise<void> {
  const locked = await sql<{ slug: string }>(`select slug from collections where curation_locked = true`);
  const lockedSlugs = new Set(locked.map((row) => row.slug));
  const posts = await sql<{
    id: string;
    primary_topic_slug: string | null;
    posted_at: string | Date;
    body: string;
  }>(`select id, primary_topic_slug, posted_at, body from posts`);
  const tags = await sql<{ post_id: string; tag_slug: string }>(`select post_id, tag_slug from post_tags`);
  const exclusions = await sql<{ collection_slug: string; post_id: string }>(`select collection_slug, post_id from collection_exclusions`);
  const excluded = new Set(exclusions.map((row) => `${row.collection_slug}:${row.post_id}`));
  const tagsByPost = new Map<string, string[]>();
  for (const tag of tags) {
    const list = tagsByPost.get(tag.post_id) ?? [];
    list.push(tag.tag_slug);
    tagsByPost.set(tag.post_id, list);
  }
  const candidates: CollectionCandidate[] = posts.map((post) => ({
    id: post.id,
    primaryTopic: post.primary_topic_slug,
    tags: tagsByPost.get(post.id) ?? [],
    bodyLength: post.body.length,
    postedAt: post.posted_at instanceof Date ? post.posted_at.toISOString() : String(post.posted_at),
  }));
  const picks = planCollections(candidates).filter((pick) => !lockedSlugs.has(pick.slug) && !excluded.has(`${pick.slug}:${pick.postId}`));
  const slugs = unique(picks.map((pick) => pick.slug)).filter((slug) => !lockedSlugs.has(slug));
  for (const slug of slugs) {
    await sql(`delete from collection_posts where collection_slug = $1 and origin = 'suggested'`, [slug]);
  }
  for (const pick of picks) {
    await sql(
      `insert into collection_posts (collection_slug, post_id, position, origin) values ($1, $2, $3, 'suggested')
       on conflict (collection_slug, post_id) do nothing`,
      [pick.slug, pick.postId, pick.position],
    );
  }
}

export function formatReport(report: ImportReport): string {
  const lines = [
    `Import ${report.mode}`,
    `Ignored other export files: ${report.ignoredFiles}`,
    `Created ${report.created}, updated ${report.updated}, unchanged ${report.unchanged}, skipped ${report.skipped}, ambiguous ${report.ambiguous}`,
    `Direct media rows considered: ${report.mediaAttached}. Ambiguous media matches: ${report.ambiguousMedia}.`,
    `Skip reasons: ${JSON.stringify(report.skippedReasons)}`,
    report.ambiguousKeys.length ? `Ambiguous keys: ${report.ambiguousKeys.join(", ")}` : "Ambiguous keys: none",
    "Files:",
  ];
  for (const file of report.files) {
    const range = file.dateRange ? `${file.dateRange.start} to ${file.dateRange.end}` : "no dates";
    const fields = Object.entries(file.fields)
      .map(([name, stat]) => `${name} nonempty ${stat.nonempty}/${file.records}`)
      .join("; ");
    lines.push(`- ${file.name}: ${file.records} records, columns ${file.columns.join(", ") || "(none)"}, ${range}`);
    if (fields) lines.push(`  ${fields}`);
    lines.push(`  ${file.note}`);
  }
  lines.push("Engagement metrics: none in the post files. Reactions and comments were not read.");
  lines.push("New and updated posts stay drafts. Existing publish status is left unchanged.");
  return lines.join("\n");
}

function publicStats(report: ImportReport): Record<string, unknown> {
  return {
    created: report.created,
    updated: report.updated,
    unchanged: report.unchanged,
    skipped: report.skipped,
    ambiguous: report.ambiguous,
    skippedReasons: report.skippedReasons,
    ambiguousKeys: report.ambiguousKeys,
    mediaAttached: report.mediaAttached,
    ambiguousMedia: report.ambiguousMedia,
    ignoredFiles: report.ignoredFiles,
    files: report.files.map((file) => ({
      name: file.name,
      records: file.records,
      columns: file.columns,
      dateRange: file.dateRange,
    })),
  };
}

function countReasons(reasons: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const reason of reasons) counts[reason] = (counts[reason] ?? 0) + 1;
  return counts;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
