import { withTransaction } from "../src/lib/db";
import { refreshSuggestions } from "../src/lib/import-archive";

async function main(): Promise<void> {
  const count = await withTransaction((query) => refreshSuggestions(query));
  console.log(`Refreshed suggestions for ${count} posts. Locked titles, excerpts, topics, and post types were kept.`);
}

void main();
