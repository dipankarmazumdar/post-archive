import { renderFeed } from "@/lib/feed";
import { getPublishedLibrary, publicPosts } from "@/lib/queries";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const posts = publicPosts(await getPublishedLibrary());
  const xml = renderFeed(posts, siteUrl());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
