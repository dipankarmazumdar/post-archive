import { notFound } from "next/navigation";
import { moveInCollection, saveCollectionMeta } from "../../actions";
import { displayTitle } from "@/lib/library";
import { getEditorLibrary } from "@/lib/queries";

export default async function AdminCollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const library = await getEditorLibrary();
  const collection = library.collections.find((item) => item.slug === slug);
  if (!collection) notFound();
  const byId = new Map(library.posts.map((post) => [post.id, post]));
  return (
    <>
      <h1>{collection.title}</h1>
      <form className="form-grid" action={saveCollectionMeta}>
        <input type="hidden" name="slug" value={collection.slug} />
        <label htmlFor="title">Title</label>
        <input id="title" name="title" defaultValue={collection.title} />
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={collection.description} />
        <button type="submit">Save description</button>
      </form>
      <ol className="section">
        {collection.postIds.map((id) => {
          const post = byId.get(id);
          if (!post) return null;
          return (
            <li key={id} className="stack">
              <span className={`status ${post.status}`}>{post.status}</span>
              <a href={`/admin/posts/${post.id}`}>{displayTitle(post)}</a>
              <form action={moveInCollection}>
                <input type="hidden" name="slug" value={collection.slug} />
                <input type="hidden" name="id" value={post.id} />
                <button className="secondary" name="direction" value="up">Up</button>
                <button className="secondary" name="direction" value="down">Down</button>
              </form>
            </li>
          );
        })}
      </ol>
    </>
  );
}
