FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable
RUN corepack prepare pnpm@10.33.4 --activate

WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
COPY backend/prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json backend/.prettierrc ./
COPY backend/prisma.config.ts ./prisma.config.ts
COPY backend/src ./src
RUN pnpm build
RUN find dist/generated/prisma -type f -name '*.js' -exec sed -i 's#\.ts#\.js#g' {} +

FROM node:22-alpine AS runtime

WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/backend/generated ./generated
COPY --from=build /app/backend/dist ./dist

EXPOSE 5000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --config prisma.config.ts && node dist/src/main.js"]
