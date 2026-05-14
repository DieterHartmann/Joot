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
# stub. Re-running prisma generate from within /deploy lets Prisma find @prisma/client
# in the deployed node_modules and write the generated client to exactly the right
# path — no manual path-finding needed. Uses the build-stage prisma binary.
RUN pnpm --filter @joot/api deploy --prod /deploy && \
    cd /deploy && \
    /app/node_modules/.bin/prisma generate --schema /app/packages/db/prisma/schema.prisma

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=build /deploy .
EXPOSE 3001
CMD ["node", "dist/index.js"]
