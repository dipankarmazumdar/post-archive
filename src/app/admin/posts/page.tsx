import Link from "next/link";
import { draftPosts, hidePosts, publishPosts } from "../actions";
import { displayTitle, displayType } from "@/lib/library";
import { getEditorLibrary } from "@/lib/queries";
import { postTypeLabel } from "@/lib/site";
import { editorSearchDocs } from "@/lib/queries";
import { searchDocuments } from "@/lib/search";

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "draft";
  const q = typeof params.q === "string" ? params.q : "";
  const library = await getEditorLibrary();
  let posts = library.posts.filter((post) => status === "all" || post.status === status);
  if (q.trim()) {
    const hits = new Set(searchDocuments(editorSearchDocs(posts, library.collections), q).map((hit) => hit.id));
    posts = posts.filter((post) => hits.has(post.id));
  }
  const pagePosts = posts.slice(0, 50);
  return (
    <>
      <h1>Posts</h1>
      <form className="filters" action="/admin/posts" method="get">
        <div>
          <label htmlFor="q">Search drafts and published posts</label>
          <input id="q" name="q" defaultValue={q} />
        </div>
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status}>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
            <option value="all">All</option>
          </select>
        </div>
        <button type="submit">Filter</button>
      </form>
      <p className="meta">{posts.length} posts. Showing {pagePosts.length}. This search includes unpublished posts and is not on the public site.</p>
      <form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Title</th>
                <th>Status</th>
                <th>Type</th>
                <th>Topic</th>
              </tr>
            </thead>
            <tbody>
              {pagePosts.map((post) => (
                <tr key={post.id}>
                  <td><input type="checkbox" name="ids" value={post.id} aria-label={`Select ${displayTitle(post)}`} /></td>
                  <td><Link href={`/admin/posts/${post.id}`}>{displayTitle(post)}</Link>{post.suggestionAmbiguous ? " · review" : ""}</td>
                  <td className={`status ${post.status}`}>{post.status}</td>
                  <td>{postTypeLabel(displayType(post))}</td>
                  <td>{post.primaryTopicSlug ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stack" style={{ marginTop: "0.8rem" }}>
          <button formAction={publishPosts}>Publish selected</button>
          <button className="secondary" formAction={hidePosts}>Hide selected</button>
          <button className="secondary" formAction={draftPosts}>Return to draft</button>
        </div>
      </form>
    </>
  );
}
