# Build context: repository root (pnpm workspace lockfile lives there).
FROM node:22-slim AS build
# openssl: required by Prisma's query engine, at generate time and at run time.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app
# Lets pnpm rewrite node_modules during the --prod prune below without a TTY to confirm on.
ENV CI=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile --filter backend

COPY apps/backend apps/backend
WORKDIR /app/apps/backend
RUN pnpm build

# Drop the build toolchain (TypeScript, Nest CLI, jest) from what ships. `prisma generate`
# wrote the client into the dependency tree, so re-run it after the prune. The prisma CLI
# itself is a runtime dependency, not a dev one, because MIGRATE_ON_START needs it here.
RUN pnpm install --frozen-lockfile --filter backend --prod && pnpm exec prisma generate

FROM node:22-slim AS runtime
# No corepack here: nothing at run time needs pnpm, and fetching it on boot would make
# startup depend on the npm registry being reachable.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# The pnpm store is content-addressed and symlinked into each package's node_modules, so
# the whole tree has to come across together for the links to resolve.
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/apps/backend/node_modules /app/apps/backend/node_modules
COPY --from=build /app/apps/backend/dist /app/apps/backend/dist
COPY --from=build /app/apps/backend/package.json /app/apps/backend/
COPY --from=build /app/apps/backend/prisma /app/apps/backend/prisma

WORKDIR /app/apps/backend
ENV NODE_ENV=production
# The same image runs the API, the worker or both (PROCESS_ROLE = api | worker | all).
# MIGRATE_ON_START=true is for single-service hosting (the demo); compose runs a migrate service.
ENV PROCESS_ROLE=api
EXPOSE 3000
CMD ["sh", "-c", "if [ \"$MIGRATE_ON_START\" = true ]; then ./node_modules/.bin/prisma migrate deploy; fi && exec node dist/${PROCESS_ROLE}.main.js"]
