# Universal Location Engine

The project is organized into three top-level application folders:

- [`backend/`](backend/README.md) — NestJS API, PostGIS/Prisma schema, migrations, tests, Docker deployment, and monitoring configuration.
- [`admin/`](admin/README.md) — administrator dashboard plan and frontend workspace.
- [`android/`](android/README.md) — Kotlin Android SDK and demo app.

Shared implementation and deployment documentation lives in [`docs/`](docs/).

## Setup and commands

Install workspace dependencies from the repository root:

```bash
pnpm install
```

Backend commands can be run from the root using workspace scripts:

```bash
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
```

Start the local PostGIS and API stack from the root:

```bash
docker compose -f backend/docker-compose.yml up --build
```

Open `android/` in Android Studio for the SDK and sample app. The admin frontend is planned under `admin/`; see its implementation plan.

## Documentation

- [API integration guide](docs/api-guide.md)
- [OpenAPI contract](docs/openapi.yaml)
- [Admin dashboard implementation plan](admin/IMPLEMENTATION_PLAN.md)
- [Android SDK guide](android/README.md)
- [Self-hosting guide](docs/self-hosting.md)
- [Configuration reference](docs/configuration.md)
- [Architecture overview](docs/architecture.md)
- [Implementation status](docs/implementation/STATUS.md)
- [Android build setup](docs/android-setup.md)
- [Realtime protocol contract](docs/realtime.md)
- [Reliable delivery audit](docs/reliability-audit.md)
- [Monitoring and load testing](docs/monitoring.md)
- [Production deployment checklist](docs/production-deployment.md)
