import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/chrome";
import { getPublishedLibrary, publicPosts } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const library = await getPublishedLibrary();
  const collection = library.collections.find((item) => item.slug === slug);
  if (!collection) return { title: "Collection" };
  return {
    title: collection.title,
    description: collection.description,
    alternates: { canonical: `/collections/${collection.slug}` },
    openGraph: { title: collection.title, description: collection.description },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const library = await getPublishedLibrary();
  const collection = library.collections.find((item) => item.slug === slug);
  if (!collection) notFound();
  const byId = new Map(publicPosts(library).map((post) => [post.id, post]));
  const posts = collection.postIds.map((id) => byId.get(id)).filter((post): post is NonNullable<typeof post> => Boolean(post));
  return (
    <article>
      <h1>{collection.title}</h1>
      <p className="dek">{collection.description}</p>
      {posts.length ? (
        <ol className="post-list">
          {posts.map((post, index) => (
            <li key={post.id}>
              <p className="meta">Part {index + 1}</p>
              <PostCard post={post} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="This path has no published posts yet">
          <p>The reading order exists in the editor. Posts appear here after they are published.</p>
        </EmptyState>
      )}
    </article>
  );
}
