import Link from "next/link";
import { getEditorLibrary } from "@/lib/queries";

export default async function AdminCollectionsPage() {
  const library = await getEditorLibrary();
  return (
    <>
      <h1>Collections</h1>
      <div className="post-list">
        {library.collections.map((collection) => (
          <article key={collection.slug} className="panel">
            <h2><Link href={`/admin/collections/${collection.slug}`}>{collection.title}</Link></h2>
            <p>{collection.description}</p>
            <p className="meta">{collection.postIds.length} posts · {collection.curationLocked ? "order locked" : "suggested order"}</p>
          </article>
        ))}
      </div>
    </>
  );
}
