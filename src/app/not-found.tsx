import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <h1>That page is not in the archive</h1>
      <p>The post may be unpublished, hidden, or the address may be wrong.</p>
      <p><Link href="/explore">Browse published posts</Link></p>
    </div>
  );
}
