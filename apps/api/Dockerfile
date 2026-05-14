FROM node:22-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --ignore-scripts

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @joot/db generate
RUN pnpm --filter @joot/db build
RUN pnpm --filter @joot/api build
# pnpm deploy downloads fresh packages into /deploy, including a fresh @prisma/client
# stub (no generated client). prisma generate (run earlier) writes its output relative
# to the schema's package root, which is packages/db — so the generated client lands at
# /app/packages/db/node_modules/.prisma/client/.
# Copy that into both the root of /deploy/node_modules and into the @prisma/client
# directory inside the deploy virtual store, which is where @prisma/client resolves from.
RUN pnpm --filter @joot/api deploy --prod /deploy && \
    PRISMA_DEPLOY=$(find /deploy/node_modules/.pnpm -maxdepth 1 -name "@prisma+client*" -type d | head -1) && \
    cp -r /app/packages/db/node_modules/.prisma /deploy/node_modules/.prisma && \
    cp -r /app/packages/db/node_modules/.prisma "$PRISMA_DEPLOY/node_modules/.prisma"

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=build /deploy .
EXPOSE 3001
CMD ["node", "dist/index.js"]
