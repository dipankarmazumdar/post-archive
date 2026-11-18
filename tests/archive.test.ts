import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runExplore } from "../src/lib/explore";
import { importParsed, refreshSuggestions } from "../src/lib/import-archive";
import { setPostStatus, savePostEditorial } from "../src/lib/editorial";
import { loadLibrary, publicPosts, searchDocsFromPublic } from "../src/lib/queries";
import { renderFeed } from "../src/lib/feed";
import { parseExport } from "../src/lib/parse-export";
import { toPublicPost, assertPublicShape } from "../src/lib/public";
import { relatedReading } from "../src/lib/recommend";
import { searchDocuments } from "../src/lib/search";
import { classifyPost } from "../src/lib/taxonomy";
import { isAllowlistedEntry, isSafeZipPath, isSymlinkMode, readAllowlistedZip } from "../src/lib/zip";
import { parseLinkedInPermalink, safeHttpUrl } from "../src/lib/urls";
import { makeZip, testDb } from "./helpers";

const SHARE_HEADER = "Date,ShareLink,ShareCommentary,SharedUrl,MediaUrl,Visibility";

function shareRow(id: string, body: string, extra = ""): string {
  const link = `https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A${id}`;
  const escaped = `"${body.replace(/"/g, '""')}"`;
  return `2024-05-06 07:08:09,${link},${escaped},${extra},,MEMBER_NETWORK`;
}

describe("zip safety", () => {
  it("rejects unsafe paths and symlinks and skips private files", async () => {
    expect(isSafeZipPath("../secrets.csv")).toBe(false);
    expect(isSafeZipPath("Shares.csv")).toBe(true);
    expect(isSymlinkMode(0o120777 << 16)).toBe(true);
    expect(isAllowlistedEntry("messages.csv")).toBe(false);
    const zip = makeZip({
      "Shares.csv": `${SHARE_HEADER}\n${shareRow("101", "PyIceberg keeps the naïve résumé")}`,
      "messages.csv": "PRIVATE_MESSAGE_TOKEN,hello@example.com",
      "Connections.csv": "person@example.com",
    });
    const read = await readAllowlistedZip(zip);
    expect(read.entries.map((entry) => entry.name)).toEqual(["Shares.csv"]);
    expect(read.entries[0]?.text.includes("PRIVATE_MESSAGE_TOKEN")).toBe(false);
    const evil = makeZip({ "../secrets.csv": "nope" });
    await expect(readAllowlistedZip(evil)).rejects.toThrow(/unsafe/i);
    const link = makeZip({ "Shares.csv": { text: "x", symlink: true } });
    await expect(readAllowlistedZip(link)).rejects.toThrow(/unsafe/i);
    const bulky = makeZip({ "Shares.csv": "x".repeat(500) });
    await expect(readAllowlistedZip(bulky, { maxEntryBytes: 100, maxTotalBytes: 100, maxEntriesRead: 5 })).rejects.toThrow(/size/i);
  });
});

describe("permalinks and parsing", () => {
  it("keeps encoded LinkedIn permalinks and rejects invented schemes", () => {
    const parsed = parseLinkedInPermalink("https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A555");
    expect(parsed?.id).toBe("s555");
    expect(parsed?.urn).toBe("urn:li:share:555");
    expect(parsed?.url.startsWith("https://www.linkedin.com/feed/update/")).toBe(true);
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseLinkedInPermalink("https://example.com/feed/update/urn:li:share:1")).toBeNull();
  });

  it("preserves multiline unicode text and drops private files", () => {
    const csv = `${SHARE_HEADER}\n${shareRow("202", "Line one, with a comma\nLine two\n\nPyIceberg — naïve")}\n${shareRow("202", "Line one, with a comma\nLine two\n\nPyIceberg — naïve")}\nnot-a-date,https://evil.example/post,"no",,,`;
    const parsed = parseExport(
      [
        { name: "Shares.csv", text: csv },
        { name: "messages.csv", text: "PRIVATE_MESSAGE_TOKEN" },
      ],
      1,
    );
    expect(parsed.posts).toHaveLength(1);
    expect(parsed.posts[0]?.body).toContain("Line one, with a comma\nLine two");
    expect(parsed.posts[0]?.body).toContain("naïve");
    expect(JSON.stringify(parsed)).not.toContain("PRIVATE_MESSAGE_TOKEN");
    expect(parsed.skipped.some((item) => item.reason === "untrustworthy_permalink" || item.reason === "duplicate_row")).toBe(true);
  });

  it("removes the export's line-wrapping quotes and keeps quotes inside a sentence", () => {
    const wrapped = [
      'Have been meaning to share about "StreamFusion" 🚀"',
      '""',
      '"StreamFusion is a project."',
      '"',
    ].join("\n");
    const plain = "Looking forward to this meetup!";
    const parsed = parseExport(
      [{ name: "Shares.csv", text: `${SHARE_HEADER}\n${shareRow("301", wrapped)}\n${shareRow("302", plain)}` }],
      0,
    );
    const long = parsed.posts.find((post) => post.id === "s301");
    const short = parsed.posts.find((post) => post.id === "s302");
    expect(long?.body).toBe('Have been meaning to share about "StreamFusion" 🚀\n\nStreamFusion is a project.');
    expect(short?.body).toBe(plain);
  });
});

describe("search and taxonomy", () => {
  it("ranks titles and tags above body mentions and expands aliases", () => {
    const docs = [
      doc("title", "Puffin files", "A note", "Iceberg stores statistics in Puffin."),
      doc("body", "Weekly notes", "misc", "Someone mentioned puffin once in passing."),
      doc("tag", "Table stats", "Deletion vectors keep rows", "A body without the acronym.", ["Deletion vectors"]),
    ];
    const puffin = searchDocuments(docs, "Puffin");
    expect(puffin[0]?.id).toBe("title");
    expect(puffin.map((hit) => hit.id)).toContain("body");
    const dv = searchDocuments(docs, "DV");
    expect(dv.map((hit) => hit.id)).toContain("tag");
    const phrase = searchDocuments(
      [doc("exact", "Catalog", "x", "The Iceberg REST catalog answers those calls."), doc("split", "Catalog", "x", "Iceberg is here. REST is elsewhere. catalog too.")],
      '"Iceberg REST catalog"',
    );
    expect(phrase.map((hit) => hit.id)).toEqual(["exact"]);
    const checkpoint = searchDocuments([doc("fl", "Flink", "x", "Flink checkpointing keeps the job honest.")], "Flink checkpointing");
    expect(checkpoint[0]?.id).toBe("fl");
    expect(checkpoint[0]?.snippet.some((part) => part.hit)).toBe(true);
  });

  it("classifies iceberg, streaming, and agents separately from post type", () => {
    const iceberg = classifyPost({
      body: "Puffin stores statistics and sketches so Iceberg can skip files.",
      source: "shares",
      postedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(iceberg.primaryTopic).toBe("apache-iceberg");
    expect(iceberg.tags).toContain("puffin");
    const streaming = classifyPost({
      body: "Flink checkpointing and Kafka CDC land in the table.",
      source: "shares",
      postedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(streaming.primaryTopic).toBe("streaming");
    expect(streaming.postType).not.toBe("technical-deep-dive");
    const talk = classifyPost({
      body: "Join me at the meetup next week.",
      source: "shares",
      postedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(talk.postType).toBe("talk-or-event");
  });
});

describe("imports and publication", () => {
  it("repeats imports, keeps edits, and hides drafts from public search", async () => {
    const { sql, close } = await testDb();
    const first = parseExport([{ name: "Shares.csv", text: `${SHARE_HEADER}\n${shareRow("301", puffinBody())}\n${shareRow("302", "A short comment about lunch.")}` }], 0);
    const dry = await importParsed(sql, first, "dry-run");
    expect(dry.created).toBe(2);
    expect(await sql(`select count(*)::int as count from posts`)).toEqual([{ count: 0 }]);
    await importParsed(sql, first, "apply");
    const again = await importParsed(sql, first, "apply");
    expect(again.created).toBe(0);
    expect(again.unchanged).toBe(2);
    const posts = await sql<{ id: string; status: string }>(`select id, status from posts order by id`);
    expect(posts.every((post) => post.status === "draft")).toBe(true);
    const puffin = posts.find((post) => post.id === "s301");
    expect(puffin).toBeTruthy();
    await savePostEditorial(sql, {
      id: "s301",
      title: "My Puffin title",
      excerpt: "My excerpt",
      postType: "technical-deep-dive",
      primaryTopic: "apache-iceberg",
      secondaryTopics: [],
      tags: ["puffin"],
      approvedMedia: [],
      collections: [],
    });
    await setPostStatus(sql, ["s301"], "published");
    const changed = parseExport([{ name: "Shares.csv", text: `${SHARE_HEADER}\n${shareRow("301", `${puffinBody()}\nAdded a paragraph.`)}\n${shareRow("302", "A short comment about lunch.")}` }], 0);
    await importParsed(sql, changed, "apply");
    const edited = await sql<{ editorial_title: string; status: string; body: string }>(`select editorial_title, status, body from posts where id = 's301'`);
    expect(edited[0]?.editorial_title).toBe("My Puffin title");
    expect(edited[0]?.status).toBe("published");
    expect(edited[0]?.body).toContain("Added a paragraph.");
    const partial = parseExport([{ name: "Shares.csv", text: `${SHARE_HEADER}\n${shareRow("302", "A short comment about lunch.")}` }], 0);
    await importParsed(sql, partial, "apply");
    const still = await sql<{ status: string }>(`select status from posts where id = 's301'`);
    expect(still[0]?.status).toBe("published");
    await refreshSuggestions(sql);
    const locked = await sql<{ editorial_title: string; title_locked: boolean }>(`select editorial_title, title_locked from posts where id = 's301'`);
    expect(locked[0]?.title_locked).toBe(true);
    expect(locked[0]?.editorial_title).toBe("My Puffin title");

    const library = await loadLibrary(sql, false);
    const publishedDocs = searchDocsFromPublic(publicPosts(library), library.collections);
    expect(publishedDocs.map((doc) => doc.id)).toEqual(["s301"]);
    expect(searchDocuments(publishedDocs, "lunch")).toEqual([]);
    expect(searchDocuments(publishedDocs, "Puffin")[0]?.id).toBe("s301");
    const hiddenLibrary = publicPosts(library);
    expect(hiddenLibrary.some((post) => post.body.includes("lunch"))).toBe(false);
    const publicPost = hiddenLibrary[0];
    expect(publicPost).toBeTruthy();
    assertPublicShape(publicPost!);
    expect(JSON.stringify(publicPost)).not.toContain("content_hash");
    expect(renderFeed(hiddenLibrary, "https://example.test")).not.toContain("lunch");
    await setPostStatus(sql, ["s301"], "hidden");
    const afterHide = publicPosts(await loadLibrary(sql, false));
    expect(afterHide).toEqual([]);
    expect(toPublicPost((await loadLibrary(sql, false)).posts[0]!) ).toBeNull();
    await close();
  });

  it("sends conflicting duplicates to review and recommends only strong published matches", async () => {
    const { sql, close } = await testDb();
    const csv = `${SHARE_HEADER}\n${shareRow("401", "First body about Puffin statistics")}\n2024-05-06 07:08:09,https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A401,"A different body about Puffin",,,MEMBER_NETWORK`;
    const parsed = parseExport([{ name: "Shares.csv", text: csv }], 0);
    expect(parsed.ambiguous.some((item) => item.reason === "conflicting_duplicate")).toBe(true);
    await importParsed(sql, parsed, "apply");
    expect(await sql(`select count(*)::int as count from posts`)).toEqual([{ count: 0 }]);
    const open = await sql<{ status: string }>(`select status from review_items`);
    expect(open.length).toBeGreaterThan(0);

    const seeds = parseExport([
      { name: "Shares.csv", text: `${SHARE_HEADER}\n${shareRow("501", puffinBody())}\n${shareRow("502", puffinBody().replace("Puffin", "Puffin files"))}\n${shareRow("503", "Lunch plans for Friday.")}` },
    ], 0);
    await importParsed(sql, seeds, "apply");
    await setPostStatus(sql, ["s501", "s502", "s503"], "published");
    const library = await loadLibrary(sql, true);
    const docs = searchDocsFromPublic(publicPosts(library), library.collections).map((doc, index) => ({
      ...doc,
      contentHash: library.posts[index]?.contentHash,
    }));
    const current = docs.find((doc) => doc.id === "s501")!;
    const related = relatedReading(current, docs, []);
    expect(related.map((item) => item.id)).toContain("s502");
    expect(related.map((item) => item.id)).not.toContain("s501");
    expect(related.map((item) => item.id)).not.toContain("s503");
    const removed = relatedReading(current, docs, [{ postId: "s501", relatedPostId: "s502", pinned: false, removed: true }]);
    expect(removed.map((item) => item.id)).not.toContain("s502");
    await close();
  });
});

function puffinBody(): string {
  return "Puffin stores statistics and sketches for Apache Iceberg. Deletion vectors build on that metadata. ".repeat(8);
}

function doc(id: string, title: string, excerpt: string, body: string, tags: string[] = []) {
  return {
    id,
    title,
    excerpt,
    body,
    topicNames: ["Apache Iceberg"],
    tagNames: tags,
    collectionNames: [],
    postType: "technical-deep-dive",
    topicSlugs: ["apache-iceberg"],
    tagSlugs: tags.map((tag) => tag.toLowerCase().replace(/\s+/g, "-")),
    postedAt: "2024-01-01T00:00:00.000Z",
    year: 2024,
  };
}
