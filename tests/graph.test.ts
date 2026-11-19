import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph } from "../src/lib/graph";

const topics = [
  { slug: "apache-iceberg", name: "Apache Iceberg" },
  { slug: "streaming", name: "Streaming" },
];
const tags = [
  { slug: "puffin", name: "Puffin" },
  { slug: "statistics", name: "Statistics" },
  { slug: "flink", name: "Flink" },
];

describe("knowledge graph", () => {
  it("clusters posts around the tag or topic they belong to", () => {
    const graph = buildKnowledgeGraph(
      [
        { id: "p1", title: "Puffin stats", primaryTopic: "apache-iceberg", topicSlugs: ["apache-iceberg"], tags: ["puffin", "statistics"] },
        { id: "p2", title: "More puffin", primaryTopic: "apache-iceberg", topicSlugs: ["apache-iceberg"], tags: ["puffin"] },
        { id: "p3", title: "Flink cdc", primaryTopic: "streaming", topicSlugs: ["streaming", "apache-iceberg"], tags: ["flink"] },
        { id: "p4", title: "A note", primaryTopic: null, topicSlugs: [], tags: [] },
      ],
      topics,
      tags,
    );
    const byId = new Map(graph.nodes.map((node, index) => [node.id, index]));
    const linked = (a: string, b: string) => {
      const left = byId.get(a);
      const right = byId.get(b);
      return graph.links.some((link) => (link.source === left && link.target === right) || (link.source === right && link.target === left));
    };
    expect(byId.has("topic:apache-iceberg")).toBe(true);
    expect(byId.has("topic:other")).toBe(true);
    expect(linked("tag:statistics", "topic:apache-iceberg")).toBe(true);
    expect(linked("tag:puffin", "topic:apache-iceberg")).toBe(true);
    expect(linked("tag:flink", "topic:streaming")).toBe(true);
    expect(linked("post:p1", "tag:statistics")).toBe(true);
    expect(linked("post:p3", "tag:flink")).toBe(true);
    expect(linked("post:p4", "topic:other")).toBe(true);
    expect(graph.nodes.every((node) => node.href.startsWith("/") && Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
    expect(new Set(graph.nodes.map((node) => Math.round(node.x / 20))).size).toBeGreaterThan(3);
    expect(Math.max(...graph.nodes.map((node) => Math.abs(node.x)))).toBeLessThan(4000);
  });

  it("lays out a few hundred posts quickly enough to render a page", () => {
    const posts = Array.from({ length: 400 }, (_, index) => ({
      id: `s${index}`,
      title: `Post ${index}`,
      primaryTopic: index % 3 === 0 ? "streaming" : "apache-iceberg",
      topicSlugs: index % 5 === 0 ? ["streaming", "apache-iceberg"] : [index % 3 === 0 ? "streaming" : "apache-iceberg"],
      tags: index % 2 === 0 ? ["puffin"] : index % 3 === 0 ? ["flink"] : [],
    }));
    const started = Date.now();
    const graph = buildKnowledgeGraph(posts, topics, tags);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(graph.nodes.filter((node) => node.kind === "post")).toHaveLength(400);
    expect(graph.legend.map((item) => item.label)).toContain("Apache Iceberg");
  });
});
