# Plan — Invoice Processing System

Planning artifact written with an AI assistant (Claude Code) before any code, after going through each decision one by one. Kept as-is per the task's "leave AI artifacts in the repo" rule.

## Constraints I set for myself

- **Stack I've used in production**: TypeScript, NestJS, GraphQL, Prisma, PostgreSQL, React, TanStack Query/Table, shadcn/ui, Tailwind.
- **Zero cost**: no paid APIs. AI runs locally (Ollama); the hosted demo uses a free-tier model.
- **Runs with one command** for reviewers, with a mock AI mode when Ollama isn't installed.

## Architecture

```
                 REST upload            GraphQL (queries, mutations, subscriptions over WS)
   Browser  ───────────────────►  API (NestJS)  ◄──────────────────────────────►  Browser
 (Vite+React)                       │   ▲    │
                                    │   │    └─ /mcp  (same assistant tools for MCP clients)
     one transaction:               │   │ LISTEN invoice_status
     INSERT invoice + pgmq.send     ▼   │
                             ┌──────────────────┐
                             │ PostgreSQL       │  invoices table, pgmq queue,
                             │  + pgmq          │  trigger → pg_notify on status change
                             └──────────────────┘
                                    ▲   │ pgmq.read (visibility timeout)
                                    │   ▼
                             Worker (NestJS app context)
                               claim (conditional UPDATE) → get text (unpdf / tesseract.js)
                               → LLM structured output → validate (zod) → save
                                    │
                             Storage port: local volume | S3-compatible (Supabase Storage)
                             LLM port:     Ollama | Gemini (demo) | Mock (tests)
```

## Key decisions (short version)

| # | Decision | Why |
|---|---|---|
| D1 | **API + separate worker** process, one DB, one codebase | Slow CPU-bound work must not block the API event loop; jobs must survive crashes; scale workers independently |
| D2 | **pgmq** (Postgres queue, = Supabase Queues) instead of SQS | Same semantics as SQS (visibility timeout, receive count, delete/archive), but enqueue is in the **same transaction** as the invoice insert → no dual-write problem, no extra infra |
| D3 | Explicit **state machine** `uploaded → processing → completed/failed`, retry `failed → uploaded` | Worker claims via atomic conditional UPDATE with a lease (idempotent under at-least-once delivery); transient errors retried with backoff, permanent ones fail fast; DLQ for poison messages |
| D4 | **GraphQL subscriptions**, fed by a Postgres **trigger + LISTEN/NOTIFY** | Every status change emits an event no matter who made it; NOTIFY fires only on commit; works across API instances; clients resync on reconnect (events are hints, DB is truth) |
| D5 | **Storage port**: local volume (default) / S3-compatible (demo); upload via one REST endpoint | GraphQL multipart is discouraged (CSRF); file type checked by magic bytes; storage keys never use user filenames |
| D6 | **Text first, then LLM**: unpdf / tesseract.js OCR → Ollama structured JSON → zod + arithmetic sanity checks | Small, debuggable AI step; raw text stored; inconsistencies shown as warnings |
| D7 | **Tool-calling assistant** over application services (no text-to-SQL); destructive tools need a human click; same tools exposed via **MCP** | Business rules can't be bypassed; prompt injection from invoice text can't execute destructive actions |
| D8 | **Vite SPA**, TanStack Router/Query/Table, codegen-typed GraphQL, `graphql-ws` | No SSR/SEO need; explicit cache updates; one data layer for REST + GraphQL |
| D9 | pnpm monorepo, Jest/Vitest focused on risky logic (claim race, transactions, state machine, AI safety gate) | Tests where bugs hurt |
| D10 | Free demo: Supabase (DB + queue + files), Render (API+worker in one process), Vercel (web), Gemini free tier; access code | Same code, different adapters via env vars |

## Milestones

1. Monorepo scaffold, Prisma schema, pgmq + trigger migrations, docker compose
2. Backend core: upload → queue → worker → extraction → state machine → retry
3. Real-time: NOTIFY → GraphQL subscriptions
4. Frontend: list, upload, detail, live updates, retry, edit fields
5. AI assistant (tools, confirmation, MCP endpoint)
6. Tests, sample invoices, README
7. Demo deployment
