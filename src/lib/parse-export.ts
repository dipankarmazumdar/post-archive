import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { articleToText } from "./html-text";
import { articlePermalink, isDurableMediaUrl, mediaExpiry, parseLinkedInPermalink, safeHttpUrl } from "./urls";

export type ParsedMedia = {
  url: string;
  association: "direct" | "inferred";
  durable: boolean;
  expiresAt: string | null;
  altText: string | null;
};

export type ParsedPost = {
  id: string;
  externalKey: string;
  source: "shares" | "articles";
  postedAt: string;
  postedAtPrecision: "minute" | "day";
  body: string;
  contentHash: string;
  linkedinUrl: string | null;
  sharedUrl: string | null;
  media: ParsedMedia[];
};

export type SkippedRecord = { externalKey: string | null; reason: string };
export type AmbiguousRecord = { externalKey: string; reason: string; detail: Record<string, unknown> };

export type FileInventory = {
  name: string;
  columns: string[];
  records: number;
  dateRange: { start: string; end: string } | null;
  fields: Record<string, { nonempty: number; maxLength: number }>;
  note: string;
};

export type ParsedExport = {
  inventory: FileInventory[];
  posts: ParsedPost[];
  skipped: SkippedRecord[];
  ambiguous: AmbiguousRecord[];
  richMedia: { postedOn: string | null; description: string; url: string | null }[];
  ignoredFiles: number;
};

const SHARE_COLUMNS = ["Date", "ShareLink", "ShareCommentary", "SharedUrl", "MediaUrl", "Visibility"];

export function contentHash(body: string, sharedUrl: string | null, postedAt: string): string {
  return createHash("sha256").update(JSON.stringify({ body, sharedUrl, postedAt })).digest("hex");
}

export function parseExport(entries: { name: string; text: string }[], ignoredFiles: number): ParsedExport {
  const inventory: FileInventory[] = [];
  const skipped: SkippedRecord[] = [];
  const ambiguous: AmbiguousRecord[] = [];
  const posts: ParsedPost[] = [];
  let richMedia: ParsedExport["richMedia"] = [];

  for (const entry of entries) {
    if (entry.name === "Shares.csv") {
      const rows = readCsv(entry.name, entry.text);
      inventory.push(inventoryFor(entry.name, rows, "Date", "Authored posts and shares. No per-post engagement counts are present."));
      posts.push(...parseShares(rows, skipped, ambiguous));
    } else if (entry.name === "InstantReposts.csv") {
      const rows = readCsv(entry.name, entry.text);
      inventory.push(
        inventoryFor(
          entry.name,
          rows,
          "Date",
          "Instant reposts have a date and a link, and no commentary field. They are not imported.",
        ),
      );
      skipped.push({ externalKey: null, reason: "instant_repost_without_commentary" });
    } else if (entry.name === "Rich_Media.csv") {
      const rows = readCsv(entry.name, entry.text);
      inventory.push(
        inventoryFor(
          entry.name,
          rows,
          "Date/Time",
          "Photo upload descriptions. LinkedIn CDN links are signed and expire. They are not public unless a post match is approved.",
        ),
      );
      richMedia = rows.map((row) => ({
        postedOn: mediaDay(row["Date/Time"] ?? ""),
        description: row["Media Description"] ?? "",
        url: safeHttpUrl(row["Media Link"] ?? ""),
      }));
    } else if (entry.name.endsWith(".html")) {
      const article = parseArticle(entry.name, entry.text, skipped);
      inventory.push({
        name: entry.name,
        columns: ["html"],
        records: article ? 1 : 0,
        dateRange: article ? { start: article.postedAt.slice(0, 10), end: article.postedAt.slice(0, 10) } : null,
        fields: {},
        note: "LinkedIn article HTML. Images stay unapproved.",
      });
      if (article) posts.push(article);
    }
  }

  const deduped = dedupePosts(posts, skipped, ambiguous);
  return { inventory, posts: deduped, skipped, ambiguous, richMedia, ignoredFiles };
}

function parseShares(rows: Record<string, string>[], skipped: SkippedRecord[], ambiguous: AmbiguousRecord[]): ParsedPost[] {
  const missing = SHARE_COLUMNS.filter((column) => rows.length > 0 && !(column in rows[0]!));
  if (rows.length > 0 && missing.length > 0) {
    skipped.push({ externalKey: null, reason: "unexpected_share_columns" });
  }
  const posts: ParsedPost[] = [];
  for (const row of rows) {
    const link = parseLinkedInPermalink(row.ShareLink ?? "");
    if (!link) {
      skipped.push({ externalKey: null, reason: "untrustworthy_permalink" });
      ambiguous.push({
        externalKey: "unknown",
        reason: "untrustworthy_permalink",
        detail: { date: row.Date ?? "", linkLength: (row.ShareLink ?? "").length },
      });
      continue;
    }
    const postedAt = parseTimestamp(row.Date ?? "");
    if (!postedAt) {
      skipped.push({ externalKey: link.urn, reason: "missing_date" });
      continue;
    }
    const body = unwrapShareCommentary(normalizeBody(row.ShareCommentary ?? ""));
    const sharedUrl = safeHttpUrl(row.SharedUrl ?? "");
    const mediaUrl = safeHttpUrl(row.MediaUrl ?? "");
    const media: ParsedMedia[] = [];
    if (mediaUrl) {
      media.push({
        url: mediaUrl,
        association: "direct",
        durable: isDurableMediaUrl(mediaUrl),
        expiresAt: mediaExpiry(mediaUrl),
        altText: null,
      });
    }
    posts.push({
      id: link.id,
      externalKey: link.urn,
      source: "shares",
      postedAt,
      postedAtPrecision: "minute",
      body,
      contentHash: contentHash(body, sharedUrl, postedAt),
      linkedinUrl: link.url,
      sharedUrl,
      media,
    });
  }
  return posts;
}

function parseArticle(name: string, html: string, skipped: SkippedRecord[]): ParsedPost | null {
  const base = name.split("/").pop() ?? name;
  if (!/^[a-z0-9-]+\.html$/.test(base)) {
    skipped.push({ externalKey: name, reason: "unsafe_article_name" });
    return null;
  }
  const text = articleToText(html);
  const permalink = articlePermalink(base, text.hrefs);
  const date = text.dates[0];
  if (!date) {
    skipped.push({ externalKey: base, reason: "missing_date" });
    return null;
  }
  const id = `article-${base.replace(/\.html$/, "")}`;
  const body = text.body;
  const postedAt = `${date}T00:00:00.000Z`;
  return {
    id,
    externalKey: `article:${base}`,
    source: "articles",
    postedAt,
    postedAtPrecision: "day",
    body,
    contentHash: contentHash(body, null, postedAt),
    linkedinUrl: permalink,
    sharedUrl: null,
    media: text.images.map((url) => ({
      url,
      association: "direct" as const,
      durable: isDurableMediaUrl(url),
      expiresAt: mediaExpiry(url),
      altText: null,
    })),
  };
}

function dedupePosts(posts: ParsedPost[], skipped: SkippedRecord[], ambiguous: AmbiguousRecord[]): ParsedPost[] {
  const grouped = new Map<string, ParsedPost[]>();
  for (const post of posts) {
    const list = grouped.get(post.externalKey) ?? [];
    list.push(post);
    grouped.set(post.externalKey, list);
  }
  const ready: ParsedPost[] = [];
  for (const [key, group] of grouped) {
    const hashes = new Set(group.map((post) => post.contentHash));
    if (hashes.size > 1) {
      ambiguous.push({
        externalKey: key,
        reason: "conflicting_duplicate",
        detail: {
          count: group.length,
          lengths: group.map((post) => post.body.length),
          dates: group.map((post) => post.postedAt),
        },
      });
      skipped.push({ externalKey: key, reason: "ambiguous_duplicate" });
      continue;
    }
    const merged = group[0]!;
    const media = new Map<string, ParsedMedia>();
    for (const post of group) {
      for (const item of post.media) media.set(item.url, item);
      if (!merged.sharedUrl && post.sharedUrl) merged.sharedUrl = post.sharedUrl;
    }
    merged.media = [...media.values()];
    if (group.length > 1) skipped.push({ externalKey: key, reason: "duplicate_row" });
    ready.push(merged);
  }
  return ready;
}

export function matchRichMedia(
  posts: { id: string; postedAt: string; body: string }[],
  media: ParsedExport["richMedia"],
): { matches: { postId: string; url: string; altText: string | null }[]; ambiguous: AmbiguousRecord[] } {
  const matches: { postId: string; url: string; altText: string | null }[] = [];
  const ambiguous: AmbiguousRecord[] = [];
  for (const item of media) {
    const description = item.description.trim();
    if (!item.url || !item.postedOn || description.length < 40) continue;
    const prefix = collapse(description).slice(0, 80);
    const hits = posts.filter((post) => post.postedAt.slice(0, 10) === item.postedOn && collapse(post.body).includes(prefix));
    if (hits.length === 1) {
      matches.push({
        postId: hits[0]!.id,
        url: item.url,
        altText: description.length <= 140 ? description : null,
      });
    } else if (hits.length > 1) {
      ambiguous.push({
        externalKey: hits.map((hit) => hit.id).join(","),
        reason: "ambiguous_media",
        detail: { postIds: hits.map((hit) => hit.id), day: item.postedOn, urlHost: hostOf(item.url) },
      });
    }
  }
  return { matches, ambiguous };
}

function readCsv(name: string, text: string): Record<string, string>[] {
  try {
    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as Record<string, string | undefined>[];
    return rows.map((row) => {
      const clean: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) clean[key] = value ?? "";
      return clean;
    });
  } catch {
    throw new Error(`Could not parse ${name}`);
  }
}

function inventoryFor(name: string, rows: Record<string, string>[], dateColumn: string, note: string): FileInventory {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const fields: FileInventory["fields"] = {};
  const dates: string[] = [];
  for (const column of columns) {
    let nonempty = 0;
    let maxLength = 0;
    for (const row of rows) {
      const value = row[column] ?? "";
      if (value.trim()) {
        nonempty += 1;
        maxLength = Math.max(maxLength, value.length);
      }
    }
    fields[column] = { nonempty, maxLength };
  }
  for (const row of rows) {
    const raw = row[dateColumn] ?? "";
    const instant = parseTimestamp(raw);
    const day = mediaDay(raw);
    if (instant) dates.push(instant.slice(0, 10));
    else if (day) dates.push(day);
  }
  dates.sort();
  return {
    name,
    columns,
    records: rows.length,
    dateRange: dates.length ? { start: dates[0]!, end: dates[dates.length - 1]! } : null,
    fields,
    note,
  };
}

export function parseTimestamp(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return iso;
}

function mediaDay(value: string): string | null {
  const match = /\bon ([A-Za-z]+) (\d{1,2}), (\d{4})\b/.exec(value);
  if (!match) return null;
  const month = MONTHS[match[1] ?? ""];
  if (!month) return null;
  const day = Number(match[2]).toString().padStart(2, "0");
  return `${match[3]}-${month}-${day}`;
}

const MONTHS: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

export function normalizeBody(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

// This export wraps each commentary line in quotes, then places that text in a CSV
// field. After a normal CSV parse, the first line is missing its opening quote, blank
// lines are the two-character string "", and the field sometimes ends on a lone quote.
// Real quotation marks inside a line stay. Plain posts are left as they are.
export function unwrapShareCommentary(value: string): string {
  if (!value) return value;
  let lines = value.split("\n");
  const droppedCloser = lines[lines.length - 1] === '"';
  if (droppedCloser) lines = lines.slice(0, -1);
  const contentIndexes = lines.flatMap((line, index) => (line === '""' ? [] : [index]));
  if (!contentIndexes.length) return value;
  const first = contentIndexes[0] ?? 0;
  const last = contentIndexes[contentIndexes.length - 1] ?? first;
  const wrapped = (line: string) => line.length >= 2 && line.startsWith('"') && line.endsWith('"');
  const firstLine = lines[first] ?? "";
  const lastLine = lines[last] ?? "";
  const middles = contentIndexes.slice(1, -1).map((index) => lines[index] ?? "");
  const firstOk = wrapped(firstLine) || (firstLine.endsWith('"') && !firstLine.startsWith('"'));
  const lastOk = wrapped(lastLine) || (lastLine.startsWith('"') && !lastLine.endsWith('"'));
  const middlesOk = middles.every((line) => wrapped(line));
  const hasBlank = lines.some((line) => line === '""');
  const multiline = contentIndexes.length > 1 || hasBlank;
  if (!(firstOk && lastOk && middlesOk && multiline)) {
    if (droppedCloser && contentIndexes.length === 1 && firstLine.endsWith('"')) {
      return firstLine.slice(0, -1).trim();
    }
    return value;
  }
  const unwrapped = lines.map((line, index) => {
    if (line === '""') return "";
    if (index === first && !wrapped(line) && line.endsWith('"')) return line.slice(0, -1).trim();
    if (index === last && line.startsWith('"') && !line.endsWith('"')) return line.slice(1).trim();
    if (wrapped(line)) return line.slice(1, -1).trim();
    return line.trim();
  });
  return unwrapped.join("\n").replace(/^\n+|\n+$/g, "");
}

function collapse(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
