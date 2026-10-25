# Backend

This folder contains the NestJS backend application, PostgreSQL/PostGIS schema and migrations, tests, load scripts, monitoring assets, and Docker deployment files.

Run backend scripts from the repository root with `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e`. Start local services with `docker compose -f backend/docker-compose.yml up --build`.

Copy `backend/.env.example` to `backend/.env` and provide local values before starting the API. The root `pnpm-lock.yaml` and `pnpm-workspace.yaml` manage shared workspace dependencies.
