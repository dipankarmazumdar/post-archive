import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/chrome";
import { getPublishedLibrary, publicPosts } from "@/lib/queries";
import { SITE_DESCRIPTION } from "@/lib/site";

export default async function HomePage() {
  const library = await getPublishedLibrary();
  const posts = publicPosts(library);
  const byId = new Map(posts.map((post) => [post.id, post]));
  const startHere = library.startHere
    .map((item) => byId.get(item.postId))
    .filter((post): post is NonNullable<typeof post> => Boolean(post))
    .slice(0, 4);
  const recent = posts.slice(0, 6);
  return (
    <>
      <section className="hero">
        <p className="kicker">Dipankar Mazumdar</p>
        <h1>Post Archive</h1>
        <p className="dek">{SITE_DESCRIPTION}</p>
        <form className="hero-search" action="/explore" method="get" role="search">
          <label className="sr-only" htmlFor="home-q">Search posts</label>
          <input id="home-q" name="q" type="search" placeholder="Puffin, Flink, MCP…" />
          <button type="submit">Search</button>
        </form>
      </section>

      <section className="section" aria-labelledby="start-here">
        <h2 id="start-here">Start here</h2>
        {startHere.length ? (
          <div className="card-grid">
            {startHere.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        ) : (
          <EmptyState title="Starting points are still being chosen">
            <p>Published posts will appear here once a reading path is curated. The topics below are ready to browse.</p>
          </EmptyState>
        )}
      </section>

      <section className="section" aria-labelledby="topics">
        <h2 id="topics">Topics to explore</h2>
        <div className="topic-grid">
          {library.topics.map((topic) => (
            <Link key={topic.slug} className="topic-card" href={`/topics/${topic.slug}`}>
              <p className="meta">{topic.publishedCount} published</p>
              <h3>{topic.name}</h3>
              <p>{topic.description}</p>
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
              <Link key={collection.slug} className="topic-card" href={`/collections/${collection.slug}`}>
                <p className="meta">{published ? `${published} published` : "In progress"}</p>
                <h3>{collection.title}</h3>
                <p>{collection.description}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
