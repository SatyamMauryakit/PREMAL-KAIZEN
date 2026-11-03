# syntax=docker/dockerfile:1
#
# Multi-stage production build for @premal/admin (Next.js 15 / React 19).
#
# Build:
#   docker build -f apps/admin/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.example \
#     -t premal-admin:local .
#   (build context MUST be the monorepo root - see apps/api/Dockerfile for why;
#   NEXT_PUBLIC_API_URL is REQUIRED - it gets baked into the client JS bundle at
#   build time, so there is no sane hardcoded default for a production image)
#
# Run:
#   docker run --rm -p 3001:3001 premal-admin:local

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
ENV NEXT_OUTPUT_STANDALONE=true
RUN pnpm --filter @premal/admin run build

# ---- runtime: minimal image, non-root ----
FROM node:${NODE_VERSION}-slim AS runtime
# Fixed numeric UID/GID (see apps/api/Dockerfile's comment for the full rationale) -
# this image doesn't itself need persistent storage, but the same fixed ID is used
# across all 3 images for consistency.
RUN groupadd --gid 10001 appuser && useradd --uid 10001 --gid 10001 --no-create-home appuser
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Same monorepo-nested standalone layout as the storefront image - see that
# Dockerfile's comment; verified empirically against this same build, not assumed.
COPY --from=build --chown=appuser:appuser /app/apps/admin/.next/standalone ./
COPY --from=build --chown=appuser:appuser /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=appuser:appuser /app/apps/admin/public ./apps/admin/public

USER appuser
WORKDIR /app/apps/admin
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||3001,path:'/'},(r)=>process.exit(r.statusCode===200||r.statusCode===307?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
