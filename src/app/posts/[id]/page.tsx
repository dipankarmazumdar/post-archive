import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/post-body";
import { formatPosted } from "@/lib/format";
import { getPublishedLibrary, publicPosts, searchDocsFromPublic } from "@/lib/queries";
import { relatedReading } from "@/lib/recommend";
import { sql } from "@/lib/db";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const library = await getPublishedLibrary();
  const post = publicPosts(library).find((item) => item.id === id);
  if (!post) return { title: "Post" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/posts/${post.id}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: `/posts/${post.id}`,
      publishedTime: post.postedAt,
      images: post.media[0] ? [{ url: post.media[0].url, alt: post.media[0].alt }] : undefined,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const library = await getPublishedLibrary();
  const posts = publicPosts(library);
  const post = posts.find((item) => item.id === id);
  if (!post) notFound();
  const docs = searchDocsFromPublic(posts, library.collections);
  const current = docs.find((doc) => doc.id === post.id);
  const overrides = await sql<{ post_id: string; related_post_id: string; pinned: boolean; removed: boolean }>(
    `select post_id, related_post_id, pinned, removed from recommendation_overrides where post_id = $1`,
    [post.id],
  );
  const related = current
    ? relatedReading(
        current,
        docs,
        overrides.map((row) => ({ postId: row.post_id, relatedPostId: row.related_post_id, pinned: row.pinned, removed: row.removed })),
      )
    : [];
  const byId = new Map(posts.map((item) => [item.id, item]));
  const collection = library.collections.find((item) => item.postIds.includes(post.id));
  const publishedOrder = collection?.postIds.map((postId) => byId.get(postId)).filter((item): item is NonNullable<typeof item> => Boolean(item)) ?? [];
  const index = publishedOrder.findIndex((item) => item.id === post.id);
  const previous = index > 0 ? publishedOrder[index - 1] : null;
  const next = index >= 0 && index < publishedOrder.length - 1 ? publishedOrder[index + 1] : null;
  return (
    <article className="reading">
      <p className="meta">{formatPosted(post.postedAt, post.postedAtPrecision)} · {post.postTypeLabel}</p>
      <h1>{post.title}</h1>
      <div className="pills">
        {post.topics.map((topic) => (
          <Link key={topic.slug} className="pill" href={`/topics/${topic.slug}`}>{topic.name}{topic.relation === "secondary" ? " · also" : ""}</Link>
        ))}
        {post.tags.map((tag) => (
          <Link key={tag.slug} className="pill" href={`/explore?q=${encodeURIComponent(tag.name)}`}>{tag.name}</Link>
        ))}
      </div>
      {post.media.map((item) => (
        <figure key={item.url} className="figure">
          <img src={item.url} alt={item.alt} />
          <figcaption>{item.alt}</figcaption>
        </figure>
      ))}
      <PostBody text={post.body} />
      <p>
        {post.linkedinUrl ? <a href={post.linkedinUrl} rel="noreferrer noopener">View on LinkedIn</a> : "No original LinkedIn link was included for this post."}
        {post.sharedUrl ? <> · <a href={post.sharedUrl} rel="noreferrer noopener">Link in this post</a></> : null}
      </p>
      {collection && (previous || next) ? (
        <nav className="section neighbors" aria-label="Reading path">
          <h2>Continue in {collection.title}</h2>
          {previous ? <p>Previous: <Link href={`/posts/${previous.id}`}>{previous.title}</Link></p> : null}
          {next ? <p>Next: <Link href={`/posts/${next.id}`}>{next.title}</Link></p> : null}
        </nav>
      ) : null}
      {related.length ? (
        <section className="section related">
          <h2>Related reading</h2>
          {related.map((item) => {
            const match = byId.get(item.id);
            if (!match) return null;
            return (
              <article key={item.id}>
                <p className="meta">{item.reason}</p>
                <h3><Link href={`/posts/${match.id}`}>{match.title}</Link></h3>
                <p className="excerpt">{match.excerpt}</p>
              </article>
            );
          })}
        </section>
      ) : null}
    </article>
  );
}
