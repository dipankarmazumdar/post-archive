export const SITE_NAME = "Dipankar Mazumdar — Post Archive";
export const SITE_DESCRIPTION =
  "A reading archive of Dipankar Mazumdar’s writing on Apache Iceberg, the open lakehouse, streaming, AI agents, and developer tooling.";

export function siteUrl(): string {
  const raw = process.env.SITE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export const PAGE_SIZE = 20;

export const POST_TYPES = [
  { slug: "technical-deep-dive", label: "Technical deep dive" },
  { slug: "project-update", label: "Project update" },
  { slug: "talk-or-event", label: "Talk or event" },
  { slug: "commentary", label: "Commentary" },
  { slug: "repost", label: "Repost" },
  { slug: "article", label: "Article" },
] as const;

export type PostTypeSlug = (typeof POST_TYPES)[number]["slug"];

export function postTypeLabel(slug: string | null | undefined): string {
  return POST_TYPES.find((type) => type.slug === slug)?.label ?? "Note";
}

export const PUBLIC_POST_KEYS = [
  "id",
  "title",
  "excerpt",
  "body",
  "postType",
  "postTypeLabel",
  "postedAt",
  "postedAtPrecision",
  "linkedinUrl",
  "sharedUrl",
  "primaryTopic",
  "topics",
  "tags",
  "media",
  "year",
] as const;
