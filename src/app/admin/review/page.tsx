import { dismissReview } from "../actions";
import { sql } from "@/lib/db";

export default async function ReviewPage() {
  const items = await sql<{ id: string; kind: string; external_key: string | null; reason: string; detail: string; created_at: string | Date }>(
    `select id, kind, external_key, reason, detail, created_at from review_items where status = 'open' order by created_at desc limit 100`,
  );
  const ambiguous = await sql<{ id: string; suggestion_note: string | null }>(
    `select id, suggestion_note from posts where suggestion_ambiguous = true and status <> 'published' order by posted_at desc limit 30`,
  );
  return (
    <>
      <h1>Review</h1>
      <h2>Import questions</h2>
      {items.length ? items.map((item) => (
        <article key={item.id} className="panel" style={{ marginBottom: "0.7rem" }}>
          <p className="meta">{item.reason} · {item.external_key}</p>
          <pre>{item.detail}</pre>
          <form action={dismissReview}>
            <input type="hidden" name="id" value={item.id} />
            <button className="secondary" type="submit">Dismiss</button>
          </form>
        </article>
      )) : <p>No open import questions.</p>}
      <h2>Ambiguous suggestions</h2>
      {ambiguous.length ? (
        <ul>
          {ambiguous.map((post) => (
            <li key={post.id}><a href={`/admin/posts/${post.id}`}>{post.id}</a> — {post.suggestion_note}</li>
          ))}
        </ul>
      ) : <p>No posts are flagged.</p>}
    </>
  );
}
