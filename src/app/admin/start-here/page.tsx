import { saveStartHereAction } from "../actions";
import { displayTitle } from "@/lib/library";
import { getEditorLibrary } from "@/lib/queries";

export default async function StartHerePage() {
  const library = await getEditorLibrary();
  const order = library.startHere.map((item) => item.postId).join("\n");
  const notes = new Map(library.startHere.map((item) => [item.postId, item.note]));
  const candidates = [...library.posts].sort((a, b) => b.body.length - a.body.length).slice(0, 12);
  return (
    <>
      <h1>Start here</h1>
      <p>Only published posts in this list appear on the home page. Paste post ids in reading order.</p>
      <h2>Candidates</h2>
      <ul>
        {candidates.map((post) => (
          <li key={post.id}><code>{post.id}</code> · {displayTitle(post)} · {post.status}</li>
        ))}
      </ul>
      <form className="form-grid" action={saveStartHereAction}>
        <label htmlFor="order">Post ids</label>
        <textarea id="order" name="order" defaultValue={order} />
        {library.startHere.map((item) => (
          <label key={item.postId}>
            Note for {item.postId}
            <input name={`note-${item.postId}`} defaultValue={notes.get(item.postId) ?? ""} />
          </label>
        ))}
        <button type="submit">Save start here</button>
      </form>
    </>
  );
}
