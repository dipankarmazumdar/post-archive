import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/feed";
import { getPublishedLibrary, publicPosts } from "@/lib/queries";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const library = await getPublishedLibrary();
  return sitemapEntries(publicPosts(library), library.topics, library.collections, siteUrl());
}
