FROM node:22-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/queue/package.json ./packages/queue/
COPY packages/db/package.json    ./packages/db/
COPY apps/worker/package.json    ./apps/worker/
RUN pnpm install --ignore-scripts

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules                ./node_modules
COPY --from=deps /app/packages/queue/node_modules ./packages/queue/node_modules
COPY --from=deps /app/packages/db/node_modules    ./packages/db/node_modules
COPY --from=deps /app/apps/worker/node_modules    ./apps/worker/node_modules
COPY . .
RUN pnpm --filter @joot/db     generate
RUN pnpm --filter @joot/db     build
RUN pnpm --filter @joot/queue  build
RUN pnpm --filter @joot/worker build
RUN pnpm --filter @joot/worker deploy --prod /deploy && \
    PRISMA_BUILD=$(find /app/node_modules/.pnpm    -maxdepth 1 -name "@prisma+client*" -type d | head -1) && \
    PRISMA_DEPLOY=$(find /deploy/node_modules/.pnpm -maxdepth 1 -name "@prisma+client*" -type d | head -1) && \
    rm -rf   "$PRISMA_DEPLOY/node_modules/.prisma" && \
    cp -r "$PRISMA_BUILD/node_modules/.prisma" "$PRISMA_DEPLOY/node_modules/.prisma"

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=build /deploy .
CMD ["node", "dist/index.js"]
