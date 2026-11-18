import Link from "next/link";
import { formatPosted } from "@/lib/format";
import type { PublicPost } from "@/lib/public";
import { Snippet } from "./post-body";

export function PostCard({
  post,
  snippet,
}: {
  post: PublicPost;
  snippet?: { text: string; hit: boolean }[] | null;
}) {
  return (
    <article className="post-card">
      <p className="meta">
        {formatPosted(post.postedAt, post.postedAtPrecision)} · {post.postTypeLabel}
        {post.primaryTopic ? ` · ${post.primaryTopic.name}` : ""}
      </p>
      <h3><Link href={`/posts/${post.id}`}>{post.title}</Link></h3>
      {snippet && snippet.length ? <Snippet parts={snippet} /> : <p className="excerpt">{post.excerpt}</p>}
      <div className="pills">
        {post.tags.slice(0, 4).map((tag) => (
          <Link key={tag.slug} className="pill" href={`/explore?q=${encodeURIComponent(tag.name)}`}>
            {tag.name}
          </Link>
        ))}
      </div>
    </article>
  );
}
