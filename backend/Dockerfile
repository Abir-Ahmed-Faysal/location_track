FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
RUN pnpm install --filter @ule/backend... --frozen-lockfile
WORKDIR /app/backend
RUN pnpm exec prisma generate

COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json backend/.prettierrc ./
COPY backend/prisma.config.ts ./prisma.config.ts
COPY backend/src ./src
RUN pnpm build
RUN find dist/generated/prisma -type f -name '*.js' -exec sed -i 's#\.ts#\.js#g' {} +

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=build /app/backend/generated ./backend/generated
COPY --from=build /app/backend/dist ./backend/dist

EXPOSE 3000
CMD ["sh", "-c", "cd backend && ./node_modules/.bin/prisma migrate deploy --config prisma.config.ts && node dist/src/main.js"]
