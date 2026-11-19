import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedLibrary, publicPosts } from "@/lib/queries";

export const metadata: Metadata = { title: "Collections", alternates: { canonical: "/collections" } };

export default async function CollectionsPage() {
  const library = await getPublishedLibrary();
  const published = new Set(publicPosts(library).map((post) => post.id));
  return (
    <>
      <h1>Collections</h1>
      <p className="dek">Short paths through the archive. The order is explicit, and unpublished posts stay off the path.</p>
      <div className="card-grid">
        {library.collections.map((collection) => {
          const count = collection.postIds.filter((id) => published.has(id)).length;
          return (
            <Link key={collection.slug} className="topic-card" href={`/collections/${collection.slug}`}>
              <p className="meta">{count ? `${count} published` : "In progress"}</p>
              <h3>{collection.title}</h3>
              <p>{collection.description}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
