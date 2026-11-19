import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedLibrary } from "@/lib/queries";

export const metadata: Metadata = { title: "Topics", alternates: { canonical: "/topics" } };

export default async function TopicsPage() {
  const library = await getPublishedLibrary();
  return (
    <>
      <h1>Topics</h1>
      <p className="dek">Broad subjects for browsing. Specific concepts such as Puffin, deletion vectors, and REST Catalog are tags on the posts themselves.</p>
      <div className="topic-grid">
        {library.topics.map((topic) => (
          <Link key={topic.slug} className="topic-card" href={`/topics/${topic.slug}`}>
            <p className="meta">{topic.publishedCount} published</p>
            <h3>{topic.name}</h3>
            <p>{topic.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
