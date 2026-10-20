# Build context: repository root (pnpm workspace lockfile lives there).
FROM node:22-slim
# openssl: required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile --filter backend

COPY apps/backend apps/backend
WORKDIR /app/apps/backend
RUN pnpm exec prisma generate && pnpm build

ENV NODE_ENV=production
# The same image runs the API, the worker or both (PROCESS_ROLE picks the entry point).
ENV PROCESS_ROLE=api
EXPOSE 3000
CMD ["sh", "-c", "exec node dist/${PROCESS_ROLE}.main.js"]
