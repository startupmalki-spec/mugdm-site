# Scripts

## RAG corpus ingestion

`scripts/ingest-rag-corpus.ts` reads Markdown files under `corpus/<source>/`,
chunks them, embeds each chunk with Voyage AI, and upserts into the
`rag_documents` pgvector table. It is idempotent — re-running updates
existing rows on `(source_type, source_id, chunk_index)`.

Supported source directories (fixed mapping):

| Directory      | `source_type` stored |
| -------------- | -------------------- |
| `corpus/zatca` | `zatca_reg`          |
| `corpus/gosi`  | `gosi_reg`           |
| `corpus/socpa` | `socpa`              |

`README.md` files inside each source directory are skipped — they are for
humans and are not ingested.

### Required environment

```
VOYAGE_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...          # admin key; keep secret
# Optional
VOYAGE_MODEL=voyage-3                  # default
```

### Run

Dry run (no Voyage or Supabase calls; just lists the files it would
ingest):

```
npx tsx scripts/ingest-rag-corpus.ts --dry
```

Live ingest:

```
npx tsx scripts/ingest-rag-corpus.ts
```

Expected output (dry run):

```
[rag-ingest] corpus root: .../corpus
[rag-ingest] mode: DRY RUN
[rag-ingest] discovered N file(s):
  - [zatca_reg] zatca/vat-basics.md (source_id=vat-basics)
  ...
[rag-ingest] planned zatca/vat-basics.md: 1 chunk(s)
[rag-ingest] done. files: N ok / 0 failed, total chunks: N
```

### Adding new content

1. Drop a new `.md` file into `corpus/zatca/`, `corpus/gosi/`, or
   `corpus/socpa/`. Keep entries short and cite the source URL.
2. Re-run the CLI. The `source_id` is the filename without the
   extension, so renaming a file creates a new document row — prefer
   stable names.

Do **not** copy full regulation text into these files. Use short
publicly-summarised notes with prominent "Source:" citation links.
