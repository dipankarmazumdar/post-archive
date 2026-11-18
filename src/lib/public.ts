import { utcYear } from "./format";
import { postTypeLabel, PUBLIC_POST_KEYS } from "./site";
import type { LibraryPost } from "./library";
import { displayExcerpt, displayTitle, displayType, effectiveTopics } from "./library";
import { parseLinkedInPermalink, safeHttpUrl } from "./urls";

export type PublicPost = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  postType: string;
  postTypeLabel: string;
  postedAt: string;
  postedAtPrecision: "minute" | "day";
  linkedinUrl: string | null;
  sharedUrl: string | null;
  primaryTopic: { slug: string; name: string } | null;
  topics: { slug: string; name: string; relation: "primary" | "secondary" }[];
  tags: { slug: string; name: string }[];
  media: { url: string; alt: string }[];
  year: number;
};

export function toPublicPost(post: LibraryPost, now = new Date()): PublicPost | null {
  if (post.status !== "published") return null;
  const topics = effectiveTopics(post);
  const primary = topics.find((topic) => topic.relation === "primary") ?? null;
  const linkedin = publicLinkedInUrl(post.linkedinUrl);
  const shared = safeHttpUrl(post.sharedUrl);
  return {
    id: post.id,
    title: displayTitle(post),
    excerpt: displayExcerpt(post),
    body: post.body,
    postType: displayType(post),
    postTypeLabel: postTypeLabel(displayType(post)),
    postedAt: post.postedAt,
    postedAtPrecision: post.postedAtPrecision,
    linkedinUrl: linkedin,
    sharedUrl: shared,
    primaryTopic: primary ? { slug: primary.slug, name: primary.name } : null,
    topics: topics.map((topic) => ({ slug: topic.slug, name: topic.name, relation: topic.relation })),
    tags: post.tags.map((tag) => ({ slug: tag.slug, name: tag.name })),
    media: post.media
      .filter((item) => item.approved)
      .map((item) => {
        const url = safeHttpUrl(item.url);
        if (!url) return null;
        if (item.expiresAt && new Date(item.expiresAt).getTime() <= now.getTime()) return null;
        return { url, alt: item.altText && item.altText.length <= 140 ? item.altText : "Image from the original post" };
      })
      .filter((item): item is { url: string; alt: string } => Boolean(item)),
    year: utcYear(post.postedAt),
  };
}

export function assertPublicShape(post: PublicPost): void {
  const keys = Object.keys(post).sort();
  const expected = [...PUBLIC_POST_KEYS].sort();
  if (keys.join() !== expected.join()) {
    throw new Error("Public post exposed an unexpected field");
  }
}

function publicLinkedInUrl(value: string | null): string | null {
  if (!value) return null;
  const feed = parseLinkedInPermalink(value);
  if (feed) return feed.url;
  const safe = safeHttpUrl(value);
  if (!safe) return null;
  try {
    const url = new URL(safe);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "www.linkedin.com") return null;
    if (!/^\/pulse\/[a-z0-9-]+$/.test(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
