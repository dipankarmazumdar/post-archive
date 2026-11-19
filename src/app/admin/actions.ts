"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertEditor, isEditor } from "@/lib/auth";
import { importBundle } from "@/lib/bundle";
import { importParsed } from "@/lib/import-archive";
import { parseExport } from "@/lib/parse-export";
import { readAllowlistedZipBuffer, ZIP_UPLOAD_BYTES } from "@/lib/zip";
import { withTransaction } from "@/lib/db";
import {
  mergeTags,
  moveCollectionPost,
  resolveReview,
  savePostEditorial,
  saveStartHere,
  saveTopicStarts,
  setPostStatus,
  setRecommendation,
  unlockPostField,
  updateCollection,
  updateTopicDescription,
} from "@/lib/editorial";
import { isSafeId } from "@/lib/urls";

function idsFrom(formData: FormData): string[] {
  return formData.getAll("ids").map(String).filter(isSafeId);
}

async function gate(): Promise<void> {
  const editor = await assertEditor();
  if (!isEditor(editor)) throw new Error("Editor action refused");
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function publishPosts(formData: FormData) {
  await gate();
  await withTransaction((query) => setPostStatus(query, idsFrom(formData), "published"));
  refresh();
}

export async function hidePosts(formData: FormData) {
  await gate();
  await withTransaction((query) => setPostStatus(query, idsFrom(formData), "hidden"));
  refresh();
}

export async function draftPosts(formData: FormData) {
  await gate();
  await withTransaction((query) => setPostStatus(query, idsFrom(formData), "draft"));
  refresh();
}

export async function savePost(formData: FormData) {
  await gate();
  const id = String(formData.get("id") ?? "");
  await withTransaction((query) =>
    savePostEditorial(query, {
      id,
      title: String(formData.get("title") ?? ""),
      excerpt: String(formData.get("excerpt") ?? ""),
      postType: String(formData.get("postType") ?? ""),
      primaryTopic: String(formData.get("primaryTopic") ?? ""),
      secondaryTopics: formData.getAll("secondary").map(String),
      tags: formData.getAll("tags").map(String),
      approvedMedia: formData.getAll("media").map(String),
      collections: formData.getAll("collections").map(String),
    }),
  );
  refresh();
}

export async function unlockField(formData: FormData) {
  await gate();
  const field = String(formData.get("field") ?? "");
  if (field !== "title" && field !== "excerpt" && field !== "type" && field !== "topic") throw new Error("Unknown field");
  await withTransaction((query) => unlockPostField(query, String(formData.get("id") ?? ""), field));
  refresh();
}

export async function setStatusOne(formData: FormData) {
  await gate();
  const status = String(formData.get("status") ?? "");
  if (status !== "draft" && status !== "published" && status !== "hidden") throw new Error("Unknown status");
  await withTransaction((query) => setPostStatus(query, [String(formData.get("id") ?? "")], status));
  refresh();
}

export async function recommendAction(formData: FormData) {
  await gate();
  const mode = String(formData.get("mode") ?? "");
  if (mode !== "pin" && mode !== "remove" && mode !== "clear") throw new Error("Unknown action");
  await withTransaction((query) => setRecommendation(query, String(formData.get("id") ?? ""), String(formData.get("relatedId") ?? ""), mode));
  refresh();
}

export async function mergeTagAction(formData: FormData) {
  await gate();
  await withTransaction((query) => mergeTags(query, String(formData.get("from") ?? ""), String(formData.get("into") ?? "")));
  refresh();
}

export async function moveInCollection(formData: FormData) {
  await gate();
  const direction = String(formData.get("direction") ?? "") === "up" ? -1 : 1;
  await withTransaction((query) => moveCollectionPost(query, String(formData.get("slug") ?? ""), String(formData.get("id") ?? ""), direction));
  refresh();
}

export async function saveCollectionMeta(formData: FormData) {
  await gate();
  await withTransaction((query) => updateCollection(query, String(formData.get("slug") ?? ""), String(formData.get("title") ?? ""), String(formData.get("description") ?? "")));
  refresh();
}

export async function saveTopicMeta(formData: FormData) {
  await gate();
  const slug = String(formData.get("slug") ?? "");
  await withTransaction(async (query) => {
    await updateTopicDescription(query, slug, String(formData.get("description") ?? ""));
    const ordered = String(formData.get("starts") ?? "")
      .split(/[\s,]+/)
      .filter(Boolean);
    await saveTopicStarts(query, slug, ordered);
  });
  refresh();
}

export async function saveStartHereAction(formData: FormData) {
  await gate();
  const ordered = String(formData.get("order") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  const notes: Record<string, string> = {};
  for (const id of ordered) notes[id] = String(formData.get(`note-${id}`) ?? "");
  await withTransaction((query) => saveStartHere(query, ordered, notes));
  refresh();
}

export async function dismissReview(formData: FormData) {
  await gate();
  await withTransaction((query) => resolveReview(query, String(formData.get("id") ?? "")));
  refresh();
}

export async function uploadZip(formData: FormData) {
  await gate();
  const file = formData.get("zip");
  if (!(file instanceof File) || file.size === 0) redirect("/admin/imports?error=missing");
  if (file.size > ZIP_UPLOAD_BYTES) redirect("/admin/imports?error=large");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) redirect("/admin/imports?error=notzip");
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let sawShares = false;
  try {
    const { entries, ignored } = await readAllowlistedZipBuffer(bytes);
    const parsed = parseExport(entries, ignored);
    sawShares = parsed.inventory.some((item) => item.name.replace(/\\/g, "/").endsWith("Shares.csv"));
    const report = await withTransaction((query) => importParsed(query, parsed, "apply", { publishNew: true }));
    added = report.created;
    updated = report.updated;
    unchanged = report.unchanged;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unsafe/i.test(message)) redirect("/admin/imports?error=unsafe");
    if (/size/i.test(message)) redirect("/admin/imports?error=large");
    redirect("/admin/imports?error=failed");
  }
  refresh();
  if (!sawShares) redirect("/admin/imports?error=empty");
  redirect(`/admin/imports?added=${added}&updated=${updated}&unchanged=${unchanged}`);
}

export async function uploadBundle(formData: FormData) {
  await gate();
  const file = formData.get("bundle");
  if (!(file instanceof File)) throw new Error("Choose a bundle file.");
  if (file.size > 8_000_000) throw new Error("Bundle is too large.");
  const text = await file.text();
  await withTransaction(async (query) => {
    const result = await importBundle(query, text);
    await query(
      `insert into import_runs (id, mode, status, finished_at, stats, message) values ($1, 'bundle', 'complete', now(), $2, $3)`,
      [crypto.randomUUID(), JSON.stringify({ posts: result.posts }), "Bundle upserted"],
    );
  });
  refresh();
}
