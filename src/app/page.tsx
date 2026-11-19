import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/chrome";
import { sql } from "@/lib/db";
import { getPublishedLibrary, publicPosts, searchDocsFromPublic } from "@/lib/queries";
import { ALIAS_GROUPS, searchDocuments } from "@/lib/search";
import { SITE_DESCRIPTION } from "@/lib/site";

const RESULT_COUNT = 6;

const TOPIC_IMAGES: Record<string, string> = {
  "apache-iceberg": "/images/topic-iceberg.jpg",
  "open-lakehouse": "/images/topic-lakehouse.jpg",
  "data-engineering": "/images/topic-engineering.jpg",
  streaming: "/images/topic-streaming.jpg",
  "ai-agents": "/images/topic-agents.jpg",
  "developer-tooling": "/images/topic-tooling.jpg",
};

const COLLECTION_IMAGES: Record<string, string> = {
  "iceberg-internals": "/images/topic-iceberg.jpg",
  "lakehouse-fast": "/images/topic-lakehouse.jpg",
  "ai-agents": "/images/topic-agents.jpg",
  "streaming-lakehouse": "/images/topic-streaming.jpg",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawQuery = (await searchParams).q;
  const q = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "").trim().slice(0, 200);
  const library = await getPublishedLibrary();
  const posts = publicPosts(library);
  const byId = new Map(posts.map((post) => [post.id, post]));
  const aliases = await sql<{ alias: string; tag_slug: string }>(`select alias, tag_slug from tag_aliases`);
  const groups = [...ALIAS_GROUPS, ...aliases.map((row) => [row.alias, row.tag_slug.replace(/-/g, " ")])];
  const hits = q
    ? searchDocuments(searchDocsFromPublic(posts, library.collections), q, groups).slice(0, RESULT_COUNT)
    : [];
  const recent = posts.slice(0, 6);
  return (
    <>
      <section className="hero with-photo">
        <div>
          <h1>Post Archive</h1>
          <p className="dek">{SITE_DESCRIPTION}</p>
          <form className="hero-search" action="/" method="get" role="search">
            <label className="sr-only" htmlFor="home-q">Search posts</label>
            <input id="home-q" name="q" type="search" defaultValue={q} placeholder="Puffin, Flink, MCP…" />
            <button type="submit">Search</button>
          </form>
        </div>
        <img className="hero-photo" src="/images/hero-ice.jpg" alt="" />
      </section>

      {q ? (
        <section className="section" aria-labelledby="matches">
          <h2 id="matches">Closest posts for “{q}”</h2>
          {hits.length ? (
            <div className="post-list">
              {hits.map((hit) => {
                const post = byId.get(hit.id);
                if (!post) return null;
                return <PostCard key={post.id} post={post} snippet={hit.snippet} />;
              })}
            </div>
          ) : (
            <EmptyState title="No matching posts">
              <p>Nothing published matches that search. Try a shorter phrase, such as Puffin, Flink, or MCP.</p>
            </EmptyState>
          )}
          <p className="meta"><Link href={`/explore?q=${encodeURIComponent(q)}&sort=relevance`}>See every match</Link></p>
        </section>
      ) : null}

      <section className="section" aria-labelledby="topics">
        <h2 id="topics">Topics to explore</h2>
        <p className="meta"><Link href="/graph">See how these subjects connect</Link></p>
        <div className="topic-grid">
          {library.topics.map((topic) => (
            <Link key={topic.slug} className="topic-card picture-card" href={`/topics/${topic.slug}`}>
              {TOPIC_IMAGES[topic.slug] ? <img src={TOPIC_IMAGES[topic.slug]} alt="" /> : null}
              <span className="card-copy">
                <p className="meta">{topic.publishedCount} published</p>
                <h3>{topic.name}</h3>
                <p>{topic.description}</p>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="recent">
        <h2 id="recent">Recent posts</h2>
        {recent.length ? (
          <div className="post-list">
            {recent.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        ) : (
          <EmptyState title="No posts published yet">
            <p>Imports stay private until they are approved in the editor. The public archive updates as soon as a post is published.</p>
          </EmptyState>
        )}
      </section>

      <section className="section" aria-labelledby="paths">
        <h2 id="paths">Reading paths</h2>
        <div className="card-grid">
          {library.collections.map((collection) => {
            const published = collection.postIds.filter((id) => byId.has(id)).length;
            return (
              <Link key={collection.slug} className="topic-card picture-card" href={`/collections/${collection.slug}`}>
                {COLLECTION_IMAGES[collection.slug] ? <img src={COLLECTION_IMAGES[collection.slug]} alt="" /> : null}
                <span className="card-copy">
                  <p className="meta">{published ? `${published} published` : "In progress"}</p>
                  <h3>{collection.title}</h3>
                  <p>{collection.description}</p>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
