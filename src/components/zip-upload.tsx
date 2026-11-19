import { uploadZip } from "@/app/admin/actions";

const ERRORS: Record<string, string> = {
  missing: "Choose a ZIP file.",
  large: "That ZIP is larger than 100 MB, or one of the post files inside it is too large.",
  notzip: "That file is not a ZIP archive.",
  unsafe: "That ZIP was rejected.",
  empty: "That ZIP has no Shares.csv, so no posts were added.",
  failed: "The import did not finish. Use the LinkedIn export ZIP and try again.",
};

export type ImportNotice = {
  error: string | null;
  added: number | null;
  updated: number | null;
  unchanged: number | null;
};

export function importNotice(params: Record<string, string | string[] | undefined>): ImportNotice {
  return {
    error: one(params.error),
    added: count(params.added),
    updated: count(params.updated),
    unchanged: count(params.unchanged),
  };
}

export function ZipUpload({ notice, returnTo }: { notice: ImportNotice; returnTo: "/admin" | "/admin/imports" }) {
  return (
    <section className="panel zip-upload">
      <h2>Import a LinkedIn ZIP</h2>
      <p>
        Choose the export ZIP from LinkedIn. New posts are added and published. Posts already in the archive keep their edits and status.
      </p>
      {notice.error && ERRORS[notice.error] ? <p className="banner">{ERRORS[notice.error]}</p> : null}
      {notice.added !== null ? (
        <p className="banner">
          Added {notice.added} {notice.added === 1 ? "post" : "posts"} and published {notice.added === 1 ? "it" : "them"}.
          {notice.updated ? ` Updated ${notice.updated} existing ${notice.updated === 1 ? "post" : "posts"}.` : ""}
          {notice.unchanged ? ` ${notice.unchanged} ${notice.unchanged === 1 ? "was" : "were"} already imported.` : ""}
        </p>
      ) : null}
      <form action={uploadZip} className="form-grid">
        <input type="hidden" name="next" value={returnTo} />
        <label htmlFor={returnTo === "/admin" ? "zip-editor" : "zip-imports"}>LinkedIn export ZIP</label>
        <input id={returnTo === "/admin" ? "zip-editor" : "zip-imports"} name="zip" type="file" accept=".zip,application/zip" required />
        <button type="submit">Import and publish</button>
      </form>
    </section>
  );
}

export function importSummary(stats: unknown): string {
  let value = stats;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return "Import finished";
    }
  }
  if (!value || typeof value !== "object") return "Import finished";
  const row = value as Record<string, unknown>;
  const created = Number(row.created ?? row.posts ?? 0);
  const updated = Number(row.updated ?? 0);
  const unchanged = Number(row.unchanged ?? 0);
  if (!Number.isFinite(created) || !Number.isFinite(updated) || !Number.isFinite(unchanged)) return "Import finished";
  return `${created} new, ${updated} updated, ${unchanged} already stored`;
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

function count(value: string | string[] | undefined): number | null {
  const raw = one(value);
  if (!/^\d{1,7}$/.test(raw)) return null;
  return Number(raw);
}
