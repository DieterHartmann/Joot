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
# pnpm deploy produces a node_modules tree that still contains the pnpm virtual
# store (.pnpm/). @prisma/client inside that store resolves the generated client
# relative to its own location:
#   .pnpm/@prisma+client@<ver>/node_modules/.prisma/client/
# We must copy the generated .prisma dir to BOTH the root and that nested path.
RUN pnpm --filter @joot/api deploy --prod /deploy && \
    cp -r node_modules/.prisma /deploy/node_modules/.prisma && \
    find /deploy/node_modules/.pnpm -maxdepth 1 -name "@prisma+client*" -type d \
      -exec cp -r node_modules/.prisma {}/node_modules/.prisma \;

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=build /deploy .
EXPOSE 3001
CMD ["node", "dist/index.js"]
