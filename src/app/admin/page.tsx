import Link from "next/link";
import { sql } from "@/lib/db";
import { getEditorLibrary } from "@/lib/queries";

export default async function AdminHome() {
  const library = await getEditorLibrary();
  const counts = {
    draft: library.posts.filter((post) => post.status === "draft").length,
    published: library.posts.filter((post) => post.status === "published").length,
    hidden: library.posts.filter((post) => post.status === "hidden").length,
    ambiguous: library.posts.filter((post) => post.suggestionAmbiguous).length,
  };
  const runs = await sql<{ id: string; status: string; started_at: string | Date; stats: string }>(
    `select id, status, started_at, stats from import_runs order by started_at desc limit 5`,
  );
  const openReview = await sql<{ count: string }>(`select count(*)::text as count from review_items where status = 'open'`);
  return (
    <>
      <h1>Editor</h1>
      <div className="card-grid">
        <div className="panel"><p className="meta">Drafts</p><h2>{counts.draft}</h2></div>
        <div className="panel"><p className="meta">Published</p><h2>{counts.published}</h2></div>
        <div className="panel"><p className="meta">Hidden</p><h2>{counts.hidden}</h2></div>
        <div className="panel"><p className="meta">Ambiguous suggestions</p><h2>{counts.ambiguous}</h2></div>
      </div>
      <p><Link href="/admin/review">Open review items: {openReview[0]?.count ?? "0"}</Link></p>
      <h2>Recent imports</h2>
      {runs.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Status</th><th>Counts</th></tr></thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.started_at).toISOString()}</td>
                  <td>{run.status}</td>
                  <td><code>{run.stats}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No imports have been applied on this database yet. Use the CLI locally, then publish posts here.</p>
      )}
    </>
  );
}
