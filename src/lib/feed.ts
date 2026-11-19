import { xmlEscape } from "./format";
import type { PublicPost } from "./public";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";

export function renderFeed(posts: PublicPost[], origin: string): string {
  const items = [...posts].sort((a, b) => b.postedAt.localeCompare(a.postedAt)).slice(0, 50);
  const body = items
    .map((post) => {
      const link = `${origin}/posts/${post.id}`;
      return `<item>
<title>${xmlEscape(post.title)}</title>
<link>${xmlEscape(link)}</link>
<guid>${xmlEscape(link)}</guid>
<pubDate>${xmlEscape(new Date(post.postedAt).toUTCString())}</pubDate>
<description>${xmlEscape(post.excerpt)}</description>
</item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${xmlEscape(SITE_NAME)}</title>
<link>${xmlEscape(origin)}</link>
<description>${xmlEscape(SITE_DESCRIPTION)}</description>
${body}
</channel>
</rss>`;
}

export function sitemapEntries(posts: PublicPost[], topics: { slug: string }[], collections: { slug: string }[], origin: string) {
  const now = new Date();
  const staticPaths = ["", "/explore", "/topics", "/graph", "/collections"];
  return [
    ...staticPaths.map((path) => ({ url: `${origin}${path || "/"}`, lastModified: now })),
    ...topics.map((topic) => ({ url: `${origin}/topics/${topic.slug}`, lastModified: now })),
    ...collections.map((collection) => ({ url: `${origin}/collections/${collection.slug}`, lastModified: now })),
    ...posts.map((post) => ({ url: `${origin}/posts/${post.id}`, lastModified: new Date(post.postedAt) })),
  ];
}
