import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/chrome";
import { getPublishedLibrary, publicPosts } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const library = await getPublishedLibrary();
  const topic = library.topics.find((item) => item.slug === slug);
  if (!topic) return { title: "Topic" };
  return { title: topic.name, description: topic.description, alternates: { canonical: `/topics/${topic.slug}` }, openGraph: { title: topic.name, description: topic.description } };
}

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const pageRaw = (await searchParams).page;
  const requested = Math.max(1, Number.parseInt(typeof pageRaw === "string" ? pageRaw : "1", 10) || 1);
  const library = await getPublishedLibrary();
  const topic = library.topics.find((item) => item.slug === slug);
  if (!topic) notFound();
  const posts = publicPosts(library).filter((post) => post.topics.some((item) => item.slug === topic.slug));
  const byId = new Map(posts.map((post) => [post.id, post]));
  const starts = library.topicStarts
    .filter((item) => item.topicSlug === topic.slug)
    .map((item) => byId.get(item.postId))
    .filter((post): post is NonNullable<typeof post> => Boolean(post));
  return (
    <article>
      <h1>{topic.name}</h1>
      <p className="dek">{topic.description}</p>
      <p><Link href={`/explore?topic=${topic.slug}`}>Open this topic in Explore</Link></p>
      <section className="section">
        <h2>Starting points</h2>
        {starts.length ? (
          <div className="card-grid">{starts.map((post) => <PostCard key={post.id} post={post} />)}</div>
        ) : (
          <EmptyState title="No curated starting points yet">
            <p>Every published post on this topic is listed below. A shorter path can be pinned from the editor.</p>
          </EmptyState>
        )}
      </section>
      <section className="section">
        <h2>All published posts</h2>
        {posts.length ? (
          <>
            <div className="post-list">{posts.slice((Math.min(requested, Math.ceil(posts.length / 20)) - 1) * 20, Math.min(requested, Math.ceil(posts.length / 20)) * 20).map((post) => <PostCard key={post.id} post={post} />)}</div>
            <nav className="pager" aria-label="Pagination">
              {requested > 1 ? <Link href={`/topics/${topic.slug}?page=${requested - 1}`}>Previous</Link> : <span />}
              <span>Page {Math.min(requested, Math.ceil(posts.length / 20))} of {Math.ceil(posts.length / 20)}</span>
              {requested < Math.ceil(posts.length / 20) ? <Link href={`/topics/${topic.slug}?page=${requested + 1}`}>Next</Link> : <span />}
            </nav>
          </>
        ) : (
          <EmptyState title="No published posts on this topic">
            <p>Drafts stay in the editor until they are approved.</p>
          </EmptyState>
        )}
      </section>
    </article>
  );
}
