import { uploadBundle, uploadZip } from "../actions";
import { sql } from "@/lib/db";

const ERRORS: Record<string, string> = {
  missing: "Choose a ZIP file.",
  large: "That ZIP is larger than 100 MB, or one of the post files inside it is too large.",
  notzip: "That file is not a ZIP archive.",
  unsafe: "That ZIP was rejected.",
  empty: "That ZIP has no Shares.csv, so no posts were added.",
  failed: "The import did not finish. Use the LinkedIn export ZIP and try again.",
};

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = one(params.error);
  const added = count(params.added);
  const updated = count(params.updated);
  const unchanged = count(params.unchanged);
  const runs = await sql<{ id: string; mode: string; status: string; started_at: string | Date; message: string | null; stats: string }>(
    `select id, mode, status, started_at, message, stats from import_runs order by started_at desc limit 8`,
  );
  return (
    <>
      <h1>Imports</h1>
      <p>
        Upload a newer LinkedIn export. Posts that are not already in the archive are added and published.
        Posts already here keep their edits and their status, including posts you have hidden.
        Messages, connections, and the rest of the export are ignored.
      </p>
      {error && ERRORS[error] ? <p className="banner">{ERRORS[error]}</p> : null}
      {added !== null ? (
        <p className="banner">
          Added {added} {added === 1 ? "post" : "posts"} and published {added === 1 ? "it" : "them"}.
          {updated ? ` Updated ${updated} existing ${updated === 1 ? "post" : "posts"}.` : ""}
          {unchanged ? ` ${unchanged} ${unchanged === 1 ? "was" : "were"} already imported.` : ""}
        </p>
      ) : null}
      <form action={uploadZip} className="form-grid">
        <label htmlFor="zip">LinkedIn export ZIP</label>
        <input id="zip" name="zip" type="file" accept=".zip,application/zip" required />
        <button type="submit">Import and publish</button>
      </form>
      <h2>Upload an editorial bundle</h2>
      <p>A JSON bundle from <code>npm run export-bundle</code> copies editorial rows. It is not a LinkedIn ZIP.</p>
      <form action={uploadBundle} className="form-grid">
        <label htmlFor="bundle">Bundle JSON</label>
        <input id="bundle" name="bundle" type="file" accept="application/json,.json" />
        <button type="submit">Upsert bundle</button>
      </form>
      <h2>Applied runs</h2>
      {runs.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When (UTC)</th><th>Status</th><th>Stats</th></tr></thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.started_at).toISOString()}</td>
                  <td>{run.status}</td>
                  <td><code>{typeof run.stats === "string" ? run.stats : JSON.stringify(run.stats)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No applied imports yet.</p>}
    </>
  );
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

function count(value: string | string[] | undefined): number | null {
  const raw = one(value);
  if (!/^\d{1,7}$/.test(raw)) return null;
  return Number(raw);
}
