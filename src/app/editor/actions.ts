"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { editorPasswordMatches } from "@/lib/editor-password";
import { importParsed } from "@/lib/import-archive";
import { parseExport } from "@/lib/parse-export";
import { withTransaction } from "@/lib/db";
import { readAllowlistedZipBuffer } from "@/lib/zip";
import { EDITOR_UPLOAD_BYTES } from "@/lib/zip-allowlist";

export async function uploadEditorZip(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!editorPasswordMatches(password)) redirect("/editor?error=password");
  const file = formData.get("zip");
  if (!(file instanceof File) || file.size === 0) redirect("/editor?error=missing");
  if (file.size > EDITOR_UPLOAD_BYTES) redirect("/editor?error=large");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) redirect("/editor?error=notzip");
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
    if (/unsafe/i.test(message)) redirect("/editor?error=unsafe");
    if (/size/i.test(message)) redirect("/editor?error=large");
    redirect("/editor?error=failed");
  }
  revalidatePath("/", "layout");
  if (!sawShares) redirect("/editor?error=empty");
  redirect(`/editor?added=${added}&updated=${updated}&unchanged=${unchanged}`);
}
