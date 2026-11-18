import { saveTopicMeta } from "../actions";
import { getEditorLibrary } from "@/lib/queries";

export default async function AdminTopicsPage() {
  const library = await getEditorLibrary();
  return (
    <>
      <h1>Topics</h1>
      {library.topics.map((topic) => {
        const starts = library.topicStarts.filter((item) => item.topicSlug === topic.slug).map((item) => item.postId).join("\n");
        return (
          <form key={topic.slug} className="form-grid panel" action={saveTopicMeta} style={{ marginBottom: "1rem" }}>
            <h2>{topic.name}</h2>
            <input type="hidden" name="slug" value={topic.slug} />
            <label htmlFor={`d-${topic.slug}`}>Description</label>
            <textarea id={`d-${topic.slug}`} name="description" defaultValue={topic.description} />
            <label htmlFor={`s-${topic.slug}`}>Starting-point post ids, in order</label>
            <textarea id={`s-${topic.slug}`} name="starts" defaultValue={starts} />
            <button type="submit">Save topic</button>
          </form>
        );
      })}
    </>
  );
}
