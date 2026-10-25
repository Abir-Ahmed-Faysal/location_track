# Universal Location Engine â€” Agent Implementation Rules

> **MANDATORY READING.** The AI agent must read and follow these rules before writing any code.
> Violations of these rules are implementation defects.

---

## 1. General Principles

### 1.1 Never fabricate results

- Report test outcomes as `PASS`, `FAIL`, `NOT RUN`, or `BLOCKED`
- Never claim a test passed unless it was actually executed and its output recorded
- Never claim performance numbers without a documented benchmark run
- If something was not tested, say "Not measured" â€” never "Estimated" or "Approximately"

### 1.2 One phase at a time

- Complete the current phase's exit gate checklist before starting the next
- Do not skip ahead to implement features from later phases
- If a phase is blocked, document the blocker in `STATUS.md` and stop

### 1.3 Preserve existing working code

- Do not delete or destructively modify files without explicit approval
- Do not reset the database or drop tables without verifying the environment first
- Do not assume previous implementation plans were executed â€” inspect the actual code
- Preserve all existing comments and docstrings unrelated to your changes

### 1.4 Read before writing

- Read `PLAN.md` to understand the current phase's deliverables
- Read `STATUS.md` to understand what has already been done
- Read existing code in the target file/module before modifying it
- Inspect Git status before making changes

---

## 2. Architecture Rules

### 2.1 Core domain independence

The `backend/src/core/` directory must contain **zero** NestJS imports, **zero** Prisma imports, and **zero** HTTP/transport-specific code. It defines:
- Domain types and value objects
- Port interfaces (abstract contracts)
- Validation logic
- Error types
- Business rules

Everything in `backend/src/core/` must be testable with plain unit tests and no infrastructure.

### 2.2 Adapter pattern for replaceable concerns

The following must be implemented as replaceable adapters behind port interfaces:
- **Authentication/identity** â€” `AuthAdapter` port
- **Device identity** â€” `DeviceIdentityAdapter` port
- **Event storage** â€” `EventStore` port
- **Latest-location storage** â€” `LatestLocationStore` port
- **Realtime publishing** â€” `RealtimePublisher` port
- **Clock/time** â€” `Clock` port

NestJS modules in `backend/src/modules/` implement these ports. The core domain never imports from `backend/src/modules/`.

### 2.3 No mandatory SaaS features

- Multi-tenancy is NOT required. Use a replaceable context/namespace adapter if data isolation is needed
- No billing, subscription, or CRM features
- No mandatory admin UI â€” the engine must work without one
- Self-hostable is the primary deployment model

### 2.4 No unnecessary abstractions

- Do not create interfaces that have exactly one implementation and no reason to ever change
- Do not wrap Prisma in a generic "repository pattern" unless it serves the port interface contract
- Keep the code simple enough that a developer can understand the data flow by reading two files

---

## 3. Database Rules

### 3.1 PostGIS

- Use `postgis/postgis:16-3.4` Docker image (or compatible)
- Enable PostGIS extension in migration: `CREATE EXTENSION IF NOT EXISTS postgis;`
- Use `geography(Point,4326)` for spatial columns (metre-based distance calculations)
- Geography columns use Prisma `Unsupported("geography(Point,4326)")` + raw SQL in migrations
- All raw SQL must be parameterized â€” no string interpolation of user input
- GiST index on geography columns

### 3.2 Prisma usage

- Use Prisma for ordinary CRUD, relations, and migrations
- Use parameterized raw SQL only for:
  - PostGIS-specific operations (`ST_DWithin`, `ST_MakePoint`, etc.)
  - Performance-critical operations with measured evidence
- Document every raw SQL query with a comment explaining why Prisma doesn't suffice

### 3.3 Migrations

- Every schema change has a migration
- Migrations must work both on a fresh database and as an upgrade from the previous version
- Never use `prisma migrate reset` on a production or unknown database
- Test migration up AND down (rollback) where possible

### 3.4 Data isolation

- Every query that returns integration/project-specific data must be scoped by the ownership context
- Test that querying with a wrong context returns empty results (not a 403)
- Use 404 for inaccessible resources â€” never reveal whether they exist in another context

---

## 4. API Rules

### 4.1 Versioning

- All endpoints under `/api/v1`
- Update `APP_CONSTANTS.API_PREFIX` to `'api/v1'`

### 4.2 Error format

Every error response must use this structure:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "requestId": "uuid",
    "details": []
  }
}
```

Error codes are UPPER_SNAKE_CASE constants. Never include:
- Stack traces
- Secret values
- Precise coordinate data
- Internal file paths
- Database query details

### 4.3 IDs and timestamps

- All entity IDs: UUID v4
- All timestamps: `timestamptz` in PostgreSQL, RFC3339 UTC in API responses
- `captured_at`: device-generated capture time (never modified by server)
- `received_at`: server-generated receipt time

### 4.4 Idempotency

- `event_id` is the idempotency key for location events
- Duplicate detection: if `event_id` already exists, return it in `duplicates[]` â€” never insert a second row
- Committed retry of an already-accepted batch returns the same classification

### 4.5 Batch semantics

- Default: atomic batch â€” if ANY event is invalid, reject the ENTIRE batch
- Return structured per-event details for rejected batches
- Never acknowledge acceptance before database commit
- Separate server receipt time from device capture time

### 4.6 Pagination

- Cursor-based pagination for history queries
- Cursor: opaque token (Base64-encoded `{ captured_at, id }`)
- Default limit: configurable (start with 50)
- Max limit: configurable (start with 200)
- Stable ordering: `(captured_at DESC, id DESC)`

### 4.7 Rate limiting

- Configurable limits per device and per IP
- `429 Too Many Requests` with `Retry-After` header
- Never silently drop requests â€” always return a response

---

## 5. Security Rules

### 5.1 Secrets

- Never commit secrets to source control
- Use `.env` files for local development (in `.gitignore`)
- Provide `backend/.env.example` with safe placeholder values
- Use `ConfigModule` for all configuration access

### 5.2 Logging

- Never log access tokens, device credentials, or secrets
- Never log precise coordinates in default/production log level
- Log request IDs for traceability
- Log error codes and categories, not full error details

### 5.3 Authentication

- Every endpoint (except health probes) requires authentication
- Auth is a replaceable adapter â€” the core engine does not depend on a specific auth implementation
- The current JWT/email-password auth module becomes one adapter implementation
- Device auth is a separate credential type

### 5.4 Input validation

- Validate ALL incoming data before any processing
- Use the ValidationPipe (already global) for DTO validation
- Additional domain-level validation in core for coordinates, timestamps, ranges
- Reject payloads exceeding size limits before parsing

---

## 6. Testing Rules

### 6.1 Test structure

- Unit tests: `*.spec.ts` co-located with source files
- Integration tests: `backend/test/` directory, use `*.e2e-spec.ts`
- Test naming: `describe('ClassName/FunctionName')` â†’ `it('should ...')`

### 6.2 What must be tested

**Core domain (unit tests):**
- Every validation rule: at least 1 valid and 1 invalid case
- Boundary values for coordinates, accuracy, freshness thresholds
- Idempotency key comparison
- Clock-skew detection
- Freshness/accuracy classification

**API (integration tests):**
- Happy path for every endpoint
- Authentication required (401 without token)
- Invalid input rejected with proper error format
- Duplicate ingest returns duplicates, not errors
- Cross-context isolation (wrong context â†’ 404)
- Concurrent requests (no race conditions)
- Rate limiting (429 with Retry-After)

### 6.3 What must NOT be tested

- Do not write tests for NestJS framework internals
- Do not write tests for Prisma query builder
- Do not write snapshot tests unless there's a specific contract reason

### 6.4 Test commands

```bash
pnpm test          # Unit tests
pnpm test:e2e      # Integration/E2E tests
pnpm test:cov      # Coverage report
pnpm lint          # Lint check
pnpm build         # Type check + compile
```

---

## 7. Android SDK Rules

### 7.1 Never

- Never track location without explicit user action (not on install, boot, or login)
- Never log access tokens or precise coordinates
- Never silently drop unacknowledged events
- Never claim background tracking works on all devices
- Never claim exactly-once delivery â€” it's at-least-once with idempotent effects

### 7.2 Always

- Always persist events to local storage before upload
- Always reuse the same event_id for retries
- Always remove from queue only after server acknowledgement
- Always honor Android permission model and foreground-service requirements
- Always expose queue health diagnostics
- Always use Android Keystore for credential storage

---

## 8. Documentation Rules

### 8.1 Code documentation

- Every public function/class has a JSDoc/KDoc comment explaining its purpose
- Every port interface documents its contract and expected behavior
- Every raw SQL query has a comment explaining why Prisma doesn't suffice

### 8.2 Status tracking

After completing any phase:
1. Update `docs/implementation/STATUS.md` with:
   - Phase status changed to âœ… COMPLETE
   - All exit gate items checked with evidence
   - Test results with exact commands and output
   - Files created/modified listed
2. Commit the status update

### 8.3 Decision records

For any significant deviation from the plan:
- Create `docs/implementation/adr/ADR-NNN-title.md`
- Document: context, decision, consequences
- Reference in `STATUS.md`

---

## 9. File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Domain types | `kebab-case.ts` | `location-event.ts` |
| Port interfaces | `kebab-case.port.ts` | `event-store.port.ts` |
| NestJS modules | `kebab-case.module.ts` | `locations.module.ts` |
| NestJS services | `kebab-case.service.ts` | `locations.service.ts` |
| NestJS controllers | `kebab-case.controller.ts` | `locations.controller.ts` |
| DTOs | `kebab-case.dto.ts` | `batch-ingest.dto.ts` |
| Unit tests | `kebab-case.spec.ts` | `location-event.spec.ts` |
| E2E tests | `kebab-case.e2e-spec.ts` | `ingestion.e2e-spec.ts` |
| Prisma schema | `schema.prisma` | (single file) |
| Migrations | Prisma auto-generated | `YYYYMMDDHHMMSS_name/` |
| Config | `kebab-case.ts` | `configuration.ts` |

---

## 10. Quick Reference: PRD Values

| Parameter | Default Value | Configurable |
|---|---|---|
| Freshness: Fresh | â‰¤ 15 seconds | Yes |
| Freshness: Delayed | 15â€“60 seconds | Yes |
| Freshness: Stale | > 60 seconds | Yes |
| Accuracy: Good | â‰¤ 25 metres | Yes |
| Accuracy: Reduced | 25â€“50 metres | Yes |
| Accuracy: Poor | > 50 metres | Yes |
| Profile: Active | 5s interval, 5m distance | Yes |
| Profile: Balanced | 10s interval, 10m distance | Yes |
| Profile: Stationary | 30â€“60s interval, 15â€“25m distance | Yes |
| Upload flush interval | ~5 seconds | Yes |
| Upload batch size | up to 5 events | Yes |
| Retry policy | Exponential backoff + jitter, bounded max delay | Yes |
| Pagination default limit | 50 | Yes |
| Pagination max limit | 200 | Yes |
| Scale target | ~1,000 concurrent devices | â€” |
| Ingestion p95 target | < 500ms | â€” |
| Fan-out p95 target | < 1 second | â€” |
