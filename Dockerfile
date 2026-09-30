FROM node:24-alpine AS workspace

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

FROM unified-build AS web
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@marketplace/web"]

FROM workspace AS legacy-build
RUN npm run build:legacy

FROM workspace AS api-build
RUN npm run build --workspace=@marketplace/schemas && npm run build --workspace=@marketplace/api

FROM api-build AS api
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
