import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/chrome";
import { exploreHref, parseExploreParams, runExplore } from "@/lib/explore";
import { getPublishedLibrary, publicPosts, searchDocsFromPublic } from "@/lib/queries";
import { POST_TYPES } from "@/lib/site";
import { sql } from "@/lib/db";
import { ALIAS_GROUPS } from "@/lib/search";

export const metadata: Metadata = { title: "Explore", alternates: { canonical: "/explore" } };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseExploreParams(await searchParams);
  const library = await getPublishedLibrary();
  const posts = publicPosts(library);
  const aliases = await sql<{ alias: string; tag_slug: string }>(`select alias, tag_slug from tag_aliases`);
  const groups = [...ALIAS_GROUPS, ...aliases.map((row) => [row.alias, row.tag_slug.replace(/-/g, " ")])];
  const shown = runExplore(searchDocsFromPublic(posts, library.collections), params, groups);
  const docs = new Map(posts.map((post) => [post.id, post]));
  const years = [...new Set(posts.map((post) => String(post.year)))].sort((a, b) => b.localeCompare(a));
  return (
    <>
      <h1>Explore</h1>
      <form className="filters" action="/explore" method="get">
        <div>
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={params.q} placeholder="Quoted phrases work" />
        </div>
        <div>
          <label htmlFor="topic">Topic</label>
          <select id="topic" name="topic" defaultValue={params.topic}>
            <option value="">Any topic</option>
            {library.topics.map((topic) => <option key={topic.slug} value={topic.slug}>{topic.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="year">Year</label>
          <select id="year" name="year" defaultValue={params.year}>
            <option value="">Any year</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="type">Post type</label>
          <select id="type" name="type" defaultValue={params.type}>
            <option value="">Any type</option>
            {POST_TYPES.map((type) => <option key={type.slug} value={type.slug}>{type.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sort">Sort</label>
          <select id="sort" name="sort" defaultValue={params.q ? params.sort : params.sort === "relevance" ? "newest" : params.sort}>
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
        <button type="submit">Apply</button>
      </form>
      <p className="meta">{shown.total} published {shown.total === 1 ? "post" : "posts"}{params.q ? ` for “${params.q}”` : ""}</p>
      {shown.total === 0 ? (
        <EmptyState title={params.q ? "No matches" : "Nothing in this view"}>
          <p>
            {params.q
              ? "Nothing published matches that query. Drafts and hidden posts are excluded. Try a shorter phrase, or clear a filter."
              : "No published posts match these filters yet."}
          </p>
          <p><Link href="/explore">Clear filters</Link></p>
        </EmptyState>
      ) : (
        <div className="post-list">
          {shown.hits.map((hit) => {
            const post = docs.get(hit.doc.id);
            if (!post) return null;
            return <PostCard key={post.id} post={post} snippet={params.q ? hit.snippet : null} />;
          })}
        </div>
      )}
      <nav className="pager" aria-label="Pagination">
        {shown.page > 1 ? <Link href={exploreHref(params, { page: shown.page - 1 })}>Previous</Link> : <span />}
        <span>Page {shown.page} of {shown.pages}</span>
        {shown.page < shown.pages ? <Link href={exploreHref(params, { page: shown.page + 1 })}>Next</Link> : <span />}
      </nav>
    </>
  );
}
