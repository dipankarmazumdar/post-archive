export const EDITOR_UPLOAD_BYTES = 4 * 1024 * 1024;

export function isAllowlistedEntry(name: string): boolean {
  const norm = name.replace(/\\/g, "/");
  if (norm === "Shares.csv" || norm === "InstantReposts.csv" || norm === "Rich_Media.csv") return true;
  return /^Articles\/(?:Articles\/)?[a-z0-9-]+\.html$/.test(norm);
}
