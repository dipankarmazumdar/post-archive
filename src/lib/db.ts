import { mkdir, readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export type Sql = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

let pool: pg.Pool | undefined;
let local: Promise<PGlite> | undefined;

function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() ?? "";
}

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  if (databaseUrl() !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl(), max: 5 });
    const result = await pool.query(text, params);
    return result.rows as T[];
  }
  const db = await getLocal();
  const result = await db.query<T>(text, params);
  return result.rows;
}

export async function withTransaction<T>(fn: (query: Sql) => Promise<T>): Promise<T> {
  if (databaseUrl() !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl(), max: 5 });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const query: Sql = async <T,>(text: string, params: unknown[] = []) => (await client.query(text, params)).rows as T[];
      const result = await fn(query);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  const db = await getLocal();
  return db.transaction(async (tx) => {
    const query: Sql = async <T,>(text: string, params: unknown[] = []) => (await tx.query(text, params)).rows as T[];
    return fn(query);
  });
}

async function getLocal(): Promise<PGlite> {
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return local;
}

let closing = false;

function closeOnSignal(): void {
  const stop = () => {
    if (closing) return;
    closing = true;
    void (async () => {
      const db = local ? await local.catch(() => undefined) : undefined;
      await db?.close();
      await pool?.end();
      process.exit(0);
    })();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

async function startLocal(): Promise<PGlite> {
  const dir = process.env.ARCHIVE_DATA_DIR?.trim() || "data/pglite";
  await mkdir(dir, { recursive: true });
  closeOnSignal();
  const db = new PGlite(dir);
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const files = (await readdir("migrations").catch(() => [])).filter((file) => file.endsWith(".sql")).sort();
  const done = new Set((await db.query<{ name: string }>("select name from schema_migrations")).rows.map((row) => row.name));
  for (const file of files) {
    if (done.has(file)) continue;
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
  return db;
}
