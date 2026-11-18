import { uploadBundle } from "../actions";
import { sql } from "@/lib/db";

export default async function ImportsPage() {
  const runs = await sql<{ id: string; mode: string; status: string; started_at: string | Date; message: string | null; stats: string }>(
    `select id, mode, status, started_at, message, stats from import_runs order by started_at desc limit 8`,
  );
  return (
    <>
      <h1>Imports</h1>
      <p>The deployed site does not read the LinkedIn ZIP. Run the importer on your machine, against the local database or with <code>DATABASE_URL</code> set.</p>
      <pre>{`npm run import -- --zip /path/to/export.zip --dry-run
npm run import -- --zip /path/to/export.zip --apply
npm run export-bundle -- --out data/archive.bundle.json`}</pre>
      <p>A dry run writes nothing. Applying again does not duplicate posts or unpublish anything that is missing from an older file.</p>
      <h2>Upload an editorial bundle</h2>
      <form action={uploadBundle} className="form-grid">
        <label htmlFor="bundle">Bundle JSON from the CLI</label>
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
                  <td><code>{run.stats}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No applied imports yet.</p>}
    </>
  );
}
