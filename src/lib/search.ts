export const ALIAS_GROUPS: string[][] = [
  ["dv", "deletion vector", "deletion vectors"],
  ["cdc", "change data capture"],
  ["mor", "merge-on-read", "merge on read"],
  ["cow", "copy-on-write", "copy on write"],
  ["mcp", "model context protocol"],
  ["rest catalog", "iceberg rest catalog"],
  ["checkpoint", "checkpointing", "checkpoints"],
  ["pyiceberg", "py iceberg"],
];

const TOKEN = /[a-z0-9]+(?:[-+][a-z0-9]+)*/g;

export type SearchDoc = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  topicNames: string[];
  tagNames: string[];
  collectionNames: string[];
  postType: string;
  topicSlugs: string[];
  tagSlugs: string[];
  postedAt: string;
  year: number;
  contentHash?: string;
};

export type Segment = { text: string; hit: boolean };

export type SearchHit = {
  id: string;
  score: number;
  snippet: Segment[];
};

type Atom = { forms: string[]; original: string };

const FIELD_WEIGHTS = {
  title: 12,
  tags: 9,
  topics: 7,
  collections: 6,
  excerpt: 4,
  body: 1,
} as const;

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN) ?? [];
}

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function searchDocuments(
  docs: SearchDoc[],
  query: string,
  aliasGroups: string[][] = ALIAS_GROUPS,
): SearchHit[] {
  const atoms = parseQuery(query, aliasGroups);
  if (atoms.length === 0) return [];
  const whole = normalizeText(query.replace(/"[^"]*"/g, " "));
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const fields = docFields(doc);
    let score = 0;
    let ok = true;
    const matchedForms: string[] = [];
    for (const atom of atoms) {
      const best = bestAtomScore(atom, fields);
      if (!best) {
        ok = false;
        break;
      }
      score += best.score;
      matchedForms.push(best.form);
    }
    if (!ok) continue;
    if (whole.includes(" ") && fields.title.includes(whole)) score += 24;
    else if (whole.includes(" ") && fields.body.includes(whole)) score += 8;
    hits.push({ id: doc.id, score, snippet: snippetFor(doc.body || doc.excerpt || doc.title, matchedForms) });
  }
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return hits;
}

function parseQuery(query: string, aliasGroups: string[][]): Atom[] {
  const quoted = [...query.matchAll(/"([^"]+)"/g)].map((match) => normalizeText(match[1] ?? "")).filter(Boolean);
  const rest = query.replace(/"[^"]*"/g, " ");
  const tokens = tokenize(rest);
  const atoms: Atom[] = quoted.map((phrase) => ({ original: phrase, forms: [phrase] }));
  let index = 0;
  while (index < tokens.length) {
    let consumed = 1;
    let forms = [tokens[index] ?? ""];
    let original = tokens[index] ?? "";
    for (let length = Math.min(4, tokens.length - index); length > 1; length -= 1) {
      const phrase = tokens.slice(index, index + length).join(" ");
      const group = aliasGroups.find((candidate) => candidate.some((alias) => normalizeText(alias) === phrase));
      if (group) {
        consumed = length;
        original = phrase;
        forms = unique(group.map((alias) => normalizeText(alias)));
        break;
      }
    }
    if (consumed === 1) {
      const token = tokens[index] ?? "";
      const group = aliasGroups.find((candidate) => candidate.some((alias) => !alias.includes(" ") && alias.toLowerCase() === token));
      forms = group ? unique(group.flatMap((alias) => (alias.includes(" ") ? [normalizeText(alias)] : [alias.toLowerCase()]))) : [token];
      original = token;
    }
    if (original) atoms.push({ original, forms });
    index += consumed;
  }
  return atoms;
}

function bestAtomScore(atom: Atom, fields: Record<keyof typeof FIELD_WEIGHTS, string>): { score: number; form: string } | null {
  let best = 0;
  let form = atom.original;
  for (const variant of atom.forms) {
    const aliasPenalty = variant === atom.original ? 1 : 0.82;
    for (const [name, weight] of Object.entries(FIELD_WEIGHTS) as [keyof typeof FIELD_WEIGHTS, number][]) {
      if (!containsForm(fields[name], variant)) continue;
      const score = weight * aliasPenalty;
      if (score > best) {
        best = score;
        form = variant;
      }
    }
  }
  return best > 0 ? { score: best, form } : null;
}

function containsForm(text: string, form: string): boolean {
  if (!form) return false;
  if (form.includes(" ")) return text.includes(form);
  return tokenize(text).includes(form);
}

function docFields(doc: SearchDoc): Record<keyof typeof FIELD_WEIGHTS, string> {
  return {
    title: normalizeText(doc.title),
    tags: normalizeText(doc.tagNames.join(" ")),
    topics: normalizeText(doc.topicNames.join(" ")),
    collections: normalizeText(doc.collectionNames.join(" ")),
    excerpt: normalizeText(doc.excerpt),
    body: normalizeText(doc.body),
  };
}

export function snippetFor(text: string, forms: string[]): Segment[] {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) return [];
  const needles = unique(forms.filter(Boolean)).sort((a, b) => b.length - a.length);
  if (needles.length === 0) return [{ text: source.slice(0, 220), hit: false }];
  const pattern = new RegExp(needles.map(escapeRegExp).join("|"), "ig");
  const match = pattern.exec(source);
  if (!match || match.index === undefined) return [{ text: trimWindow(source, 0, 220), hit: false }];
  const start = Math.max(0, match.index - 80);
  const end = Math.min(source.length, match.index + match[0].length + 120);
  const window = `${start > 0 ? "…" : ""}${source.slice(start, end).trim()}${end < source.length ? "…" : ""}`;
  return splitHits(window, needles);
}

function splitHits(text: string, needles: string[]): Segment[] {
  const pattern = new RegExp(needles.map(escapeRegExp).join("|"), "ig");
  const parts: Segment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: text.slice(cursor, index), hit: false });
    parts.push({ text: match[0], hit: true });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts.filter((part) => part.text.length > 0);
}

function trimWindow(text: string, start: number, length: number): string {
  return text.slice(start, start + length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
