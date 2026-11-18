import { sql } from "../src/lib/db";
import { setPostStatus } from "../src/lib/editorial";
import { renderFeed, sitemapEntries } from "../src/lib/feed";
import { loadLibrary, publicPosts, searchDocsFromPublic } from "../src/lib/queries";
import { assertPublicShape } from "../src/lib/public";
import { searchDocuments } from "../src/lib/search";

const POST_ID = process.env.VERIFY_POST_ID || "s7024554517807435776";

async function main() {
  const before = await sql<{ status: string; published_at: Date | null; updated_at: Date }>(
    `select status, published_at, updated_at from posts where id = $1`,
    [POST_ID],
  );
  const row = before[0];
  if (!row) throw new Error(`Post ${POST_ID} is not in the local archive`);
  if (row.status !== "draft") throw new Error(`Refusing to run: ${POST_ID} is ${row.status}, expected draft`);

  const publishedBefore = await sql<{ count: string }>(`select count(*)::text as count from posts where status = 'published'`);
  if (publishedBefore[0]?.count !== "0") throw new Error("Refusing to run while other posts are published");

  try {
    const hidden = await loadLibrary(sql, true);
    const hiddenPublic = publicPosts(hidden);
    if (hiddenPublic.length !== 0) throw new Error("Published library was not empty");
    if (searchDocuments(searchDocsFromPublic(hiddenPublic, hidden.collections), "Puffin").length !== 0) {
      throw new Error("Public search returned drafts");
    }
    if (renderFeed(hiddenPublic, "http://localhost:3000").includes("<item>")) throw new Error("RSS included a draft");
    if (sitemapEntries(hiddenPublic, hidden.topics, hidden.collections, "http://localhost:3000").some((entry) => entry.url.includes("/posts/"))) {
      throw new Error("Sitemap included a draft");
    }

    const changed = await setPostStatus(sql, [POST_ID], "published");
    if (changed !== 1) throw new Error("Publish did not update one row");
    const published = await loadLibrary(sql, true);
    const posts = publicPosts(published);
    if (posts.length !== 1 || posts[0]?.id !== POST_ID) throw new Error("Public library did not contain only the published post");
    for (const post of posts) assertPublicShape(post);
    const hits = searchDocuments(searchDocsFromPublic(posts, published.collections), "Puffin");
    if (!hits.some((hit) => hit.id === POST_ID)) throw new Error("Published post was missing from Puffin search");
    if (!renderFeed(posts, "http://localhost:3000").includes(`/posts/${POST_ID}`)) throw new Error("RSS omitted the published post");
    if (!sitemapEntries(posts, published.topics, published.collections, "http://localhost:3000").some((entry) => entry.url.endsWith(`/posts/${POST_ID}`))) {
      throw new Error("Sitemap omitted the published post");
    }

    const hiddenCount = await setPostStatus(sql, [POST_ID], "hidden");
    if (hiddenCount !== 1) throw new Error("Hide did not update one row");
    const afterHide = publicPosts(await loadLibrary(sql, true));
    if (afterHide.length !== 0) throw new Error("Hidden post remained public");
    if (searchDocuments(searchDocsFromPublic(afterHide, published.collections), "Puffin").some((hit) => hit.id === POST_ID)) {
      throw new Error("Hidden post remained in search");
    }
  } finally {
    await sql(
      `update posts set status = $2, published_at = $3, updated_at = $4 where id = $1`,
      [POST_ID, row.status, row.published_at, row.updated_at],
    );
  }

  const after = await sql<{ status: string; published: string }>(
    `select status, (select count(*) from posts where status = 'published')::text as published from posts where id = $1`,
    [POST_ID],
  );
  if (after[0]?.status !== "draft" || after[0]?.published !== "0") {
    throw new Error("Archive was not restored to drafts");
  }
  console.log(`verify-flow ok: ${POST_ID} draft → published → hidden → draft; public search, RSS, and sitemap followed the status`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "verify-flow failed";
  console.error(message.slice(0, 300));
  process.exit(1);
});
