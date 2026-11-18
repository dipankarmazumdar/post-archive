const URN = /urn:li:(share|ugcPost|groupPost|activity):([0-9A-Za-z_.:-]+)/;

const PREFIX: Record<string, string> = {
  share: "s",
  ugcPost: "u",
  groupPost: "g",
  activity: "r",
};

export type LinkedInLink = {
  urn: string;
  id: string;
  url: string;
};

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export function parseLinkedInPermalink(raw: string | null | undefined): LinkedInLink | null {
  if (!raw) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  let url: URL;
  try {
    url = new URL(decoded);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "www.linkedin.com" && url.hostname !== "linkedin.com") return null;
  if (!url.pathname.startsWith("/feed/update/")) return null;
  const match = URN.exec(decodeURIComponent(url.pathname));
  if (!match) return null;
  const kind = match[1];
  const rawId = match[2];
  if (!rawId || rawId.length > 80) return null;
  const prefix = PREFIX[kind];
  if (!prefix) return null;
  const urn = `urn:li:${kind}:${rawId}`;
  const id = `${prefix}${rawId.replace(/[^0-9A-Za-z-]/g, "")}`;
  if (!/^([sugr])[0-9A-Za-z-]+$/.test(id)) return null;
  url.protocol = "https:";
  url.hostname = "www.linkedin.com";
  url.pathname = `/feed/update/${encodeURIComponent(urn)}`;
  url.search = "";
  url.hash = "";
  return { urn, id, url: url.toString() };
}

export function articlePermalink(filename: string, hrefs: string[]): string | null {
  const slug = filename.replace(/\.html$/i, "");
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const expected = `https://www.linkedin.com/pulse/${slug}`;
  for (const href of hrefs) {
    const safe = safeHttpUrl(href);
    if (!safe) continue;
    let url: URL;
    try {
      url = new URL(safe);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    if (url.hostname !== "www.linkedin.com" && url.hostname !== "linkedin.com") continue;
    url.hash = "";
    url.search = "";
    const path = url.pathname.replace(/\/$/, "");
    if (path === `/pulse/${slug}`) {
      url.hostname = "www.linkedin.com";
      url.protocol = "https:";
      if (url.toString().replace(/\/$/, "") === expected) return expected;
    }
  }
  return null;
}

export function mediaExpiry(url: string): string | null {
  try {
    const value = new URL(url).searchParams.get("e");
    if (!value || !/^\d{10}$/.test(value)) return null;
    const millis = Number(value) * 1000;
    if (!Number.isFinite(millis)) return null;
    return new Date(millis).toISOString();
  } catch {
    return null;
  }
}

export function isDurableMediaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "media.licdn.com" || host === "dms.licdn.com" || host.endsWith(".licdn.com")) return false;
    if (mediaExpiry(url)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isSafeId(id: string): boolean {
  return /^[a-z0-9-]{1,140}$/.test(id);
}
