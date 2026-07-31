# TODO List API

A REST API for managing todo-lists, tasks, and view-only sharing. Built with
NestJS, PostgreSQL, and Drizzle ORM.

## Features

- Email/password auth with access + refresh JWTs
- Todo-lists: create, rename, delete
- Tasks: create, edit, delete, status updates, manual drag-and-drop ordering
- Share a list read-only with another user by email

Full API contract (routes, request/response shapes, error codes) and the
database schema live in [`docs/SDD-001.md`](docs/SDD-001.md) — read it before
touching any endpoint or table.

## Stack

- TypeScript, NestJS
- PostgreSQL, Drizzle ORM + Drizzle Kit
- Jest (unit + e2e)

## Getting started

### With Docker

```bash
docker compose up -d
```

This starts Postgres, runs pending migrations once, then starts the API on
`http://localhost:3000`. `docker compose down -v` also drops the database
volume.

### Local (without Docker)

```bash
cp .env.example .env         # point DATABASE_URL at a running Postgres
docker compose up -d db      # or run your own Postgres instance
npm install
npm run db:migrate
npm run start:dev
```

Either way, set `CORS_ORIGIN` in `.env` to your frontend's origin — CORS
fails closed with no permissive fallback.

## API docs

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`
- Contract source of truth: [`docs/SDD-001.md`](docs/SDD-001.md)

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start the API in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | Lint and auto-fix `src/` and `test/` |
| `npm run format` | Format with Prettier |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests (spins up a real Postgres via testcontainers) |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Browse the database |

## Project layout

```
src/
  modules/    auth, users, lists, tasks, shares, health
  db/         Drizzle schema and database module
  config/     env validation and configuration
drizzle/      generated SQL migrations
test/         e2e specs
```
