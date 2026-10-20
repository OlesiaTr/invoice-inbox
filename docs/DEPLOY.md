# Deploying the public demo (free tiers)

| Piece | Service (free) | Notes |
|---|---|---|
| Database + queue | **Supabase** Postgres + pgmq ("Supabase Queues") | Same migrations as local |
| Files | **Supabase Storage** via its S3 endpoint | `STORAGE_DRIVER=s3` |
| API + worker | **Render** web service (Docker) | One process: `PROCESS_ROLE=all` |
| Frontend | **Vercel** (static Vite build) | `VITE_API_URL` points at Render |
| AI | **Gemini** free tier (Google AI Studio key) | `LLM_DRIVER=gemini` |

Only configuration differs from the local setup: adapters (`LLM_DRIVER`, `STORAGE_DRIVER`) and process layout (`PROCESS_ROLE`). The code is the same.

**Known trade-offs of the free demo:**
- **API and worker share one instance**, because free tiers don't include background workers. Locally and in a real deployment they run separately.
- **The instance sleeps after ~15 min idle.** The first request then takes about a minute. Jobs queued meanwhile wait safely in Postgres.
- **Gemini's free tier may use prompts to improve Google's products.** Use only the sample invoices in the demo.
- **Gemini's free tier is often overloaded** (503 "high demand"). The adapter retries once, then falls back to `GEMINI_FALLBACK_MODELS` (default `gemini-flash-lite-latest`); the queue retries extraction with backoff.
- **The Supabase project pauses after 7 days of inactivity.** Open the demo shortly before sending the link.

## 1. Supabase

1. Create a project (an EU region is fine) and note the database password.
2. **Enable the queue extension** in the SQL Editor: `create extension if not exists pgmq;`
   (The dashboard's Extensions toggle failed with `schema "pgmq" does not exist`; plain SQL works. The migration also tries `CREATE EXTENSION pgmq` itself.)
3. **Get the connection strings:** Connect → *ORMs / Prisma*.
   - `DATABASE_URL` is the **transaction pooler** (port 6543). Append `?pgbouncer=true&connection_limit=5`.
     Without `pgbouncer=true`, Prisma's named prepared statements collide on shared pooled connections (`prepared statement "s0" already exists`).
   - `DIRECT_URL` is the **session pooler** (port 5432 on the pooler host). Migrations and `LISTEN` need a session connection, which the transaction pooler can't hold.
   - Not the "Direct connection": on the free tier it's IPv6-only, which Render can't reach.
   - Use a password with only letters and digits, or URL-encode it: special characters break the connection string.
4. **Set up Storage:**
   1. Create a **private** bucket named `invoices`.
   2. Storage → Settings → **S3 connection**: enable it and copy the endpoint (`https://<ref>.supabase.co/storage/v1/s3`) and the region.
   3. Create an **S3 access key**, which gives you the access key id and secret.

## 2. Gemini key

Go to https://aistudio.google.com/apikey and click **Create API key**. No card is needed.

## 3. Repository access for Render and Vercel

Render and Vercel connect to a repository you own. If you are working from a fork or mirror, point a remote at your own copy:

```bash
git remote add mirror git@github.com:<you>/invoice-inbox.git
git push mirror master
```

## 4. Render (API + worker)

1. **New → Blueprint**, then pick the mirror repo. Render reads [`render.yaml`](../render.yaml).
2. **Fill in the secrets:**
   - `DATABASE_URL`, `DIRECT_URL`
   - `GEMINI_API_KEY`
   - `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - `ACCESS_CODE`: any shared code you'll send along with the link
   - `CORS_ORIGIN`: fill this in after step 5
3. **Deploy.** Migrations run on start (`MIGRATE_ON_START=true`).
4. **Check it:** `https://<service>.onrender.com/api/health` should return `{"ok":true}`.

## 5. Vercel (frontend)

1. **Add New → Project**, then pick the mirror repo.
2. Set **Root Directory** to `apps/web`. The framework preset (Vite) is detected automatically.
   Ignore Vercel's "multi-service project" suggestion: the backend runs on Render, because it needs a long-running process (worker, `LISTEN`, WebSockets).
3. Add the environment variable `VITE_API_URL=https://<service>.onrender.com`.
4. **Deploy.**
5. Back in Render, set `CORS_ORIGIN=https://<project>.vercel.app` and redeploy.

**Gotcha:** on the Hobby plan, Vercel only deploys commits whose author email belongs to your GitHub account. Add the commit email under GitHub → Settings → Emails if a deployment is "blocked".

## 6. Smoke test

1. Open the Vercel URL and enter the access code.
2. Upload `samples/acme-cloud-INV-2026-0042.pdf`. It should go Queued → Processing → Completed without a refresh.
3. Ask the assistant: "Which invoices failed?"

**MCP against the demo:**

```bash
claude mcp add --transport http invoices https://<service>.onrender.com/mcp --header "x-access-code: <code>"
```
