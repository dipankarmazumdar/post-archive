create table if not exists topics (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order integer not null
);

create table if not exists tags (
  slug text primary key,
  name text not null,
  description text not null default ''
);

create table if not exists tag_aliases (
  alias text primary key,
  tag_slug text not null references tags (slug)
);

create table if not exists posts (
  id text primary key,
  external_key text not null unique,
  source text not null,
  posted_at timestamptz not null,
  posted_at_precision text not null default 'minute' check (posted_at_precision in ('minute', 'day')),
  body text not null,
  content_hash text not null,
  linkedin_url text,
  shared_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  suggested_title text,
  suggested_excerpt text,
  suggested_post_type text,
  suggested_primary_topic text,
  suggestion_ambiguous boolean not null default false,
  suggestion_note text,
  editorial_title text,
  editorial_excerpt text,
  title_locked boolean not null default false,
  excerpt_locked boolean not null default false,
  post_type text,
  post_type_locked boolean not null default false,
  primary_topic_slug text references topics (slug),
  primary_topic_locked boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_import_id text
);

create index if not exists posts_status_posted_idx on posts (status, posted_at desc);
create index if not exists posts_topic_idx on posts (primary_topic_slug);

create table if not exists post_topics (
  post_id text not null references posts (id) on delete cascade,
  topic_slug text not null references topics (slug),
  relation text not null check (relation in ('primary', 'secondary')),
  origin text not null check (origin in ('suggested', 'editorial')),
  primary key (post_id, topic_slug)
);

create table if not exists post_tags (
  post_id text not null references posts (id) on delete cascade,
  tag_slug text not null references tags (slug),
  origin text not null check (origin in ('suggested', 'editorial')),
  primary key (post_id, tag_slug)
);

create table if not exists post_tag_rejections (
  post_id text not null references posts (id) on delete cascade,
  tag_slug text not null references tags (slug),
  primary key (post_id, tag_slug)
);

create table if not exists post_media (
  id text primary key,
  post_id text not null references posts (id) on delete cascade,
  url text not null,
  association text not null check (association in ('direct', 'inferred')),
  approved boolean not null default false,
  durable boolean not null default false,
  expires_at timestamptz,
  alt_text text,
  unique (post_id, url)
);

create table if not exists collections (
  slug text primary key,
  title text not null,
  description text not null,
  sort_order integer not null,
  curation_locked boolean not null default false
);

create table if not exists collection_posts (
  collection_slug text not null references collections (slug) on delete cascade,
  post_id text not null references posts (id) on delete cascade,
  position integer not null,
  origin text not null check (origin in ('suggested', 'editorial')),
  primary key (collection_slug, post_id)
);

create table if not exists collection_exclusions (
  collection_slug text not null references collections (slug) on delete cascade,
  post_id text not null references posts (id) on delete cascade,
  primary key (collection_slug, post_id)
);

create table if not exists recommendation_overrides (
  post_id text not null references posts (id) on delete cascade,
  related_post_id text not null references posts (id) on delete cascade,
  pinned boolean not null default false,
  removed boolean not null default false,
  primary key (post_id, related_post_id)
);

create table if not exists start_here (
  post_id text primary key references posts (id) on delete cascade,
  position integer not null,
  note text not null default ''
);

create table if not exists topic_starts (
  topic_slug text not null references topics (slug) on delete cascade,
  post_id text not null references posts (id) on delete cascade,
  position integer not null,
  primary key (topic_slug, post_id)
);

create table if not exists import_runs (
  id text primary key,
  mode text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats text not null default '{}',
  message text
);

create table if not exists review_items (
  id text primary key,
  import_run_id text,
  kind text not null,
  external_key text,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  detail text not null default '{}'
);

insert into topics (slug, name, description, sort_order) values
  ('apache-iceberg', 'Apache Iceberg', 'Table-format internals: snapshots, manifests, Puffin files, deletion vectors, statistics, and the REST catalog.', 1),
  ('open-lakehouse', 'Open Lakehouse', 'How Iceberg, Hudi, and Delta Lake show up in an open lakehouse, including architecture and comparisons.', 2),
  ('data-engineering', 'Data Engineering', 'Spark, Parquet, Trino, DuckDB, and the practical work of building a data platform.', 3),
  ('streaming', 'Streaming', 'Flink, Kafka, change data capture, and checkpointing into lakehouse tables.', 4),
  ('ai-agents', 'AI Agents & MCP', 'Agents, tool use, and the Model Context Protocol in data platforms.', 5),
  ('developer-tooling', 'Developer Tooling', 'A smaller shelf of notes on SDKs, APIs, and the tools used to build and operate these systems.', 6)
on conflict (slug) do nothing;

insert into tags (slug, name, description) values
  ('puffin', 'Puffin', 'Iceberg’s Puffin file format for statistics and sketches.'),
  ('deletion-vectors', 'Deletion vectors', 'Row-level deletes stored as deletion vectors.'),
  ('rest-catalog', 'REST Catalog', 'The Iceberg REST catalog API.'),
  ('pyiceberg', 'PyIceberg', 'The Python implementation of Iceberg.'),
  ('spark', 'Spark', 'Apache Spark.'),
  ('flink', 'Flink', 'Apache Flink.'),
  ('kafka', 'Kafka', 'Apache Kafka.'),
  ('cdc', 'CDC', 'Change data capture.'),
  ('compaction', 'Compaction', 'Rewriting small files into a healthier layout.'),
  ('snapshots', 'Snapshots', 'Iceberg snapshot metadata.'),
  ('manifests', 'Manifests', 'Manifests and manifest lists.'),
  ('merge-on-read', 'Merge-on-read', 'Merge-on-read deletes and updates.'),
  ('copy-on-write', 'Copy-on-write', 'Copy-on-write deletes and updates.'),
  ('partitioning', 'Partitioning', 'Partition layout, including hidden partitioning.'),
  ('clustering', 'Clustering', 'Clustering and sort order.'),
  ('statistics', 'Statistics', 'Column statistics used for planning.'),
  ('sketches', 'Sketches', 'Sketches such as Theta sketches stored for approximate answers.'),
  ('bloom-filters', 'Bloom filters', 'Bloom filters used to skip files.'),
  ('trino', 'Trino', 'Trino query engine.'),
  ('duckdb', 'DuckDB', 'DuckDB.'),
  ('parquet', 'Parquet', 'Apache Parquet.'),
  ('polaris', 'Polaris', 'Apache Polaris catalog.'),
  ('nessie', 'Nessie', 'Project Nessie.'),
  ('datafusion', 'DataFusion', 'Apache DataFusion.'),
  ('schema-evolution', 'Schema evolution', 'Evolving table schema safely.'),
  ('time-travel', 'Time travel', 'Reading a table at an older snapshot.'),
  ('mcp', 'MCP', 'Model Context Protocol.'),
  ('agents', 'Agents', 'AI agents and tool use.'),
  ('delta-lake', 'Delta Lake', 'Delta Lake table format.'),
  ('hudi', 'Hudi', 'Apache Hudi.'),
  ('apache-arrow', 'Apache Arrow', 'Apache Arrow.'),
  ('streaming', 'Streaming', 'Streaming ingestion and processing.'),
  ('dremio', 'Dremio', 'Dremio and its lakehouse engine.')
on conflict (slug) do nothing;

insert into collections (slug, title, description, sort_order) values
  ('iceberg-internals', 'Iceberg Internals', 'A path through snapshots and manifests, what Puffin stores, how statistics and sketches are used, and how deletion vectors change reads.', 1),
  ('lakehouse-fast', 'Keeping Your Lakehouse Fast', 'Partitioning, clustering, compaction, and statistics — the levers that keep queries from scanning everything.', 2),
  ('ai-agents', 'AI Agents in Data Platforms', 'From early notes on agents to posts about MCP and tool use beside the lakehouse.', 3),
  ('streaming-lakehouse', 'Streaming into the Lakehouse', 'CDC and Kafka, then Flink, then how streaming writes land in Iceberg tables.', 4)
on conflict (slug) do nothing;
