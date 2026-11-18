import { mergeTagAction } from "../actions";
import { sql } from "@/lib/db";

export default async function TagsPage() {
  const tags = await sql<{ slug: string; name: string; count: string }>(
    `select t.slug, t.name, count(pt.post_id)::text as count
     from tags t left join post_tags pt on pt.tag_slug = t.slug
     group by t.slug, t.name order by t.name`,
  );
  return (
    <>
      <h1>Tags</h1>
      <p>Merging moves every post from one tag onto another and keeps the old name as a search alias.</p>
      <form className="filters" action={mergeTagAction}>
        <div>
          <label htmlFor="from">Merge</label>
          <select id="from" name="from">{tags.map((tag) => <option key={tag.slug} value={tag.slug}>{tag.name}</option>)}</select>
        </div>
        <div>
          <label htmlFor="into">Into</label>
          <select id="into" name="into">{tags.map((tag) => <option key={tag.slug} value={tag.slug}>{tag.name}</option>)}</select>
        </div>
        <button type="submit">Merge tags</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Tag</th><th>Posts</th></tr></thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.slug}><td>{tag.name}</td><td>{tag.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
