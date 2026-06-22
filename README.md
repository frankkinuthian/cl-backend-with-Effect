# Classroom Backend

A TypeScript REST API for managing classroom data (departments and subjects). The server is built with **Express 5**, **Drizzle ORM**, and **Neon Postgres**, with business logic structured using **Effect-TS** for typed errors, schema validation, and dependency injection. All requests pass through **Arcjet** security middleware for bot detection, WAF shielding, and role-based rate limiting.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Install & Run](#install--run)
  - [Database Setup](#database-setup)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
  - [Design Goals](#design-goals)
  - [Request Lifecycle](#request-lifecycle)
  - [Layer Responsibilities](#layer-responsibilities)
- [Security Middleware](#security-middleware)
  - [How It Works](#how-it-works)
  - [Role-Based Rate Limits](#role-based-rate-limits)
  - [Denial Reasons](#denial-reasons)
- [Effect-TS Patterns](#effect-ts-patterns)
  - [Tagged Errors](#tagged-errors)
  - [Schema Validation](#schema-validation)
  - [Dependency Injection with Layers](#dependency-injection-with-layers)
  - [Service Programs](#service-programs)
  - [Tag-Based HTTP Error Handling](#tag-based-http-error-handling)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
  - [Health Check](#health-check)
  - [List Subjects](#list-subjects)
  - [Query Parameters](#query-parameters)
  - [Success Response](#success-response)
  - [Error Responses](#error-responses)
  - [Examples](#examples)
- [Adding a New Feature](#adding-a-new-feature)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

This backend exposes HTTP endpoints for classroom administration. The first implemented feature is **listing subjects** with optional search, department filtering, and pagination.

Rather than putting all logic directly inside Express route handlers, the codebase separates concerns into three layers:

1. **Routes** — thin HTTP adapters (parse request, run Effect, send response)
2. **Features** — business logic, validation, and typed errors
3. **Database** — Drizzle schema, connection, and migrations

Express handles transport. Effect-TS handles **validation**, **typed failures**, **composability**, and **testability**.

---

## Tech Stack

| Layer              | Technology                               | Purpose                                  |
| ------------------ | ---------------------------------------- | ---------------------------------------- |
| Runtime            | Node.js (ESM)                            | Server runtime                           |
| HTTP               | Express 5                                | Routing and middleware                   |
| Language           | TypeScript 6 (strict)                    | Type safety                              |
| Database           | PostgreSQL via [Neon](https://neon.tech) | Persistent storage                       |
| ORM                | Drizzle ORM                              | Schema, queries, migrations              |
| Functional effects | Effect 3                                 | Validation, errors, DI, concurrency      |
| Security           | [Arcjet](https://arcjet.com)             | Bot detection, WAF shield, rate limiting |
| Dev runner         | tsx                                      | Hot reload during development            |
| Package manager    | pnpm                                     | Dependency management                    |

---

## Getting Started

### Prerequisites

- **Node.js** 20+ recommended
- **pnpm** 11+ (enforced via `devEngines` in `package.json`)
- A **Neon** (or compatible) PostgreSQL database
- A `.env` file with your database connection string

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
FRONTEND_URL=http://localhost:5173
ARCJET_KEY=ajkey_your_key_here
PORT=8000
```

| Variable       | Required | Default | Description                                                                |
| -------------- | -------- | ------- | -------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | —       | PostgreSQL connection string (Neon HTTP driver)                            |
| `FRONTEND_URL` | Yes      | —       | Allowed CORS origin for the frontend                                       |
| `ARCJET_KEY`   | Yes      | —       | Arcjet API key — get one at [app.arcjet.com](https://app.arcjet.com)       |
| `PORT`         | No       | `8000`  | HTTP port. Railway and other hosts inject this automatically in production |

The app throws at startup if `DATABASE_URL` or `ARCJET_KEY` is missing.

### Install & Run

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Start dev server with hot reload
pnpm dev
```

The server starts at `http://localhost:8000` (or your configured `PORT`).

```bash
# Production build
pnpm build

# Run compiled output
pnpm start
```

### Database Setup

Schema is defined in `src/database/schema/app.ts`. Migrations live in `drizzle/`.

```bash
# After changing schema files, generate a new migration
pnpm db:generate

# Apply pending migrations
pnpm db:migrate
```

Drizzle Kit config: `drizzle.config.ts`

---

## Project Structure

```
classroom-backend/
├── drizzle/                          # SQL migrations (generated)
│   └── 0000_unusual_yellowjacket.sql
├── src/
│   ├── index.ts                      # Express app entry point
│   ├── config/
│   │   └── arcjet.ts                 # Arcjet client + base rules
│   ├── middleware/
│   │   └── security.ts               # Arcjet Effect middleware
│   ├── database/
│   │   ├── index.ts                  # Drizzle + Neon connection
│   │   └── schema/
│   │       ├── index.ts              # Schema barrel export
│   │       ├── app.ts                # departments & subjects tables
│   │       └── auth.ts               # user, session, account, verification tables
│   ├── features/
│   │   ├── errors/
│   │   │   └── index.ts              # Tagged error classes
│   │   ├── database/
│   │   │   └── index.ts              # Database Context tag + Layer
│   │   ├── types/
│   │   │   └── type.d.ts             # Shared ambient types (Schedule, UserRoles)
│   │   └── subjects/
│   │       ├── schemas.ts            # Query param Schema + normalization
│   │       └── list-subjects.ts      # listSubjects Effect program
│   └── routes/
│       └── subjects.ts               # Express router (HTTP adapter)
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

### File Roles

| File                                     | Responsibility                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/index.ts`                           | Creates Express app, mounts routers, listens on `PORT`                             |
| `src/config/arcjet.ts`                   | Arcjet client configured with shield, bot detection, and a baseline sliding window |
| `src/middleware/security.ts`             | Arcjet Effect middleware — maps denials to typed errors, calls `next()` on allow   |
| `src/routes/subjects.ts`                 | Wires `GET /` to `listSubjects`, maps tagged errors → HTTP status                  |
| `src/features/subjects/list-subjects.ts` | Validates input, queries DB, returns paginated result                              |
| `src/features/subjects/schemas.ts`       | Effect Schema for query params; Express query normalization                        |
| `src/features/errors/index.ts`           | All tagged error types: `DatabaseError`, `InvalidQuery`, `ArcjetError` variants    |
| `src/features/database/index.ts`         | Injectable `Database` service via Effect `Layer`                                   |
| `src/database/index.ts`                  | Singleton Drizzle client (Neon HTTP)                                               |
| `src/database/schema/app.ts`             | App table definitions and Drizzle relations                                        |
| `src/database/schema/auth.ts`            | Auth table definitions (user, session, account, verification)                      |

---

## Architecture

### Design Goals

1. **Thin routes** — Express handlers should not contain SQL or validation rules
2. **Typed errors** — distinguish client mistakes (`400`) from server/DB failures (`500`)
3. **Validated input** — reject bad query params explicitly instead of silent coercion (`NaN`, etc.)
4. **Testable services** — business logic runs as pure Effect programs, injectable in tests
5. **Parallel I/O** — count and list queries run concurrently where safe

### Request Lifecycle

```
HTTP Request
    │
    ▼
Express Route (src/routes/subjects.ts)
    │  passes req.query as unknown
    ▼
listSubjects Effect (src/features/subjects/list-subjects.ts)
    │
    ├─► normalizeExpressQuery()     flatten Express ParsedQs → plain strings
    ├─► Schema.decodeUnknown()      validate → InvalidQuery on failure
    ├─► yield* Database             resolve Drizzle client from Layer
    ├─► buildWhereClause()          pure filter builder
    ├─► Effect.all (concurrency: 2)
    │       ├─► countSubjects()     tryDb → DatabaseError on failure
    │       └─► fetchSubjects()     tryDb → DatabaseError on failure
    ▼
Success payload { data, pagination }
    │
    ▼
Route pipe:
    Effect.provide(DatabaseLive)
    Effect.map           → wrap success as HTTP 200
    Effect.catchTags     → InvalidQuery → 400, DatabaseError → 500
    Effect.runPromise
    │
    ▼
res.status(...).json(...)
```

### Layer Responsibilities

```
┌─────────────────────────────────────────────────────────┐
│  routes/          HTTP transport, status codes, JSON    │
├─────────────────────────────────────────────────────────┤
│  features/        validation, business logic, errors    │
├─────────────────────────────────────────────────────────┤
│  database/        Drizzle schema, connection, migrations│
└─────────────────────────────────────────────────────────┘
```

**Routes know about HTTP. Features know about domain rules. Database knows about persistence.**

---

## Security Middleware

**Files:** `src/config/arcjet.ts`, `src/middleware/security.ts`

Every request passes through Arcjet before reaching any route handler.

### How It Works

`src/config/arcjet.ts` defines the base Arcjet client with three always-on rules:

- **Shield** — WAF-style protection against common web attacks (SQLi, XSS, etc.)
- **Bot detection** — blocks automated clients; search engine crawlers and link preview bots are explicitly allowed
- **Baseline sliding window** — a loose global cap (50 req / 2s) as a backstop

`src/middleware/security.ts` wraps `client.protect()` in an Effect pipeline. It adds a per-request sliding window rule on top of the base client, sized by the authenticated user's role:

```typescript
const client = aj.withRule(
  slidingWindow({ mode: "LIVE", interval: "1m", max: limit }),
);

const decision =
  yield *
  Effect.tryPromise({
    try: () => client.protect(arcjetRequest),
    catch: (cause) => new ArcjetError({ cause }),
  });
```

Each denial reason maps to a distinct tagged error, handled in `catchTags` just like route errors:

```typescript
Effect.catchTags({
  ArcjetBotError:       () => Effect.succeed({ status: 403, body: { error: "Forbidden", ... } }),
  ArcjetShieldError:    () => Effect.succeed({ status: 403, body: { error: "Forbidden", ... } }),
  ArcjetRateLimitError: (e) => Effect.succeed({ status: 429, body: { error: "Too Many Requests", message: e.message } }),
  ArcjetError:          (e) => { console.error(e.cause); return Effect.succeed({ status: 500, ... }) },
})
```

If the effect succeeds (decision is allowed), `response` is `null` and `next()` is called.

### Role-Based Rate Limits

The middleware reads `req.user?.role` (set by auth middleware upstream) to determine the per-minute cap:

| Role                      | Limit        | Message                      |
| ------------------------- | ------------ | ---------------------------- |
| `admin`                   | 20 req / min | Admin request limit exceeded |
| `teacher` / `student`     | 10 req / min | User request limit exceeded  |
| `guest` (unauthenticated) | 25 req / min | Guest request limit exceeded |

### Denial Reasons

| Reason           | Status | Description                                  |
| ---------------- | ------ | -------------------------------------------- |
| Bot              | `403`  | Automated request from a non-whitelisted bot |
| Shield           | `403`  | WAF rule triggered (attack pattern detected) |
| Rate limit       | `429`  | Per-role sliding window exceeded             |
| Unexpected throw | `500`  | `client.protect()` itself failed             |

The middleware is skipped entirely when `NODE_ENV=test`.

---

## Effect-TS Patterns

This section documents every Effect concept used in the codebase and why it was chosen.

### Tagged Errors

**File:** `src/features/errors/index.ts`

Errors are defined as **tagged error classes** using Effect Schema:

```typescript
export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
  "DatabaseError",
  { cause: Schema.Unknown },
) {}

export class InvalidQuery extends Schema.TaggedError<InvalidQuery>()(
  "InvalidQuery",
  { message: Schema.String },
) {}
```

Each error has a discriminant `_tag` field (`"DatabaseError"` or `"InvalidQuery"`). This enables:

- **Exhaustive handling** with `Effect.catchTags`
- **Type narrowing** inside each handler (TypeScript knows the shape)
- **Structured logging** (log `cause` for DB errors, `message` for validation)

| Error                  | When it occurs                                | HTTP mapping                |
| ---------------------- | --------------------------------------------- | --------------------------- |
| `InvalidQuery`         | Query params fail schema validation           | `400 Bad Request`           |
| `DatabaseError`        | Drizzle/Neon query throws or connection fails | `500 Internal Server Error` |
| `ArcjetBotError`       | Request identified as an automated bot        | `403 Forbidden`             |
| `ArcjetShieldError`    | Arcjet WAF shield blocks the request          | `403 Forbidden`             |
| `ArcjetRateLimitError` | Request exceeds the role-based rate limit     | `429 Too Many Requests`     |
| `ArcjetError`          | `client.protect()` throws unexpectedly        | `500 Internal Server Error` |

### Schema Validation

**File:** `src/features/subjects/schemas.ts`

Query parameters are validated with **Effect Schema** before any database access:

```typescript
export const ListSubjectsQuery = Schema.Struct({
  search: Schema.optional(Schema.String),
  department: Schema.optional(Schema.String),
  page: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
    { default: () => 1 },
  ),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(100),
    ),
    { default: () => 10 },
  ),
});
```

**Important:** In Effect 3, defaults use `Schema.optionalWith(schema, { default })`, not `Schema.optional(schema, { default })`.

Validation rules:

| Field        | Type    | Rules    | Default |
| ------------ | ------- | -------- | ------- |
| `search`     | string  | optional | —       |
| `department` | string  | optional | —       |
| `page`       | integer | ≥ 1      | `1`     |
| `limit`      | integer | 1–100    | `10`    |

#### Express Query Normalization

Express `req.query` values are typed as `ParsedQs` and may be `string | string[] | ...`. Before decoding, `normalizeExpressQuery()` converts the query object to `Record<string, string>`:

- Single string values pass through unchanged
- Array values (repeated keys like `?page=1&page=2`) use the **first** string element
- Non-string values are dropped

This prevents schema failures on repeated query keys and keeps validation predictable.

### Dependency Injection with Layers

**File:** `src/features/database/index.ts`

The Drizzle client is exposed as an Effect **Context tag**:

```typescript
export class Database extends Context.Tag("Database")<Database, typeof db>() {}

export const DatabaseLive = Layer.succeed(Database, db);
```

Services `yield* Database` instead of importing `db` directly. In tests, provide a mock layer:

```typescript
const TestDatabase = Layer.succeed(Database, mockDb)
listSubjects(query).pipe(Effect.provide(TestDatabase), ...)
```

This keeps production wiring (`DatabaseLive`) in the route layer and business logic free of global singletons.

### Service Programs

**File:** `src/features/subjects/list-subjects.ts`

Business logic is an **Effect generator** (`Effect.gen`):

```typescript
export const listSubjects = (rawQuery: unknown) =>
  Effect.gen(function* () {
    const params = yield* Schema.decodeUnknown(ListSubjectsQuery)(...)
    const db = yield* Database
    const whereClause = buildWhereClause(params)
    const [total, data] = yield* Effect.all([countSubjects(...), fetchSubjects(...)], { concurrency: 2 })
    return { data, pagination: { ... } }
  })
```

Key helpers inside the service:

| Helper                                    | Purpose                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `tryDb(fn)`                               | Wraps a Promise in `Effect.tryPromise`, mapping failures to `DatabaseError` |
| `buildWhereClause(params)`                | Pure function building Drizzle `WHERE` from filters                         |
| `countSubjects(db, where)`                | `SELECT count(*)` with department join                                      |
| `fetchSubjects(db, where, limit, offset)` | Paginated select with nested department object                              |

**Parallel queries:** `Effect.all(..., { concurrency: 2 })` runs the count and list queries simultaneously, reducing latency on Neon HTTP (each query is a separate round trip).

**Filter logic:**

- `search` — case-insensitive match on `subjects.name` **OR** `subjects.code` (`ilike`)
- `department` — case-insensitive match on `departments.name` (`ilike`)
- Multiple filters are combined with `AND`
- No filters → `whereClause` is `undefined` (returns all subjects)

**Join:** `leftJoin` on `subjects.department_id = departments.id` so subjects without a department are still returned.

**Ordering:** Newest first (`ORDER BY subjects.created_at DESC`).

### Tag-Based HTTP Error Handling

**File:** `src/routes/subjects.ts`

The route is a thin adapter that runs the Effect and maps tagged errors to HTTP responses:

```typescript
const response = await listSubjects(req.query).pipe(
  Effect.provide(DatabaseLive),
  Effect.map((result) => ({ status: 200, body: result })),
  Effect.catchTags({
    InvalidQuery: (error) =>
      Effect.succeed({ status: 400, body: { error: error.message } }),
    DatabaseError: (error) => {
      console.error("GET /subjects error:", error);
      return Effect.succeed({
        status: 500,
        body: { error: "Failed to get subjects" },
      });
    },
  }),
  Effect.runPromise,
);

res.status(response.status).json(response.body);
```

Why this pattern:

1. **`Effect.catchTags`** — TypeScript narrows each error handler by tag; no manual `if (error._tag === ...)` checks
2. **Errors become success values** — after `catchTags`, the Effect error channel is empty, so `runPromise` never throws for known failures
3. **Separation of concerns** — the service returns domain data or tagged errors; the route owns HTTP semantics

Pipe order matters:

1. `provide(DatabaseLive)` — satisfy the `Database` requirement
2. `map` — transform successful domain result into `{ status: 200, body }`
3. `catchTags` — convert tagged failures into `{ status: 4xx/5xx, body }`
4. `runPromise` — execute the entire pipeline

---

## Database Schema

### `departments`

| Column        | Type         | Constraints                               |
| ------------- | ------------ | ----------------------------------------- |
| `id`          | integer      | primary key, generated always as identity |
| `code`        | varchar(50)  | not null, unique                          |
| `name`        | varchar(255) | not null                                  |
| `description` | varchar(255) | nullable                                  |
| `created_at`  | timestamp    | not null, default now                     |
| `updated_at`  | timestamp    | not null, default now, auto-updated       |

### `subjects`

| Column          | Type         | Constraints                                          |
| --------------- | ------------ | ---------------------------------------------------- |
| `id`            | integer      | primary key, generated always as identity            |
| `code`          | varchar(50)  | not null, unique                                     |
| `name`          | varchar(255) | not null                                             |
| `description`   | varchar(255) | nullable                                             |
| `department_id` | integer      | nullable, FK → `departments.id` (ON DELETE restrict) |
| `created_at`    | timestamp    | not null, default now                                |
| `updated_at`    | timestamp    | not null, default now, auto-updated                  |

### Relations

- A **department** has many **subjects**
- A **subject** belongs to one **department** (optional)

Drizzle relation definitions are in `src/database/schema/app.ts`.

---

## API Reference

Base URL (local): `http://localhost:8000`

### Health Check

```
GET /
```

**Response:** `200 OK`

```
Hello, Welcome to the classroom API!
```

---

### List Subjects

```
GET /api/subjects
```

Returns a paginated list of subjects. Each subject includes its associated department (if any).

### Query Parameters

All parameters are optional.

| Parameter    | Type            | Description                                                    |
| ------------ | --------------- | -------------------------------------------------------------- |
| `search`     | string          | Case-insensitive partial match on subject **name** or **code** |
| `department` | string          | Case-insensitive partial match on department **name**          |
| `page`       | integer (≥ 1)   | Page number. Default: `1`                                      |
| `limit`      | integer (1–100) | Items per page. Default: `10`                                  |

Filters combine with **AND** logic. For example, `search=math&department=science` returns subjects matching both conditions.

### Success Response

**Status:** `200 OK`

```json
{
  "data": [
    {
      "id": 1,
      "name": "Mathematics",
      "code": "MATH101",
      "description": "Introductory mathematics",
      "departmentId": 2,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z",
      "department": {
        "id": 2,
        "code": "SCI",
        "name": "Science",
        "description": "Science department",
        "createdAt": "2025-01-01T08:00:00.000Z",
        "updatedAt": "2025-01-01T08:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

| Field                   | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `data`                  | Array of subject records with nested `department` |
| `pagination.page`       | Current page number                               |
| `pagination.limit`      | Items per page                                    |
| `pagination.total`      | Total matching records (before pagination)        |
| `pagination.totalPages` | `Math.ceil(total / limit)`                        |

If a subject has no department, `departmentId` is `null` and `department` column fields from the join may be `null`.

### Error Responses

#### 400 Bad Request — Invalid query parameters

Returned when schema validation fails (e.g. `page=abc`, `limit=0`, `limit=200`).

```json
{
  "error": "Invalid query parameters"
}
```

#### 500 Internal Server Error — Database failure

Returned when a query or connection error occurs. The client receives a generic message; details are logged server-side.

```json
{
  "error": "Failed to get subjects"
}
```

### Examples

```bash
# List first page (defaults: page=1, limit=10)
curl "http://localhost:8000/api/subjects"

# Search by subject name or code
curl "http://localhost:8000/api/subjects?search=math"

# Filter by department name
curl "http://localhost:8000/api/subjects?department=science"

# Combine filters with pagination
curl "http://localhost:8000/api/subjects?search=elec&department=engineering&page=2&limit=20"

# Invalid page → 400
curl "http://localhost:8000/api/subjects?page=abc"
```

---

## Adding a New Feature

Follow this checklist when adding a new endpoint (e.g. `POST /api/subjects`):

### 1. Define errors (if needed)

Add new tagged error classes in `src/features/errors/index.ts`:

```typescript
export class SubjectNotFound extends Schema.TaggedError<SubjectNotFound>()(
  "SubjectNotFound",
  { id: Schema.Number },
) {}
```

### 2. Define input/output schemas

Create `src/features/<feature>/schemas.ts` with Effect Schema for request bodies, params, and query strings.

### 3. Implement the service

Create `src/features/<feature>/<action>.ts` as an Effect program:

```typescript
export const createSubject = (body: unknown) =>
  Effect.gen(function* () {
    const input = yield* Schema.decodeUnknown(CreateSubjectInput)(body).pipe(
      Effect.mapError(
        () => new InvalidQuery({ message: "Invalid request body" }),
      ),
    );
    const db = yield* Database;
    // ... db logic wrapped in tryDb
    return result;
  });
```

### 4. Create the route adapter

Create `src/routes/<feature>.ts`:

```typescript
router.post("/", async (req, res) => {
  const response = await createSubject(req.body).pipe(
    Effect.provide(DatabaseLive),
    Effect.map((result) => ({ status: 201, body: result })),
    Effect.catchTags({
      InvalidQuery: (e) =>
        Effect.succeed({ status: 400, body: { error: e.message } }),
      DatabaseError: (e) =>
        Effect.succeed({ status: 500, body: { error: "..." } }),
      // SubjectNotFound: (e) => Effect.succeed({ status: 404, body: { error: "..." } }),
    }),
    Effect.runPromise,
  );
  res.status(response.status).json(response.body);
});
```

### 5. Mount the router

Register in `src/index.ts`:

```typescript
import subjectsRouter from "./routes/subjects";
app.use("/api/subjects", subjectsRouter);
```

### 6. Update schema & migrations (if needed)

Edit `src/database/schema/app.ts`, then:

```bash
pnpm db:generate
pnpm db:migrate
```

---

## Scripts

| Script        | Command                  | Description                            |
| ------------- | ------------------------ | -------------------------------------- |
| `dev`         | `tsx watch src/index.ts` | Start dev server with hot reload       |
| `build`       | `tsc`                    | Compile TypeScript to `dist/`          |
| `start`       | `node dist/index.js`     | Run production build                   |
| `db:generate` | `drizzle-kit generate`   | Generate migration from schema changes |
| `db:migrate`  | `drizzle-kit migrate`    | Apply pending migrations               |

---

## Deployment

The app reads `PORT` from the environment (Railway, Render, Fly.io, etc. inject this automatically):

```typescript
const PORT = process.env.PORT || 8000;
```

Ensure `DATABASE_URL` is set in your hosting provider's environment variables.

Build and start:

```bash
pnpm build
pnpm start
```

---

## Troubleshooting

### `DATABASE_URL is not defined`

Create a `.env` file with a valid PostgreSQL connection string. The app and Drizzle Kit both require this at startup.

### `500 Failed to get subjects` with `fetch failed` in logs

The Neon HTTP driver could not reach the database. Check:

- `DATABASE_URL` is correct and includes `?sslmode=require` if needed
- Network access to Neon is available from your environment
- The database exists and migrations have been applied (`pnpm db:migrate`)

### `400 Invalid query parameters`

A query param failed validation. Common causes:

- `page=abc` (not a number)
- `page=0` or `limit=0` (below minimum of 1)
- `limit=200` (above maximum of 100)

### Schema changes not reflected

After editing `src/database/schema/app.ts`:

```bash
pnpm db:generate   # create migration
pnpm db:migrate    # apply to database
```

### TypeScript errors with optional defaults

Use `Schema.optionalWith(schema, { default: () => value })` in Effect 3, not `Schema.optional(schema, { default })`.

---

## License

ISC
