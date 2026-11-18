import type { ReactNode } from "react";
import Link from "next/link";
import { editorIdentity } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";

export async function SiteHeader({ current }: { current?: string }) {
  const editor = await editorIdentity();
  const links = [
    ["/", "Archive", "home"],
    ["/explore", "Explore", "explore"],
    ["/topics", "Topics", "topics"],
    ["/collections", "Collections", "collections"],
  ] as const;
  return (
    <header className="site-header">
      <a className="skip" href="#content">Skip to content</a>
      <div className="wrap header-row">
        <Link className="wordmark" href="/">
          <small>Field notes</small>
          <strong>{SITE_NAME}</strong>
        </Link>
        <nav className="nav" aria-label="Primary">
          {links.map(([href, label, id]) => (
            <Link key={href} href={href} aria-current={current === id ? "page" : undefined}>
              {label}
            </Link>
          ))}
          {editor ? <Link href="/admin">Editor</Link> : null}
        </nav>
        <form className="search" action="/explore" method="get" role="search">
          <label className="sr-only" htmlFor="header-q">Search posts</label>
          <input id="header-q" name="q" type="search" placeholder="Search the archive" />
          <button type="submit">Search</button>
        </form>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>Original wording is preserved. Titles, topics, and excerpts are editorial.</p>
        <p>Timestamps are shown in UTC, as recorded in the LinkedIn export.</p>
        <p><a href="/feed.xml">RSS</a></p>
      </div>
    </footer>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
