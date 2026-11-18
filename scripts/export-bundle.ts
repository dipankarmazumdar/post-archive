import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { exportBundle } from "../src/lib/bundle";
import { sql } from "../src/lib/db";

const args = process.argv.slice(2);
const outFlag = args.indexOf("--out");
const out = outFlag >= 0 ? args[outFlag + 1] : "data/archive.bundle.json";
if (!out) {
  console.error("Usage: npm run export-bundle -- --out data/archive.bundle.json");
  process.exit(1);
}
const normalized = out.replace(/\\/g, "/");
if (normalized === "public" || normalized.startsWith("public/") || normalized.includes("/public/")) {
  console.error("Refusing to write a bundle into a public folder.");
  process.exit(1);
}
async function main(): Promise<void> {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, await exportBundle(sql), "utf8");
  console.log(`Wrote editorial bundle to ${out}`);
}

void main();
