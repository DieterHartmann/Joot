FROM node:22-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/queue/package.json ./packages/queue/
COPY apps/worker/package.json    ./apps/worker/
RUN pnpm install --ignore-scripts

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules           ./node_modules
COPY --from=deps /app/packages/queue/node_modules ./packages/queue/node_modules
COPY --from=deps /app/apps/worker/node_modules    ./apps/worker/node_modules
COPY . .
RUN pnpm --filter @joot/queue  build
RUN pnpm --filter @joot/worker build
RUN pnpm --filter @joot/worker deploy --prod /deploy

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=build /deploy .
CMD ["node", "dist/index.js"]
