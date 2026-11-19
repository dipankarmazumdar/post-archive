export type GraphSourcePost = {
  id: string;
  title: string;
  primaryTopic: string | null;
  topicSlugs: string[];
  tags: string[];
};

export type GraphSourceTopic = { slug: string; name: string };
export type GraphSourceTag = { slug: string; name: string };

export type GraphNode = {
  id: string;
  kind: "topic" | "tag" | "post";
  label: string;
  group: string;
  color: string;
  radius: number;
  href: string;
  x: number;
  y: number;
  mass: number;
  count: number;
};

export type GraphLink = {
  source: number;
  target: number;
  rest: number;
};

export type GraphLegendItem = { id: string; label: string; color: string; count: number };

export type KnowledgeGraph = {
  nodes: GraphNode[];
  links: GraphLink[];
  legend: GraphLegendItem[];
};

const TOPIC_COLORS = [
  "#c6f25a",
  "#7d8cff",
  "#d18bff",
  "#ff7eb6",
  "#3ee0b0",
  "#ffc857",
  "#7ad7ff",
  "#ff9b6a",
];

const OTHER = "other";
const OTHER_COLOR = "#9aa8b8";

export function topicColor(slug: string, index: number): string {
  if (slug === OTHER) return OTHER_COLOR;
  const known: Record<string, string> = {
    "apache-iceberg": "#c6f25a",
    "data-engineering": "#7d8cff",
    streaming: "#d18bff",
    "ai-agents": "#ff7eb6",
    "open-lakehouse": "#3ee0b0",
    "developer-tooling": "#ffc857",
  };
  return known[slug] ?? TOPIC_COLORS[index % TOPIC_COLORS.length] ?? OTHER_COLOR;
}

type Mutable = GraphNode & { vx: number; vy: number };

let cachedKey = "";
let cachedGraph: KnowledgeGraph | null = null;

export function buildKnowledgeGraph(
  posts: GraphSourcePost[],
  topics: GraphSourceTopic[],
  tags: GraphSourceTag[],
): KnowledgeGraph {
  const key = graphCacheKey(posts, topics, tags);
  if (cachedGraph && key === cachedKey) return cachedGraph;
  const graph = layoutKnowledgeGraph(posts, topics, tags);
  cachedKey = key;
  cachedGraph = graph;
  return graph;
}

function graphCacheKey(posts: GraphSourcePost[], topics: GraphSourceTopic[], tags: GraphSourceTag[]): string {
  let hash = 5381;
  const feed = (value: string) => {
    for (let index = 0; index < value.length; index += 1) hash = (Math.imul(hash, 33) ^ value.charCodeAt(index)) | 0;
  };
  for (const topic of topics) feed(`${topic.slug}:${topic.name}`);
  for (const tag of tags) feed(`${tag.slug}:${tag.name}`);
  for (const post of posts) feed(`${post.id}|${post.primaryTopic ?? ""}|${post.topicSlugs.join(",")}|${post.tags.join(",")}|${post.title}`);
  return (hash >>> 0).toString(16);
}

function layoutKnowledgeGraph(
  posts: GraphSourcePost[],
  topics: GraphSourceTopic[],
  tags: GraphSourceTag[],
): KnowledgeGraph {
  const tagName = new Map(tags.map((tag) => [tag.slug, tag.name]));
  const topicName = new Map(topics.map((topic) => [topic.slug, topic.name]));
  const tagUses = new Map<string, number>();
  const topicUses = new Map<string, number>();
  for (const post of posts) {
    const primary = post.primaryTopic && topicName.has(post.primaryTopic) ? post.primaryTopic : null;
    if (primary) topicUses.set(primary, (topicUses.get(primary) ?? 0) + 1);
    for (const tag of new Set(post.tags)) {
      if (!tagName.has(tag)) continue;
      tagUses.set(tag, (tagUses.get(tag) ?? 0) + 1);
    }
  }

  const activeTopics = topics.filter((topic) => (topicUses.get(topic.slug) ?? 0) > 0);
  const hasOther = posts.some((post) => !post.primaryTopic || !topicName.has(post.primaryTopic));
  const colorOf = new Map<string, string>();
  activeTopics.forEach((topic, index) => colorOf.set(topic.slug, topicColor(topic.slug, index)));
  colorOf.set(OTHER, OTHER_COLOR);

  const tagGroup = new Map<string, string>();
  for (const slug of tagUses.keys()) {
    const votes = new Map<string, number>();
    for (const post of posts) {
      if (!post.tags.includes(slug)) continue;
      const primary = post.primaryTopic && topicName.has(post.primaryTopic) ? post.primaryTopic : OTHER;
      votes.set(primary, (votes.get(primary) ?? 0) + 1);
    }
    let best = OTHER;
    let bestCount = -1;
    for (const [group, votesFor] of votes) {
      if (votesFor > bestCount) {
        best = group;
        bestCount = votesFor;
      }
    }
    tagGroup.set(slug, best);
  }

  const nodes: Mutable[] = [];
  const indexOf = new Map<string, number>();
  const add = (node: Omit<Mutable, "vx" | "vy" | "x" | "y"> & { x?: number; y?: number }): number => {
    const index = nodes.length;
    nodes.push({ ...node, x: node.x ?? 0, y: node.y ?? 0, vx: 0, vy: 0 });
    indexOf.set(node.id, index);
    return index;
  };

  for (const topic of activeTopics) {
    const count = topicUses.get(topic.slug) ?? 0;
    add({
      id: `topic:${topic.slug}`,
      kind: "topic",
      label: topic.name,
      group: topic.slug,
      color: colorOf.get(topic.slug) ?? OTHER_COLOR,
      radius: Math.min(34, 15 + Math.sqrt(count) * 0.7),
      href: `/topics/${topic.slug}`,
      mass: 14,
      count,
    });
  }
  if (hasOther) {
    const count = posts.filter((post) => !post.primaryTopic || !topicName.has(post.primaryTopic)).length;
    add({
      id: `topic:${OTHER}`,
      kind: "topic",
      label: "Other notes",
      group: OTHER,
      color: OTHER_COLOR,
      radius: Math.min(28, 14 + Math.sqrt(count) * 0.5),
      href: "/explore",
      mass: 14,
      count,
    });
  }

  const tagSlugs = [...tagUses.keys()].sort((a, b) => (tagUses.get(b) ?? 0) - (tagUses.get(a) ?? 0) || a.localeCompare(b));
  for (const slug of tagSlugs) {
    const count = tagUses.get(slug) ?? 0;
    const group = tagGroup.get(slug) ?? OTHER;
    add({
      id: `tag:${slug}`,
      kind: "tag",
      label: tagName.get(slug) ?? slug,
      group,
      color: colorOf.get(group) ?? OTHER_COLOR,
      radius: Math.min(16, 5.5 + Math.sqrt(count) * 0.85),
      href: `/explore?q=${encodeURIComponent(tagName.get(slug) ?? slug)}`,
      mass: 5,
      count,
    });
  }

  const postsByHome = new Map<number, number[]>();
  for (const post of posts) {
    const primary = post.primaryTopic && topicName.has(post.primaryTopic) ? post.primaryTopic : OTHER;
    const specific = [...new Set(post.tags.filter((tag) => tagUses.has(tag)))].sort(
      (a, b) => (tagUses.get(a) ?? 0) - (tagUses.get(b) ?? 0) || a.localeCompare(b),
    );
    const group = specific[0] ? (tagGroup.get(specific[0]) ?? primary) : primary;
    const index = add({
      id: `post:${post.id}`,
      kind: "post",
      label: post.title.trim() || "Untitled post",
      group,
      color: colorOf.get(group) ?? colorOf.get(primary) ?? OTHER_COLOR,
      radius: 2.7,
      href: `/posts/${encodeURIComponent(post.id)}`,
      mass: 1,
      count: 1,
    });
    const anchors = specific.slice(0, 4).map((tag) => indexOf.get(`tag:${tag}`)).filter((value): value is number => value !== undefined);
    const linked = anchors.length ? anchors : [indexOf.get(`topic:${primary}`)].filter((value): value is number => value !== undefined);
    const home = linked[0];
    if (home !== undefined) {
      const list = postsByHome.get(home) ?? [];
      list.push(index);
      postsByHome.set(home, list);
    }
  }

  place(nodes, postsByHome);

  const links: GraphLink[] = [];
  const seen = new Set<string>();
  const connect = (a: number, b: number, rest: number) => {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ source: a, target: b, rest });
  };

  for (const [anchor, group] of postsByHome) {
    for (const post of group) {
      const dx = nodes[post].x - nodes[anchor].x;
      const dy = nodes[post].y - nodes[anchor].y;
      connect(post, anchor, Math.max(nodes[anchor].radius + 16, Math.hypot(dx, dy)));
    }
  }
  for (const group of postsByHome.values()) {
    group.forEach((post, index) => {
      for (const next of [index + 1, index + 3]) {
        const other = group[next];
        if (other === undefined) continue;
        const ox = nodes[other].x - nodes[post].x;
        const oy = nodes[other].y - nodes[post].y;
        connect(post, other, Math.max(12, Math.hypot(ox, oy)));
      }
    });
  }

  for (const slug of tagSlugs) {
    const tagIndex = indexOf.get(`tag:${slug}`);
    const topicIndex = indexOf.get(`topic:${tagGroup.get(slug) ?? OTHER}`);
    if (tagIndex === undefined || topicIndex === undefined) continue;
    const dx = nodes[tagIndex].x - nodes[topicIndex].x;
    const dy = nodes[tagIndex].y - nodes[topicIndex].y;
    connect(tagIndex, topicIndex, Math.max(90, Math.hypot(dx, dy)));
  }

  const partners = new Map<string, { slug: string; count: number }[]>();
  const bump = (a: string, b: string, count: number) => {
    const list = partners.get(a) ?? [];
    list.push({ slug: b, count });
    partners.set(a, list);
  };
  const pairCount = new Map<string, number>();
  for (const post of posts) {
    const unique = [...new Set(post.tags.filter((tag) => tagUses.has(tag)))].sort();
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        const key = `${unique[i]}\0${unique[j]}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, count] of pairCount) {
    if (count < 2) continue;
    const [left, right] = key.split("\0");
    if (!left || !right) continue;
    bump(left, right, count);
    bump(right, left, count);
  }
  const linkedPairs = new Set<string>();
  for (const [slug, list] of partners) {
    list.sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
    for (const partner of list.slice(0, 3)) {
      const key = [slug, partner.slug].sort().join("\0");
      if (linkedPairs.has(key)) continue;
      linkedPairs.add(key);
      const a = indexOf.get(`tag:${slug}`);
      const b = indexOf.get(`tag:${partner.slug}`);
      if (a === undefined || b === undefined) continue;
      const same = nodes[a].group === nodes[b].group;
      connect(a, b, same ? 110 : 300);
    }
  }

  const topicPairs = new Map<string, number>();
  for (const post of posts) {
    const slugs = [...new Set(post.topicSlugs.filter((slug) => topicName.has(slug)))].sort();
    for (let i = 0; i < slugs.length; i += 1) {
      for (let j = i + 1; j < slugs.length; j += 1) {
        const key = `${slugs[i]}\0${slugs[j]}`;
        topicPairs.set(key, (topicPairs.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, count] of topicPairs) {
    if (count < 2) continue;
    const [left, right] = key.split("\0");
    if (!left || !right) continue;
    const a = indexOf.get(`topic:${left}`);
    const b = indexOf.get(`topic:${right}`);
    if (a === undefined || b === undefined) continue;
    connect(a, b, 520);
  }

  for (let iteration = 0; iteration < 140; iteration += 1) stepGraph(nodes, links);

  const legend: GraphLegendItem[] = [];
  for (const topic of activeTopics) {
    const id = `topic:${topic.slug}`;
    const node = nodes[indexOf.get(id) ?? -1];
    if (!node) continue;
    legend.push({ id, label: node.label, color: node.color, count: node.count });
  }
  const other = nodes[indexOf.get(`topic:${OTHER}`) ?? -1];
  if (other) legend.push({ id: other.id, label: other.label, color: other.color, count: other.count });

  return {
    nodes: nodes.map(({ vx: _vx, vy: _vy, ...node }) => node),
    links,
    legend,
  };
}

function place(nodes: Mutable[], postsByHome: Map<number, number[]>): void {
  const topics = nodes.filter((node) => node.kind === "topic");
  const orbit = Math.max(420, topics.length * 120);
  topics.forEach((topic, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(topics.length, 1)) * Math.PI * 2;
    topic.x = Math.cos(angle) * orbit;
    topic.y = Math.sin(angle) * orbit;
  });

  const tags = nodes.filter((node) => node.kind === "tag");
  const tagsByGroup = new Map<string, Mutable[]>();
  for (const tag of tags) {
    const list = tagsByGroup.get(tag.group) ?? [];
    list.push(tag);
    tagsByGroup.set(tag.group, list);
  }
  for (const topic of topics) {
    const group = tagsByGroup.get(topic.group) ?? [];
    const outward = Math.atan2(topic.y, topic.x);
    group.forEach((tag, index) => {
      const spread = (index - (group.length - 1) / 2) * 0.62;
      const distance = 130 + (index % 3) * 42;
      tag.x = topic.x + Math.cos(outward + spread) * distance;
      tag.y = topic.y + Math.sin(outward + spread) * distance;
    });
  }

  for (const [anchor, group] of postsByHome) {
    const origin = nodes[anchor];
    if (!origin) continue;
    group.forEach((post, slot) => {
      const angle = slot * 2.399963229728653;
      const distance = origin.radius + 20 + Math.sqrt(slot) * 9;
      nodes[post].x = origin.x + Math.cos(angle) * distance;
      nodes[post].y = origin.y + Math.sin(angle) * distance;
    });
  }

  for (const node of nodes) {
    if (node.kind === "post" && node.x === 0 && node.y === 0) {
      node.x = (nodes.length % 17) * 8;
      node.y = (nodes.length % 13) * 8;
    }
  }
}

export function stepGraph(nodes: Mutable[], links: GraphLink[]): void {
  const cell = 72;
  const buckets = new Map<string, number[]>();
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const key = `${Math.floor(node.x / cell)}:${Math.floor(node.y / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(index);
    else buckets.set(key, [index]);
  }

  const repel = (left: number, right: number) => {
    const a = nodes[left];
    const b = nodes[right];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.01) {
      dx = (left - right) * 0.01 || 0.01;
      dy = 0.02;
      dist = Math.hypot(dx, dy);
    }
    const min = a.radius + b.radius + (a.kind === "post" && b.kind === "post" ? 2.2 : 8);
    if (dist < min) {
      const push = ((min - dist) / dist) * 0.45;
      const shareA = b.mass / (a.mass + b.mass);
      const shareB = a.mass / (a.mass + b.mass);
      a.x -= dx * push * shareA;
      a.y -= dy * push * shareA;
      b.x += dx * push * shareB;
      b.y += dy * push * shareB;
      return;
    }
    if (a.kind === "post" && b.kind === "post") return;
    if (dist > 160) return;
    const force = 140 / (dist * dist);
    a.vx -= (dx / dist) * force / a.mass;
    a.vy -= (dy / dist) * force / a.mass;
    b.vx += (dx / dist) * force / b.mass;
    b.vy += (dy / dist) * force / b.mass;
  };

  for (const [key, bucket] of buckets) {
    const [cx, cy] = key.split(":").map(Number);
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) repel(bucket[i], bucket[j]);
    }
    for (const [nx, ny] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ] as const) {
      const neighbor = buckets.get(`${cx + nx}:${cy + ny}`);
      if (!neighbor) continue;
      for (const left of bucket) {
        for (const right of neighbor) repel(left, right);
      }
    }
  }

  for (const link of links) {
    const a = nodes[link.source];
    const b = nodes[link.target];
    if (!a || !b) continue;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.01) {
      dx = 0.01;
      dy = 0;
      dist = 0.01;
    }
    const force = ((dist - link.rest) / dist) * 0.045;
    a.vx += dx * force / a.mass;
    a.vy += dy * force / a.mass;
    b.vx -= dx * force / b.mass;
    b.vy -= dy * force / b.mass;
  }

  for (const node of nodes) {
    node.vx += -node.x * 0.0008;
    node.vy += -node.y * 0.0008;
    node.vx *= 0.7;
    node.vy *= 0.7;
    node.x += node.vx;
    node.y += node.vy;
  }
}
