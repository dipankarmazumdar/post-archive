import type { Metadata } from "next";
import Link from "next/link";
import { editorIdentity } from "@/lib/auth";

export const metadata: Metadata = { title: "Editor", robots: { index: false, follow: false } };

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/posts", "Posts"],
  ["/admin/imports", "Imports"],
  ["/admin/review", "Review"],
  ["/admin/topics", "Topics"],
  ["/admin/tags", "Tags"],
  ["/admin/collections", "Collections"],
  ["/admin/start-here", "Start here"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const editor = await editorIdentity();
  if (!editor) {
    return (
      <div className="empty">
        <h1>Editor sign-in required</h1>
        <p>The public archive does not include drafts. Sign in with an allowed account to curate posts.</p>
      </div>
    );
  }
  return (
    <div className="admin">
      <nav aria-label="Editor">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </nav>
      <div>
        {editor.simulated ? (
          <p className="banner">Local preview uses a simulated editor, Dev Viewer. This is not a verified sign-in.</p>
        ) : null}
        {editor.stage === "preview" ? (
          <p className="banner">This preview is read-only so it cannot change the archive.</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
