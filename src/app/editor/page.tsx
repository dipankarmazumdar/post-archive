import type { Metadata } from "next";
import { importNotice } from "@/components/zip-upload";
import { EditorUploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Editor", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  password: "That password is not right.",
  missing: "Choose a ZIP file.",
  large: "The posts in that ZIP are too large to upload from the public site.",
  notzip: "That file is not a ZIP archive.",
  unsafe: "That ZIP was rejected.",
  empty: "That ZIP has no Shares.csv, so no posts were added.",
  failed: "The import did not finish. Use the LinkedIn export ZIP and try again.",
};

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const notice = importNotice(await searchParams);
  const error = notice.error && ERRORS[notice.error] ? ERRORS[notice.error] : "";
  return (
    <section className="panel zip-upload">
      <h1>Editor</h1>
      <p>
        Choose the export ZIP from LinkedIn. New posts are added and published. Posts already in the archive keep their edits and status.
      </p>
      {error ? <p className="banner">{error}</p> : null}
      {notice.added !== null ? (
        <p className="banner">
          Added {notice.added} {notice.added === 1 ? "post" : "posts"} and published {notice.added === 1 ? "it" : "them"}.
          {notice.updated ? ` Updated ${notice.updated} existing ${notice.updated === 1 ? "post" : "posts"}.` : ""}
          {notice.unchanged ? ` ${notice.unchanged} ${notice.unchanged === 1 ? "was" : "were"} already imported.` : ""}
        </p>
      ) : null}
      <EditorUploadForm />
    </section>
  );
}
