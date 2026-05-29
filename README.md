# Resource Booking API

REST API for managing company resource bookings (meeting rooms, vehicles, parking, equipment).

**Stack:** Node.js · Express · TypeScript · PostgreSQL · TypeORM · Zod · Luxon · node-cron · Jest · Swagger

## Highlights

- JWT auth with role-based authorization (regular users + administrators).
- Booking creation flow with full date/time validation: past-date guard, working-hours window, weekend / holiday rules, per-resource overrides, and half-open overlap detection.
- Transactional create with `SELECT ... FOR UPDATE` on the resource row to prevent concurrent double-bookings.
- Timezone-aware logic: storage in UTC `timestamptz`, predicates evaluated in `COMPANY_TIMEZONE` via Luxon.
- Background `node-cron` job that auto-rejects stale `PENDING` bookings (>48h old).
- Swagger / OpenAPI docs served at `/docs`.
- Two-tier test coverage: 16 Jest unit tests on the validator + a 40-case HTTP integration script (`npm run e2e`) covering auth, every rule, status transitions, and a 20-parallel-request concurrency proof.
- Idempotent seed script and TypeORM migrations.

## Prerequisites

- Docker + Docker Compose (the entire stack — Postgres and the Node API — runs in containers)
- Node.js 20+ and npm — only needed if you want to run the API locally without Docker, or to run the test suite

## Quick start

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD and JWT_SECRET (min. 16 chars) to anything you like.

docker compose up -d --build              # 1. build image, start Postgres + API
docker compose exec api npm run migration:run   # 2. create tables
docker compose exec api npm run seed            # 3. populate sample data

curl http://localhost:3000/health
# {"ok":true}
```

That's it — open [http://localhost:3000/docs](http://localhost:3000/docs) for Swagger UI.

To stop everything: `docker compose down`. To also wipe the database: `docker compose down -v`.

## Running with Docker

`docker-compose.yml` defines two services:

| Service | Image | Purpose |
|---|---|---|
| `postgres` | `postgres:16-alpine` | Database. Credentials and database name come from `.env`; **no default `postgres` superuser is exposed**. Data persists in the named volume `pgdata`. Has a `pg_isready` healthcheck. |
| `api` | built from local [Dockerfile](Dockerfile) | The Node + Express service. Waits for Postgres to be healthy via `depends_on`. Listens on port 3000. Reads its config from the environment passed by compose. |

The API container connects to Postgres on the internal Docker network (`POSTGRES_HOST=postgres`, port `5432`), independent of the `POSTGRES_PORT` mapping on the host.

On boot the API initializes the TypeORM datasource and registers the `auto-reject-stale` cron task (every 15 minutes — see [src/jobs/auto-reject-stale.job.ts](src/jobs/auto-reject-stale.job.ts)).

## Migrations

```bash
# Apply pending migrations
docker compose exec api npm run migration:run

# Revert the last migration
docker compose exec api npm run migration:revert

# Generate a new migration after editing entities
docker compose exec api npm run migration:generate -- src/migrations/MeaningfulName
```

The initial migration is checked into the repo under [src/migrations/](src/migrations/).

## Seed sample data

```bash
docker compose exec api npm run seed
```

Creates: one admin and one regular user (credentials from `.env`), three resources (meeting room, vehicle with weekend access, equipment with after-hours access), and two holidays. The script is **idempotent** — safe to re-run.

## Local development (without Docker for the API)

If you'd prefer the ts-node-dev hot-reload loop with Postgres still in Docker:

```bash
docker compose up -d postgres   # only the database
npm install
npm run migration:run
npm run seed
npm run dev                     # ts-node-dev with auto-restart on :3000
```

When running this way, `POSTGRES_HOST` in `.env` should be `localhost`. The Docker compose `api` service overrides `POSTGRES_HOST=postgres` for the in-container case, so the same `.env` works for both.

## API documentation

Swagger UI is mounted at [`/docs`](http://localhost:3000/docs) and the raw OpenAPI document at [`/openapi.json`](http://localhost:3000/openapi.json) once the server is running. Both reflect the routes annotated in [`src/routes/`](src/routes/) and the shared schemas in [`src/config/swagger.ts`](src/config/swagger.ts).

## Tests

```bash
npm install        # if you haven't installed locally yet
npm test           # one-shot
npm run test:watch # rerun on change
```

Validator coverage lives in [src/services/booking-validator.service.test.ts](src/services/booking-validator.service.test.ts) and exercises each rule (working hours, weekends, holidays, past-date, end-before-start, single-day window, per-resource overrides) without touching the database — 16 cases covering both happy and unhappy paths.

The unit tests don't need Postgres or the Docker stack to be running.

### End-to-end script

For HTTP-level coverage there's an integration script that drives the running API:

```bash
npm run e2e
```

It exercises authentication (login flow, JWT signature, expiry, role-based authorization with hand-crafted tokens), every booking validation rule and per-resource override, status transitions (approve / reject / cancel), pagination + filtering, and a **20-parallel-request concurrency test** that asserts exactly one booking wins and 19 get `409 Conflict` — the empirical proof that the `SELECT ... FOR UPDATE` lock works. Source: [scripts/e2e.mjs](scripts/e2e.mjs).

Prerequisites: the API must be running and seeded (Docker stack up + `migration:run` + `seed`). The script reads `JWT_SECRET` from `.env` to craft expired / wrong-signature tokens; without it those specific cases are skipped.

## Environment variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `test` / `production`. |
| `PORT` | API listen port. |
| `POSTGRES_HOST` / `POSTGRES_PORT` | Database host/port. For local dev set host to `localhost`; in Docker the API container ignores this and uses `postgres:5432` on the internal network. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database credentials. Required by docker-compose; no defaults. |
| `JWT_SECRET` | HMAC secret for signing tokens. Minimum 16 characters. |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d`, `12h`. |
| `COMPANY_TIMEZONE` | IANA TZ used for working-hours, weekend and holiday checks. |
| `WORKING_HOURS_START` / `WORKING_HOURS_END` | Default daily booking window, `HH:mm`. |
| `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` | Seeded admin credentials. |
| `USER_SEED_EMAIL` / `USER_SEED_PASSWORD` | Seeded regular-user credentials. |

## API endpoints

All endpoints are mounted under `/api`. Authentication uses `Authorization: Bearer <token>`.

### Auth

| Method | Path | Auth | Body |
|---|---|---|---|
| `POST` | `/api/auth/register` | public | `{ email, password }` |
| `POST` | `/api/auth/login` | public | `{ email, password }` |

Both return `{ token, user: { id, email, role } }`.

### Resources

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/resources` | any user |
| `GET` | `/api/resources/:id` | any user |
| `POST` | `/api/resources` | admin |
| `PATCH` | `/api/resources/:id` | admin |
| `DELETE` | `/api/resources/:id` | admin |

### Holidays

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/holidays` | any user |
| `POST` | `/api/holidays` | admin |
| `DELETE` | `/api/holidays/:id` | admin |

### Bookings

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/bookings` | any user | Creates with status `PENDING`. Body: `{ resourceId, startAt, endAt, note? }`. Times are ISO 8601 with explicit offset (e.g. `2026-06-01T09:00:00+02:00`). |
| `GET` | `/api/bookings/me` | any user | Lists the caller's bookings. Supports `?status=`, `?resourceId=`, `?page=`, `?pageSize=` (max 100). |
| `POST` | `/api/bookings/:id/cancel` | owner or admin | Allowed when status is `PENDING` or `APPROVED`. |
| `GET` | `/api/bookings` | admin | Lists all bookings with the same filter / pagination options. |
| `POST` | `/api/bookings/:id/approve` | admin | Re-checks overlap at approval time; rejects if a conflict has appeared since creation. |
| `POST` | `/api/bookings/:id/reject` | admin | Allowed only for `PENDING` bookings. |

### Booking validation rules

When a booking is created, these rules run in order (the first failure short-circuits):

1. `endAt > startAt`
2. `startAt` is not in the past
3. The booking fits inside a single working-hours window (default `08:00-17:00` in `COMPANY_TIMEZONE`) — **bypassed** when the resource has `allowOutsideHours: true`
4. No day the booking spans falls on a weekend — **bypassed** when the resource has `allowWeekendsAndHolidays: true`
5. No day the booking spans is a configured holiday — bypassed by the same flag
6. No active (`PENDING` or `APPROVED`) booking on the same resource overlaps the requested range

Creation runs inside a transaction with `SELECT ... FOR UPDATE` on the resource row, so two concurrent requests for the same slot cannot both succeed.

## Example calls

```bash
# Log in as the seeded admin
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}' \
  | jq -r .token)

# List resources
curl http://localhost:3000/api/resources -H "Authorization: Bearer $TOKEN"

# Create a new resource (admin only)
curl -X POST http://localhost:3000/api/resources \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Parking Spot 12",
    "type":"parking",
    "allowOutsideHours": true,
    "allowWeekendsAndHolidays": true
  }'

# Add a holiday
curl -X POST http://localhost:3000/api/holidays \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-05-01","name":"Labour Day"}'

# Create a booking (as a regular user)
USER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"ChangeMe123!"}' \
  | jq -r .token)

curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId":"<meeting-room-uuid>",
    "startAt":"2026-06-01T09:00:00+02:00",
    "endAt":"2026-06-01T11:00:00+02:00",
    "note":"Sprint planning"
  }'

# Admin approves a booking
curl -X POST http://localhost:3000/api/bookings/<booking-id>/approve \
  -H "Authorization: Bearer $TOKEN"
```

## Project layout

```
src/
  config/        env loader, TypeORM datasource, Swagger spec
  controllers/   HTTP-only handlers
  dtos/          Zod schemas + inferred types
  entities/      User, Resource, Booking, Holiday
  jobs/          node-cron registry (auto-reject-stale)
  middleware/    error handler, async wrapper, validate, requireAuth, requireRole
  migrations/    TypeORM migrations
  routes/        Express routers (mounted at /api) with OpenAPI JSDoc
  services/      business logic + validator (+ .test.ts unit tests)
  seeds/         idempotent seed script
  types/         ambient type augmentations (Express.Request.user)
  utils/         HttpError, password, JWT, date/Luxon helpers
  app.ts         Express factory
  server.ts      bootstraps datasource, starts listener and cron jobs
scripts/
  e2e.mjs        HTTP-level integration script (npm run e2e)
tests/
  jest.setup.ts  env defaults for the test runner
```

### Layered architecture

Requests flow through clear layers: **routes** → **validate middleware (Zod DTO)** → **controller** → **service** (business logic + transactions) → **TypeORM repository**. Controllers are intentionally thin — they parse the request and call exactly one service method. Validators are pure functions and have no DB dependencies, which is why the validator suite runs without a database.

## Assumptions

- All timestamps are stored as Postgres `timestamptz` (UTC). Time-of-day rules (working hours / weekend / holiday) are interpreted in `COMPANY_TIMEZONE`.
- Clients must send ISO 8601 datetimes with an explicit offset (e.g. `2026-06-01T09:00:00+02:00`). Naive strings are rejected at the DTO layer.
- Working hours are interpreted as a half-open window — a booking's start must satisfy `start >= WORKING_HOURS_START` and `start < WORKING_HOURS_END`, while its end must satisfy `end <= WORKING_HOURS_END`. A booking ending exactly at 17:00 is allowed; one starting at 17:00 is not.
- Holidays block the entire calendar day in `COMPANY_TIMEZONE`.
- `PENDING` bookings block overlapping new bookings; otherwise users could spam pending requests for the same slot.
- `CANCELLED`, `REJECTED` and `EXPIRED` bookings do not block overlaps.
- One admin is created by the seed script. Additional admins can be promoted by direct SQL update on the `users` table.
- The auto-reject job uses `createdAt` (not `startAt`) to define "stale" — pending requests that the admin hasn't acted on within 48 hours are rejected regardless of when they were scheduled for.

## Tradeoffs

Conscious choices made during implementation, with the alternative considered:

- **Layered folder structure** (`controllers/`, `services/`, `entities/`, `dtos/`, …) over feature-modular folders. The task evaluates "well-structured layered architecture" as a bonus; layering by responsibility makes that visible at a glance.
- **Zod** for request validation over `class-validator`. Zod schemas are plain values, infer TypeScript types via `z.infer`, and don't entangle DTO validation with TypeORM's decorator system.
- **Luxon** for date/time over `date-fns`. First-class IANA timezone support — important because working-hours / weekend / holiday checks are inherently bound to a *company-local* timezone, while storage stays in UTC.
- **Transaction + `SELECT ... FOR UPDATE`** on the resource row over a Postgres `EXCLUDE` constraint with `tstzrange`. The lock approach is faster to implement, easier to explain, and demonstrates transaction awareness. The exclusion-constraint approach would be more elegant in production at scale.
- **Booking workflow starts as `PENDING`**, and both `PENDING` and `APPROVED` block new overlaps. Otherwise a user could spam pending requests to a slot they never intend to confirm.
- **TypeORM migrations + idempotent seed script** over `synchronize: true`. Slower to set up but `synchronize` is a footgun in production — silently drops columns and loses data.
- **`node-cron`** over `BullMQ` for the background job. One job, one schedule, no need for retries or a Redis dependency.
- **Two-tier testing**: 16 Jest unit tests on the validator (pure logic, no DB) plus a 40-case HTTP-level integration script ([scripts/e2e.mjs](scripts/e2e.mjs)) that drives the running API — covering auth, every booking rule, status transitions, and concurrency. The natural next step is porting the script to Supertest + Jest so it runs inside `npm test` and slots into CI.
- **API runs in the production image with all dependencies installed**, not `--omit=dev`. The migration and seed scripts use the TypeORM CLI through `ts-node`, which is a devDependency. Trading ~50 MB of image size for the convenience of running every npm script with the same `docker compose exec` pattern.
