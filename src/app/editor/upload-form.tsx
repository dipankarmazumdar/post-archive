"use client";

import { useState, type FormEvent } from "react";
import { unzipSync, zipSync } from "fflate";
import { uploadEditorZip } from "./actions";
import { EDITOR_UPLOAD_BYTES, isAllowlistedEntry } from "@/lib/zip-allowlist";

const SOURCE_LIMIT = 100 * 1024 * 1024;

function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

export function EditorUploadForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    const file = form.elements.namedItem("zip");
    if (!(file instanceof HTMLInputElement) || !file.files?.[0]) {
      setMessage("Choose a ZIP file.");
      return;
    }
    const source = file.files[0];
    if (source.size > SOURCE_LIMIT) {
      setMessage("That ZIP is larger than 100 MB.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const opened = unzipSync(new Uint8Array(await source.arrayBuffer()));
      const kept: Record<string, Uint8Array> = {};
      for (const [name, bytes] of Object.entries(opened)) {
        if (isAllowlistedEntry(name)) kept[name] = bytes;
      }
      if (!Object.keys(kept).some((name) => name.replace(/\\/g, "/").endsWith("Shares.csv"))) {
        setMessage("That ZIP has no Shares.csv, so no posts were added.");
        return;
      }
      const slim = zipSync(kept);
      if (slim.byteLength > EDITOR_UPLOAD_BYTES) {
        setMessage("The posts in that ZIP are too large to upload from the public site.");
        return;
      }
      const data = new FormData();
      data.set("password", password);
      data.set("zip", new File([slim], "posts.zip", { type: "application/zip" }));
      await uploadEditorZip(data);
    } catch (error) {
      if (isRedirect(error)) throw error;
      setMessage("That file could not be read. Use the LinkedIn export ZIP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-grid">
      {message ? <p className="banner">{message}</p> : null}
      <label htmlFor="editor-password">Password</label>
      <input id="editor-password" name="password" type="password" autoComplete="current-password" required />
      <label htmlFor="editor-zip">LinkedIn export ZIP</label>
      <input id="editor-zip" name="zip" type="file" accept=".zip,application/zip" required />
      <button type="submit" disabled={busy}>{busy ? "Reading ZIP…" : "Import and publish"}</button>
    </form>
  );
}
