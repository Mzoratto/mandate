FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN pnpm install --filter @mandate/dashboard --frozen-lockfile
COPY apps/dashboard apps/dashboard
RUN pnpm --filter @mandate/dashboard build

FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1@sha256:46d6625e68cbbdd2efab4a20245977664513f13ffef47915b000d431adcea0b4 /lambda-adapter /opt/extensions/lambda-adapter
ENV NODE_ENV=production PORT=8080 AWS_LWA_PORT=8080 AWS_LWA_ASYNC_INIT=true AWS_LWA_ENABLE_COMPRESSION=true
COPY --from=build /app/apps/dashboard/.next/standalone /app
COPY --from=build /app/apps/dashboard/.next/static /app/apps/dashboard/.next/static
COPY --from=build /app/apps/dashboard/public /app/apps/dashboard/public
COPY --from=build /app/apps/dashboard/src/components/agent/shaders /app/apps/dashboard/src/components/agent/shaders
WORKDIR /app/apps/dashboard
USER node
CMD ["node", "server.js"]
