FROM node:24-alpine AS base
RUN apk add --no-cache openssl

FROM base AS manifests

WORKDIR /workspace

COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/buyer-web/package.json apps/buyer-web/package.json
COPY apps/supplier-web/package.json apps/supplier-web/package.json
COPY apps/landing-web/package.json apps/landing-web/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/e2e/package.json apps/e2e/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/eds-client/package.json packages/eds-client/package.json
COPY packages/one-c-agent/package.json packages/one-c-agent/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/ui/package.json packages/ui/package.json

FROM manifests AS workspace
# Production images use external Redis; the in-memory Redis compiler is test-only.
# Keep all other dependency lifecycle scripts enabled (Prisma, sharp, etc.).
RUN REDISMS_DISABLE_POSTINSTALL=true npm ci

COPY . .
ARG DEPLOYMENT_PROFILE=pilot
ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:4012/api
ARG NEXT_PUBLIC_BUYER_APP_URL=http://127.0.0.1:3001
ARG NEXT_PUBLIC_SUPPLIER_APP_URL=http://127.0.0.1:3002
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_APPLE_CLIENT_ID=
ARG NEXT_PUBLIC_APPLE_REDIRECT_URI=
ENV DEPLOYMENT_PROFILE=$DEPLOYMENT_PROFILE \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BUYER_APP_URL=$NEXT_PUBLIC_BUYER_APP_URL \
    NEXT_PUBLIC_SUPPLIER_APP_URL=$NEXT_PUBLIC_SUPPLIER_APP_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_APPLE_CLIENT_ID=$NEXT_PUBLIC_APPLE_CLIENT_ID \
    NEXT_PUBLIC_APPLE_REDIRECT_URI=$NEXT_PUBLIC_APPLE_REDIRECT_URI
RUN npm run db:generate

FROM workspace AS unified-build
ARG INTERNAL_API_URL=http://api:4000/api
ENV INTERNAL_API_URL=$INTERNAL_API_URL
RUN npm run build

FROM base AS web
WORKDIR /workspace
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=unified-build /workspace/apps/web/.next/standalone ./
COPY --from=unified-build /workspace/apps/web/public ./apps/web/public
COPY --from=unified-build /workspace/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM workspace AS legacy-build
RUN npm run build:legacy

FROM workspace AS api-build
RUN npm run build --workspace=@marketplace/schemas && npm run build --workspace=@marketplace/api

FROM manifests AS api-dependencies
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN REDISMS_DISABLE_POSTINSTALL=true npm ci --omit=dev --workspace=@marketplace/api --workspace=@marketplace/schemas --include-workspace-root=false

FROM base AS api
WORKDIR /workspace
ENV NODE_ENV=production CHECKPOINT_DISABLE=1
COPY --from=api-dependencies /workspace/node_modules ./node_modules
COPY --from=api-build /workspace/node_modules/.prisma ./node_modules/.prisma
COPY package.json ./package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/schemas/package.json ./packages/schemas/package.json
COPY --from=api-build /workspace/apps/api/dist ./apps/api/dist
COPY --from=api-build /workspace/apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY --from=api-build /workspace/apps/api/prisma/migrations ./apps/api/prisma/migrations
COPY --from=api-build /workspace/packages/schemas/dist ./packages/schemas/dist
COPY --from=api-build /workspace/apps/buyer-web/public ./apps/buyer-web/public
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=@marketplace/api"]

FROM legacy-build AS admin-web
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@marketplace/admin-web"]

FROM legacy-build AS buyer-web
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=@marketplace/buyer-web"]

FROM legacy-build AS supplier-web
EXPOSE 3002
CMD ["npm", "run", "start", "--workspace=@marketplace/supplier-web"]

FROM legacy-build AS landing-web
EXPOSE 3003
CMD ["npm", "run", "start", "--workspace=@marketplace/landing-web"]
