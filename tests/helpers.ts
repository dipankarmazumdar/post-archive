import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../src/lib/db";

export async function testDb(): Promise<{ sql: Sql; close: () => Promise<void> }> {
  const db = new PGlite();
  const files = readdirSync("migrations").filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) await db.exec(readFileSync(path.join("migrations", file), "utf8"));
  const sql: Sql = async <T,>(text: string, params: unknown[] = []) => (await db.query(text, params)).rows as T[];
  return { sql, close: () => db.close() };
}

export function makeZip(files: Record<string, string | { text: string; symlink?: boolean }>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "archive-zip-"));
  const zipPath = path.join(dir, "export.zip");
  const spec = path.join(dir, "files.json");
  writeFileSync(spec, JSON.stringify(files));
  execFileSync("python3", ["-c", PYTHON, zipPath, spec], { stdio: "pipe" });
  return zipPath;
}

const PYTHON = `
import json, sys, zipfile
zip_path, spec_path = sys.argv[1], sys.argv[2]
files = json.load(open(spec_path))
with zipfile.ZipFile(zip_path, "w") as archive:
    for name, payload in files.items():
        if isinstance(payload, dict) and payload.get("symlink"):
            info = zipfile.ZipInfo(name)
            info.external_attr = (0o120777) << 16
            archive.writestr(info, payload.get("text", ""))
        else:
            text = payload["text"] if isinstance(payload, dict) else payload
            archive.writestr(name, text)
`;
