import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/post-body";
import { recommendAction, savePost, setStatusOne, unlockField } from "../../actions";
import { displayExcerpt, displayTitle, displayType, effectiveTopics } from "@/lib/library";
import { editorSearchDocs, getEditorLibrary } from "@/lib/queries";
import { relatedReading } from "@/lib/recommend";
import { POST_TYPES } from "@/lib/site";
import { sql } from "@/lib/db";
import { formatPosted } from "@/lib/format";

export default async function AdminPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const library = await getEditorLibrary();
  const post = library.posts.find((item) => item.id === id);
  if (!post) notFound();
  const topics = effectiveTopics(post);
  const primary = post.primaryTopicSlug ?? topics.find((topic) => topic.relation === "primary")?.slug ?? "";
  const docs = editorSearchDocs(library.posts.filter((item) => item.status === "published"), library.collections);
  const current = editorSearchDocs([post], library.collections)[0];
  const overrides = await sql<{ post_id: string; related_post_id: string; pinned: boolean; removed: boolean }>(
    `select post_id, related_post_id, pinned, removed from recommendation_overrides where post_id = $1`,
    [post.id],
  );
  const related = current
    ? relatedReading(current, docs, overrides.map((row) => ({
        postId: row.post_id,
        relatedPostId: row.related_post_id,
        pinned: row.pinned,
        removed: row.removed,
      })))
    : [];
  return (
    <>
      <p className="kicker">Draft preview · not public unless published</p>
      <h1>{displayTitle(post)}</h1>
      <p className={`status ${post.status}`}>{post.status}</p>
      <p className="meta">{formatPosted(post.postedAt, post.postedAtPrecision)} · {post.externalKey}</p>
      {post.suggestionAmbiguous ? <p className="banner">{post.suggestionNote ?? "This suggestion needs review."}</p> : null}
      <div className="stack">
        <form action={setStatusOne}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="status" value="published" /><button>Publish</button></form>
        <form action={setStatusOne}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="status" value="hidden" /><button className="secondary">Hide</button></form>
        <form action={setStatusOne}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="status" value="draft" /><button className="secondary">Draft</button></form>
        {post.status === "published" ? <Link href={`/posts/${post.id}`}>Open public page</Link> : null}
      </div>
      <form className="form-grid section" action={savePost}>
        <input type="hidden" name="id" value={post.id} />
        <label htmlFor="title">Editorial title</label>
        <input id="title" name="title" defaultValue={displayTitle(post)} />
        <p className="meta">Suggested: {post.suggestedTitle}</p>
        <label htmlFor="excerpt">Editorial excerpt</label>
        <textarea id="excerpt" name="excerpt" defaultValue={displayExcerpt(post)} />
        <label htmlFor="postType">Post type</label>
        <select id="postType" name="postType" defaultValue={displayType(post)}>
          {POST_TYPES.map((type) => <option key={type.slug} value={type.slug}>{type.label}</option>)}
        </select>
        <label htmlFor="primaryTopic">Primary topic</label>
        <select id="primaryTopic" name="primaryTopic" defaultValue={primary}>
          <option value="">None</option>
          {library.topics.map((topic) => <option key={topic.slug} value={topic.slug}>{topic.name}</option>)}
        </select>
        <fieldset>
          <legend>Secondary topics</legend>
          <div className="checks">
            {library.topics.map((topic) => (
              <label key={topic.slug}>
                <input type="checkbox" name="secondary" value={topic.slug} defaultChecked={topics.some((item) => item.slug === topic.slug && item.relation === "secondary")} />
                {topic.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Tags</legend>
          <div className="checks">
            {library.tags.map((tag) => (
              <label key={tag.slug}>
                <input type="checkbox" name="tags" value={tag.slug} defaultChecked={post.tags.some((item) => item.slug === tag.slug)} />
                {tag.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Collections</legend>
          <div className="checks">
            {library.collections.map((collection) => (
              <label key={collection.slug}>
                <input type="checkbox" name="collections" value={collection.slug} defaultChecked={post.collectionSlugs.includes(collection.slug)} />
                {collection.title}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Media</legend>
          {post.media.length ? post.media.map((item) => (
            <label key={item.id} className="stack">
              <input type="checkbox" name="media" value={item.id} defaultChecked={item.approved} />
              <span>{item.approved ? "Approved" : "Unapproved"} · {item.durable ? "durable host" : "LinkedIn CDN, may expire"} · {item.association}</span>
            </label>
          )) : <p>No media was attached from the export.</p>}
        </fieldset>
        <button type="submit">Save edits</button>
      </form>
      <div className="stack">
        <form action={unlockField}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="field" value="title" /><button className="secondary" type="submit">Use suggested title</button></form>
        <form action={unlockField}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="field" value="excerpt" /><button className="secondary" type="submit">Use suggested excerpt</button></form>
        <form action={unlockField}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="field" value="topic" /><button className="secondary" type="submit">Use suggested topic</button></form>
      </div>
      <section className="section">
        <h2>Original text</h2>
        <PostBody text={post.body} />
        {post.linkedinUrl ? <p><a href={post.linkedinUrl} rel="noreferrer noopener">LinkedIn permalink from the export</a></p> : <p>No trustworthy LinkedIn permalink was stored.</p>}
      </section>
      <section className="section">
        <h2>Recommendations</h2>
        {related.length ? related.map((item) => (
          <form key={item.id} action={recommendAction} className="stack">
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="relatedId" value={item.id} />
            <span>{item.reason} · {item.id}</span>
            <button className="secondary" name="mode" value="remove">Remove</button>
            <button className="secondary" name="mode" value="pin">Pin</button>
          </form>
        )) : <p>No strong published matches. The section stays hidden on the public page.</p>}
        <form action={recommendAction} className="stack">
          <input type="hidden" name="id" value={post.id} />
          <label htmlFor="relatedId">Pin by post id</label>
          <input id="relatedId" name="relatedId" />
          <button name="mode" value="pin">Pin</button>
        </form>
      </section>
    </>
  );
}
