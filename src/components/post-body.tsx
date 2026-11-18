import type { ReactNode } from "react";
import { safeHttpUrl } from "@/lib/urls";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

export function PostBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={index}>{linkify(item)}</li>
        ))}
      </ul>,
    );
  };
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      return;
    }
    if (/^[-•*]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-•*]\s+/, ""));
      return;
    }
    flush();
    blocks.push(<p key={`p-${index}`}>{linkify(trimmed)}</p>);
  });
  flush();
  if (!blocks.length) return <p className="empty">This post has no text in the export.</p>;
  return <div className="post-body">{blocks}</div>;
}

function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const raw = match[0] ?? "";
    const trimmed = raw.replace(/[),.;]+$/g, "");
    const suffix = raw.slice(trimmed.length);
    const safe = safeHttpUrl(trimmed);
    if (safe) {
      parts.push(
        <a key={`${start}-link`} href={safe} rel="noreferrer noopener">
          {trimmed}
        </a>,
      );
    } else {
      parts.push(trimmed);
    }
    if (suffix) parts.push(suffix);
    last = start + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Snippet({ parts }: { parts: { text: string; hit: boolean }[] }) {
  return (
    <p className="excerpt">
      {parts.map((part, index) =>
        part.hit ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
      )}
    </p>
  );
}
