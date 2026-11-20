import { timingSafeEqual } from "node:crypto";

export function editorPasswordMatches(given: string): boolean {
  const expected = process.env.EDITOR_PASSWORD?.trim() ?? "";
  if (!expected || !given) return false;
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
