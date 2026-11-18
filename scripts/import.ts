import { parseExport } from "../src/lib/parse-export";
import { formatReport, importParsed } from "../src/lib/import-archive";
import { sql, withTransaction } from "../src/lib/db";
import { readAllowlistedZip } from "../src/lib/zip";

const args = process.argv.slice(2);
const zipFlag = args.indexOf("--zip");
const zipPath = zipFlag >= 0 ? args[zipFlag + 1] : "";
const apply = args.includes("--apply");

if (!zipPath) {
  console.error("Usage: npm run import -- --zip <path> [--dry-run | --apply]");
  process.exit(1);
}

async function main(): Promise<void> {
  try {
    const { entries, ignored } = await readAllowlistedZip(zipPath);
    const parsed = parseExport(entries, ignored);
    const report = apply
      ? await withTransaction((query) => importParsed(query, parsed, "apply"))
      : await importParsed(sql, parsed, "dry-run");
    console.log(formatReport(report));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    console.error(message.slice(0, 300));
    process.exit(1);
  }
}

void main();
