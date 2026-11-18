export type TopicRef = { slug: string; name: string; relation: "primary" | "secondary" };

export type LibraryPost = {
  id: string;
  externalKey: string;
  source: string;
  status: "draft" | "published" | "hidden";
  postedAt: string;
  postedAtPrecision: "minute" | "day";
  body: string;
  contentHash: string;
  linkedinUrl: string | null;
  sharedUrl: string | null;
  suggestedTitle: string | null;
  suggestedExcerpt: string | null;
  suggestedPostType: string | null;
  suggestedPrimaryTopic: string | null;
  suggestionAmbiguous: boolean;
  suggestionNote: string | null;
  editorialTitle: string | null;
  editorialExcerpt: string | null;
  titleLocked: boolean;
  excerptLocked: boolean;
  postType: string | null;
  postTypeLocked: boolean;
  primaryTopicSlug: string | null;
  primaryTopicLocked: boolean;
  publishedAt: string | null;
  topics: TopicRef[];
  tags: { slug: string; name: string; origin: string }[];
  media: {
    id: string;
    url: string;
    association: string;
    approved: boolean;
    durable: boolean;
    expiresAt: string | null;
    altText: string | null;
  }[];
  collectionSlugs: string[];
};

export function displayTitle(post: Pick<LibraryPost, "titleLocked" | "editorialTitle" | "suggestedTitle">): string {
  if (post.titleLocked && post.editorialTitle?.trim()) return post.editorialTitle.trim();
  return post.suggestedTitle?.trim() || post.editorialTitle?.trim() || "Untitled post";
}

export function displayExcerpt(post: Pick<LibraryPost, "excerptLocked" | "editorialExcerpt" | "suggestedExcerpt" | "body">): string {
  if (post.excerptLocked && post.editorialExcerpt?.trim()) return post.editorialExcerpt.trim();
  if (post.suggestedExcerpt?.trim()) return post.suggestedExcerpt.trim();
  const flat = post.body.replace(/\s+/g, " ").trim();
  return flat.length <= 220 ? flat : `${flat.slice(0, 220).replace(/\s+\S*$/, "").trim()}…`;
}

export function displayType(post: Pick<LibraryPost, "postTypeLocked" | "postType" | "suggestedPostType">): string {
  if (post.postTypeLocked && post.postType) return post.postType;
  return post.postType || post.suggestedPostType || "commentary";
}

export function effectiveTopics(post: Pick<LibraryPost, "topics" | "primaryTopicSlug">): TopicRef[] {
  const topics = post.topics.map((topic) => ({ ...topic }));
  if (post.primaryTopicSlug) {
    const current = topics.find((topic) => topic.slug === post.primaryTopicSlug);
    if (current) current.relation = "primary";
    for (const topic of topics) {
      if (topic.slug !== post.primaryTopicSlug && topic.relation === "primary") topic.relation = "secondary";
    }
  }
  return topics.sort((a, b) => (a.relation === b.relation ? a.name.localeCompare(b.name) : a.relation === "primary" ? -1 : 1));
}
