import { uploadBundle } from "../actions";
import { importNotice, importSummary, ZipUpload } from "@/components/zip-upload";
import { sql } from "@/lib/db";

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const notice = importNotice(await searchParams);
  const runs = await sql<{ id: string; mode: string; status: string; started_at: string | Date; message: string | null; stats: string }>(
    `select id, mode, status, started_at, message, stats from import_runs order by started_at desc limit 8`,
  );
  return (
    <>
      <h1>Imports</h1>
      <ZipUpload notice={notice} returnTo="/admin/imports" />
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
                  <td>{importSummary(run.stats)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No applied imports yet.</p>}
    </>
  );
}
