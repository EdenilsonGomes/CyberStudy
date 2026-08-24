FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.pnpm/postgres@3.4.9/node_modules/postgres ./node_modules/postgres
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.pnpm/@napi-rs+canvas@0.1.80/node_modules/@napi-rs/canvas ./node_modules/@napi-rs/canvas
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.pnpm/@napi-rs+canvas-linux-x64-gnu@0.1.80/node_modules/@napi-rs/canvas-linux-x64-gnu ./node_modules/@napi-rs/canvas-linux-x64-gnu
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
USER nextjs
EXPOSE 3000
CMD ["sh","-c","node scripts/migrate.mjs && node server.js"]
