import type { PostTypeSlug } from "./site";

export type TopicScore = { slug: string; score: number };

export type Classification = {
  primaryTopic: string | null;
  secondaryTopics: string[];
  tags: string[];
  postType: PostTypeSlug;
  ambiguous: boolean;
  note: string | null;
  title: string;
  excerpt: string;
};

type Term = { pattern: RegExp; weight: number };

const TOPICS: { slug: string; terms: Term[] }[] = [
  {
    slug: "apache-iceberg",
    terms: [
      { pattern: /\bpyiceberg\b/i, weight: 6 },
      { pattern: /\bpuffin\b/i, weight: 6 },
      { pattern: /\bdeletion vectors?\b/i, weight: 6 },
      { pattern: /\brest catalog\b/i, weight: 5 },
      { pattern: /\biceberg\b/i, weight: 4 },
      { pattern: /\bmanifests?\b/i, weight: 2 },
      { pattern: /\bsnapshots?\b/i, weight: 1 },
    ],
  },
  {
    slug: "streaming",
    terms: [
      { pattern: /\bflink\b/i, weight: 5 },
      { pattern: /\bkafka\b/i, weight: 4 },
      { pattern: /\bchange data capture\b|\bcdc\b/i, weight: 4 },
      { pattern: /\bcheckpoint(?:ing|s)?\b/i, weight: 3 },
      { pattern: /\bstreaming\b/i, weight: 2 },
      { pattern: /\bdebezium\b/i, weight: 4 },
    ],
  },
  {
    slug: "ai-agents",
    terms: [
      { pattern: /\bmodel context protocol\b|\bmcp\b/i, weight: 6 },
      { pattern: /\bagents?\b/i, weight: 5 },
      { pattern: /\btool calling\b/i, weight: 4 },
      { pattern: /\bllm\b/i, weight: 3 },
    ],
  },
  {
    slug: "developer-tooling",
    terms: [
      { pattern: /\bdeveloper experience\b/i, weight: 4 },
      { pattern: /\bsdk\b/i, weight: 4 },
      { pattern: /\bcli\b/i, weight: 2 },
      { pattern: /\bapi design\b/i, weight: 3 },
    ],
  },
  {
    slug: "open-lakehouse",
    terms: [
      { pattern: /\bhudi\b/i, weight: 4 },
      { pattern: /\bdelta lake\b/i, weight: 4 },
      { pattern: /\blakehouse\b/i, weight: 3 },
      { pattern: /\bopen table\b/i, weight: 3 },
    ],
  },
  {
    slug: "data-engineering",
    terms: [
      { pattern: /\btrino\b/i, weight: 4 },
      { pattern: /\bduckdb\b/i, weight: 4 },
      { pattern: /\bspark\b/i, weight: 3 },
      { pattern: /\bparquet\b/i, weight: 2 },
      { pattern: /\bdbt\b/i, weight: 3 },
      { pattern: /\bdatafusion\b/i, weight: 3 },
    ],
  },
];

const SPECIFICITY = TOPICS.map((topic) => topic.slug);

const TAG_RULES: { slug: string; pattern: RegExp }[] = [
  { slug: "puffin", pattern: /\bpuffin\b/i },
  { slug: "deletion-vectors", pattern: /\bdeletion vectors?\b/i },
  { slug: "rest-catalog", pattern: /\brest catalog\b/i },
  { slug: "pyiceberg", pattern: /\bpyiceberg\b/i },
  { slug: "spark", pattern: /\bspark\b/i },
  { slug: "flink", pattern: /\bflink\b/i },
  { slug: "kafka", pattern: /\bkafka\b/i },
  { slug: "cdc", pattern: /\bcdc\b|\bchange data capture\b/i },
  { slug: "compaction", pattern: /\bcompaction\b/i },
  { slug: "snapshots", pattern: /\bsnapshots?\b/i },
  { slug: "manifests", pattern: /\bmanifests?\b/i },
  { slug: "merge-on-read", pattern: /\bmerge-on-read\b|\bmerge on read\b/i },
  { slug: "copy-on-write", pattern: /\bcopy-on-write\b|\bcopy on write\b/i },
  { slug: "partitioning", pattern: /\bpartition(?:s|ed|ing)?\b/i },
  { slug: "clustering", pattern: /\bclustering\b/i },
  { slug: "statistics", pattern: /\bstatistics\b/i },
  { slug: "sketches", pattern: /\bsketches?\b/i },
  { slug: "bloom-filters", pattern: /\bbloom filters?\b|\bbloom\b/i },
  { slug: "trino", pattern: /\btrino\b/i },
  { slug: "duckdb", pattern: /\bduckdb\b/i },
  { slug: "parquet", pattern: /\bparquet\b/i },
  { slug: "polaris", pattern: /\bpolaris\b/i },
  { slug: "nessie", pattern: /\bnessie\b/i },
  { slug: "datafusion", pattern: /\bdatafusion\b/i },
  { slug: "schema-evolution", pattern: /\bschema evolution\b/i },
  { slug: "time-travel", pattern: /\btime travel\b/i },
  { slug: "mcp", pattern: /\bmcp\b|\bmodel context protocol\b/i },
  { slug: "agents", pattern: /\bagents?\b/i },
  { slug: "delta-lake", pattern: /\bdelta lake\b/i },
  { slug: "hudi", pattern: /\bhudi\b/i },
  { slug: "apache-arrow", pattern: /\bapache arrow\b|\bpyarrow\b|\barrow\s+(?:flight|ipc|format|columnar)\b/i },
  { slug: "streaming", pattern: /\bstreaming\b/i },
  { slug: "dremio", pattern: /\bdremio\b/i },
];

const EVENT = /\b(i['’]?m speaking|i am speaking|join me|my (?:talk|session|keynote)|conference|webinar|meetup|keynote)\b/i;
const RELEASE = /\b(announcing|just released|now available|we(?:'re| are) shipping|version \d+)\b/i;

export function classifyPost(input: {
  body: string;
  source: "shares" | "articles";
  postedAt: string;
}): Classification {
  const body = input.body ?? "";
  const scores = TOPICS.map((topic) => ({
    slug: topic.slug,
    score: topic.terms.reduce((sum, term) => sum + (term.pattern.test(body) ? term.weight : 0), 0),
  })).sort((a, b) => b.score - a.score || SPECIFICITY.indexOf(a.slug) - SPECIFICITY.indexOf(b.slug));

  const top = scores[0];
  const second = scores[1];
  const primaryTopic = top && top.score >= 4 ? top.slug : null;
  const secondaryTopics = scores.filter((score, index) => index > 0 && score.score >= 3 && score.slug !== primaryTopic).map((score) => score.slug);
  const tags = TAG_RULES.filter((rule) => rule.pattern.test(body)).map((rule) => rule.slug);
  const event = EVENT.test(body);
  const release = RELEASE.test(body);
  const length = body.trim().length;
  let postType: PostTypeSlug = "commentary";
  let ambiguous = false;
  let note: string | null = null;

  if (input.source === "articles") {
    postType = "article";
  } else if (event && length < 900) {
    postType = "talk-or-event";
  } else if (event && length >= 900) {
    postType = primaryTopic ? "technical-deep-dive" : "talk-or-event";
    ambiguous = true;
    note = "Event language in a long post. Confirm whether this is a talk or a technical write-up.";
  } else if (release && length < 1100) {
    postType = "project-update";
  } else if (length >= 800 && (primaryTopic === "apache-iceberg" || primaryTopic === "streaming" || primaryTopic === "open-lakehouse" || primaryTopic === "data-engineering")) {
    postType = "technical-deep-dive";
  }

  if (top && second && top.score >= 4 && top.score === second.score) {
    ambiguous = true;
    note = note ?? "Two topics scored equally. Confirm the primary topic.";
  }
  if (!primaryTopic && input.source !== "articles") {
    ambiguous = true;
    note = note ?? "No topic cleared the confidence threshold.";
  }

  const title = suggestTitle(body, input.postedAt);
  const excerpt = suggestExcerpt(body, title);
  if (title === fallbackTitle(input.postedAt)) {
    ambiguous = true;
    note = note ?? "The opening line did not yield a clear title.";
  }
  return { primaryTopic, secondaryTopics, tags, postType, ambiguous, note, title, excerpt };
}

export function suggestTitle(body: string, postedAt: string): string {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  if (first.length >= 12 && first.length <= 110 && wordCount(first) <= 18 && !first.endsWith(",")) {
    return cleanTitle(first);
  }
  const sentence = first.split(/(?<=[.!?])\s/)[0] ?? "";
  if (sentence.length >= 20 && sentence.length <= 140) return cleanTitle(sentence);
  if (first.length > 110) {
    const cut = first.slice(0, 96).replace(/\s+\S*$/, "").trim();
    if (cut.length >= 12) return `${cut}…`;
  }
  return fallbackTitle(postedAt);
}

export function suggestExcerpt(body: string, title: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  let text = flat;
  if (title && !title.startsWith("Post from ") && text.toLowerCase().startsWith(title.replace(/…$/, "").toLowerCase())) {
    text = text.slice(Math.min(title.length, text.length)).replace(/^[\s.…:–-]+/, "");
  }
  if (!text) text = flat;
  if (text.length <= 220) return text;
  return `${text.slice(0, 220).replace(/\s+\S*$/, "").trim()}…`;
}

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[:\s]+$/, "").trim();
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function fallbackTitle(postedAt: string): string {
  const date = postedAt.slice(0, 10);
  return `Post from ${date}`;
}

export type CollectionPick = { slug: string; postId: string; position: number };

export type CollectionCandidate = {
  id: string;
  primaryTopic: string | null;
  tags: string[];
  bodyLength: number;
  postedAt: string;
};

const COLLECTION_PLANS: {
  slug: string;
  stages: { tags: string[]; limit: number }[];
  topics?: string[];
}[] = [
  {
    slug: "iceberg-internals",
    topics: ["apache-iceberg"],
    stages: [
      { tags: ["snapshots", "manifests"], limit: 4 },
      { tags: ["puffin"], limit: 4 },
      { tags: ["statistics", "sketches", "bloom-filters"], limit: 4 },
      { tags: ["deletion-vectors", "merge-on-read", "copy-on-write"], limit: 4 },
    ],
  },
  {
    slug: "lakehouse-fast",
    topics: ["apache-iceberg", "open-lakehouse"],
    stages: [
      { tags: ["partitioning"], limit: 4 },
      { tags: ["clustering"], limit: 3 },
      { tags: ["compaction"], limit: 4 },
      { tags: ["statistics"], limit: 3 },
    ],
  },
  {
    slug: "ai-agents",
    topics: ["ai-agents"],
    stages: [
      { tags: ["agents"], limit: 8 },
      { tags: ["mcp"], limit: 8 },
    ],
  },
  {
    slug: "streaming-lakehouse",
    topics: ["streaming", "apache-iceberg"],
    stages: [
      { tags: ["cdc", "kafka"], limit: 4 },
      { tags: ["flink"], limit: 4 },
      { tags: ["streaming"], limit: 4 },
    ],
  },
];

export function planCollections(posts: CollectionCandidate[]): CollectionPick[] {
  const picks: CollectionPick[] = [];
  for (const plan of COLLECTION_PLANS) {
    const used = new Set<string>();
    const ordered: CollectionCandidate[] = [];
    for (const stage of plan.stages) {
      const matches = posts
        .filter((post) => !used.has(post.id))
        .filter((post) => !plan.topics || (post.primaryTopic && plan.topics.includes(post.primaryTopic)))
        .filter((post) => stage.tags.some((tag) => post.tags.includes(tag)))
        .sort((a, b) => b.bodyLength - a.bodyLength || a.postedAt.localeCompare(b.postedAt));
      for (const post of matches.slice(0, stage.limit)) {
        used.add(post.id);
        ordered.push(post);
      }
    }
    ordered.forEach((post, index) => picks.push({ slug: plan.slug, postId: post.id, position: index + 1 }));
  }
  return picks;
}
