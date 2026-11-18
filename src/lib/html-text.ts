import { safeHttpUrl } from "./urls";

export type ArticleText = {
  title: string;
  body: string;
  dates: string[];
  images: string[];
  hrefs: string[];
};

export function articleToText(html: string): ArticleText {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => decode(match[1] ?? ""));
  const images = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => safeHttpUrl(decode(match[1] ?? "")))
    .filter((url): url is string => Boolean(url));
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const titleMatch = withoutNoise.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? withoutNoise.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decode(stripTags(titleMatch?.[1] ?? "")).replace(/\s+/g, " ").trim();
  let body = withoutNoise.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_full, attrs: string, inner: string) => {
    const hrefMatch = /href=["']([^"']+)["']/i.exec(attrs);
    const href = hrefMatch ? safeHttpUrl(decode(hrefMatch[1] ?? "")) : null;
    const label = decode(stripTags(inner)).replace(/\s+/g, " ").trim();
    if (!href) return label;
    if (!label || label === href) return href;
    return `${label} (${href})`;
  });
  body = body.replace(/<br\s*\/?>/gi, "\n");
  body = body.replace(/<li[^>]*>/gi, "\n- ");
  body = body.replace(/<\/(p|div|h1|h2|h3|li|pre|blockquote|tr)>/gi, "\n");
  body = decode(stripTags(body));
  body = body
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (title && body.toLowerCase().startsWith(title.toLowerCase())) {
    body = body.slice(title.length).trim();
  }
  const dates = [...new Set([...html.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1] ?? ""))].filter(Boolean).sort();
  return { title, body, dates, images, hrefs };
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function decode(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, digits: string) => safeCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => safeCodePoint(parseInt(hex, 16)));
}

function safeCodePoint(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return "";
  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
}
