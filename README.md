# Dipankar Mazumdar — Post Archive

A reading archive of Dipankar Mazumdar’s LinkedIn posts, with a private editor for imports, taxonomy, collections, and publishing. Public pages show only posts whose status is `published`. Everything imported from LinkedIn starts as a draft.

## What the export supports

The importer reads three kinds of entries and ignores the rest of the ZIP (messages, connections, profile, ads, jobs, reactions, and other account files are not parsed):

| File | Rows | What it is | Used for |
| --- | --- | --- | --- |
| `Shares.csv` | 1,255 (1,252 unique) | Authored posts and shares, 2011-08-29 through 2026-11-16 | The archive |
| `Articles/Articles/*.html` | 2 | LinkedIn articles (2020-02-13 and 2020-04-22) | The archive |
| `Rich_Media.csv` | 86 | Photo-upload notes, 38 with a media link | Unapproved attachments only when a caption matches one post |
| `InstantReposts.csv` | 162 | Date and link only, 2023-10-09 through 2026-11-13 | Counted, then skipped. There is no commentary field |

`Shares.csv` columns: `Date`, `ShareLink`, `ShareCommentary`, `SharedUrl`, `MediaUrl`, `Visibility`.

- `ShareLink` is a `https://www.linkedin.com/feed/update/urn:li:…` permalink on every row. That is the only LinkedIn URL stored for a share. Article pages use a `/pulse/…` link only when that exact URL is in the HTML.
- `ShareCommentary` is present on 1,196 rows and empty on 59. In this export each line of a commentary is wrapped in quotes before the CSV field is written, so a normal parse leaves a quote at the end of the first line and a `""` line where the paragraph broke. The importer removes that wrapping. Quotation marks inside a sentence stay. Paragraph breaks stay. 43 short posts have no wrapping and are stored unchanged.
- `SharedUrl` is present on 50 rows (an external link in the post, not the post’s permalink). `MediaUrl` is present on 14 rows.
- There are no like, comment, impression, or other engagement columns. `Reactions.csv` is outbound reactions and is not read. The site does not show engagement labels.
- Three share URNs were duplicated. Each pair had the same text and differed only by whether a media URL was filled in. Those rows are merged. Conflicting duplicates are not imported; they go to the private review queue.
- Rich-media captions in this export did not confidently match a single post, so none were attached. LinkedIn CDN links in the file are signed and expire (this export’s links expire between 23 Nov 2026 and 3 Dec 2026 UTC). They are never shown unless an editor approves a still-valid URL.
- Direct media on a share, and images inside the two articles, are stored unapproved.

This import created **1,254 drafts**. Re-running it reports 1,254 unchanged and does not publish or delete anything.

## Stack

- Next.js and TypeScript.
- Editorial data lives in Postgres when `DATABASE_URL` is set (the published app declares one in `cursor-app.json`). The host creates that database and keeps it across redeploys. Migrations run at the end of `npm run build`.
- With `DATABASE_URL` unset, the same schema runs in a file-backed PGlite database at `data/pglite`. That directory is gitignored. The ZIP is never copied into the repo, the database dump, or the deployment.
- Search is an in-process index over the posts loaded for that request. The archive is about a thousand posts, so it does not need a separate search service, an LLM, or a paid API. Tokens are not stemmed, so names such as PyIceberg, Puffin, and MCP stay intact. Quoted text is an exact phrase. Unquoted queries expand curated aliases (`DV` / deletion vectors, `CDC` / change data capture, `MCP` / Model Context Protocol, REST catalog, checkpointing, PyIceberg, MOR, COW). Title and tag matches rank above a passing mention in the body.
- The admin area checks the signed-in viewer on the server. Locally, with no Cursor app id set, that viewer is the simulated Dev Viewer in `cursor/identity.dev.js`, not a verified sign-in. Preview sessions are read-only.

## Local setup

```bash
npm install
cp .env.example .env.local
```

If your shell already has `DATABASE_URL` pointed at some other database, unset it so local commands use PGlite:

```bash
env -u DATABASE_URL npm run dev
```

Open http://localhost:3000. The editor is at http://localhost:3000/admin.

## Imports

Dry run (no writes):

```bash
npm run import -- --zip /absolute/path/to/Complete_LinkedInDataExport.zip --dry-run
```

Apply from the command line. New posts stay drafts on this path. An older or partial ZIP does not unpublish or delete posts that are missing from it. Locked titles, excerpts, topics, post types, tag rejections, collection exclusions, and publish status are kept. Stop the local server first. PGlite keeps the database open in that one process, and a second writer can damage the files.

```bash
npm run import -- --zip /absolute/path/to/Complete_LinkedInDataExport.zip --apply
```

Regenerate suggested titles, excerpts, topics, and tags without touching locked fields:

```bash
npm run suggest
```

Copy the editorial database into a JSON bundle the deployed editor can upsert. The file stays under `data/`, which is gitignored.

```bash
npm run export-bundle -- --out data/archive.bundle.json
```

After the app is deployed, open Editor → Imports and upload the LinkedIn export ZIP there. Posts that are not already in the archive are added and published. Posts already stored keep their edits and status, including hidden posts. The ZIP is read in that request and is not saved. Messages, connections, and other private files in the export are ignored. The upload limit is 100 MB.

You can still upload a JSON bundle from Admin → Imports when you want to copy editorial rows produced by `npm run export-bundle`. To load a hosted database from your own machine instead, set `DATABASE_URL` for that command only. Do not commit it.

## Checks

```bash
npm test
npm run typecheck
npm run verify:flow
npm run build
```

`npm run verify:flow` publishes one imported draft, checks that public search, RSS, and the sitemap include it, hides it, then restores that row to draft. It refuses to run if any post is already published. The archive stays in draft.

`npm test` covers repeat imports, preservation of an edited title and published status, a partial import that must not unpublish, exclusion of draft and hidden posts from public search and the RSS feed, unsafe ZIP paths, symlinks, oversized entries, private files such as `messages.csv`, quoted phrases, and alias search.

## Deployment

`npm run build` runs the Next.js build and then `node scripts/migrate.mjs`. The migration script does nothing when `DATABASE_URL` is unset. On Cursor hosting, the app’s Postgres database is created from `cursor-app.json` and `migrations/`. Editorial rows stay in that database across redeploys. The ZIP does not.

Set `SITE_URL` to the public origin with no trailing slash so canonical URLs, the sitemap, and the RSS feed (`/feed.xml`) use the right host. Set `EDITOR_EMAILS` to a comma-separated list if more than one signed-in person can open the app and only some of them should edit.

Cursor hosting for this account does not offer a public link. When you confirm publishing, choose private (only you, signed in) or team if that choice is offered. The reading pages are still separate from the editor: drafts, hidden posts, review items, and the raw export are not rendered there.

## Archive shape after import

Suggestions, not final editorial decisions:

- Primary topic: Open Lakehouse 404, Apache Iceberg 309, Streaming 77, Data Engineering 68, AI Agents 35, Developer Tooling 4, none 357. Iceberg is also a secondary topic on 328 posts, so the Iceberg topic page includes comparison posts once they are published.
- Post type: technical deep dive 646, commentary 519, talk or event 78, project update 9, article 2.
- Collections, in a fixed order, with drafts included until you publish: Iceberg Internals (16), Keeping Your Lakehouse Fast (14), AI Agents in Data Platforms (16), Streaming into the Lakehouse (12). Puffin posts are on the Iceberg Internals path, between snapshot/manifest posts and statistics, sketches, and deletion vectors.
- 422 posts are flagged `suggestion_ambiguous` (usually because no topic cleared the threshold, including the 59 empty-text posts). They are listed in the editor, not on the public site.

Search against the imported drafts (these posts are not public until you publish them):

| Query | Result |
| --- | --- |
| Puffin | 27 posts, strongest matches in the title |
| Iceberg REST catalog | 18 posts |
| Flink checkpointing | 19 posts containing both ideas. The exact quoted phrase has **no** hits |
| agent isolation | 6 posts containing both words. The exact quoted phrase has **no** hits |
| DV | 17 posts via the deletion-vectors alias |
| PyIceberg | 26 posts |
| MCP | 13 posts. Other agent posts do not match on the topic name alone |

## Publishing a post

In the editor, open a draft, edit the title and excerpt if you want (saving locks those fields against later suggestion runs), then choose Publish. Hide removes it from pages, search, collections, recommendations, the sitemap, and the RSS feed. Returning it to draft does the same. Related reading appears only when another published post shares a specific tag; otherwise the section is omitted.
