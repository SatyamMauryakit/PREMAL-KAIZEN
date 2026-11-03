# syntax=docker/dockerfile:1
#
# Multi-stage production build for @premal/storefront (Next.js 15 / React 19).
#
# Build:
#   docker build -f apps/storefront/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.example \
#     -t premal-storefront:local .
#   (build context MUST be the monorepo root - pnpm workspace, see apps/api/Dockerfile
#   for why; NEXT_PUBLIC_API_URL is REQUIRED - it gets baked into the client JS bundle
#   at build time, so there is no sane hardcoded default for a production image)
#
# Run:
#   docker run --rm -p 3000:3000 premal-storefront:local

ARG NODE_VERSION=24.21.0

FROM node:${NODE_VERSION}-slim AS base
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
COPY apps/storefront/package.json ./apps/storefront/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Only this build's `next build` runs in standalone mode - see next.config.ts for why
# it's gated (Windows-dev-build EPERM on symlinks); Linux has no such restriction.
ENV NEXT_OUTPUT_STANDALONE=true
RUN pnpm --filter @premal/storefront run build

# ---- runtime: minimal image, non-root ----
FROM node:${NODE_VERSION}-slim AS runtime
# Fixed numeric UID/GID (see apps/api/Dockerfile's comment for the full rationale) -
# this image doesn't itself need persistent storage, but the same fixed ID is used
# across all 3 images for consistency.
RUN groupadd --gid 10001 appuser && useradd --uid 10001 --gid 10001 --no-create-home appuser
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output structure confirmed empirically inside this same Linux build (see
# phase report) - Next's file tracer preserves the monorepo path from the workspace
# root, so server.js ends up at .next/standalone/apps/storefront/server.js, not at
# the app's own .next/standalone/server.js as a single-package project would have.
COPY --from=build --chown=appuser:appuser /app/apps/storefront/.next/standalone ./
COPY --from=build --chown=appuser:appuser /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build --chown=appuser:appuser /app/apps/storefront/public ./apps/storefront/public

USER appuser
WORKDIR /app/apps/storefront
EXPOSE 3000

# No dedicated health route on the frontend apps (confirmed: only the API has one) -
# a plain 200 check against "/" is the documented safe alternative.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/'},(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
