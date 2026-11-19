import type { Metadata } from "next";
import { EmptyState } from "@/components/chrome";
import { KnowledgeGraphView } from "@/components/knowledge-graph";
import { buildKnowledgeGraph } from "@/lib/graph";
import { getPublishedLibrary, publicPosts } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Knowledge graph",
  description: "Topics, tags, and posts from the archive, clustered by how they connect.",
  alternates: { canonical: "/graph" },
};

export default async function GraphPage() {
  const library = await getPublishedLibrary();
  const posts = publicPosts(library);
  const graph = buildKnowledgeGraph(
    posts.map((post) => ({
      id: post.id,
      title: post.title,
      primaryTopic: post.primaryTopic?.slug ?? null,
      topicSlugs: post.topics.map((topic) => topic.slug),
      tags: post.tags.map((tag) => tag.slug),
    })),
    library.topics.map((topic) => ({ slug: topic.slug, name: topic.name })),
    library.tags.map((tag) => ({ slug: tag.slug, name: tag.name })),
  );
  if (!graph.nodes.length) {
    return (
      <EmptyState title="Nothing to map yet">
        <p>The graph appears once posts are published.</p>
      </EmptyState>
    );
  }
  return (
    <div className="graph-page">
      <KnowledgeGraphView graph={graph} />
    </div>
  );
}
