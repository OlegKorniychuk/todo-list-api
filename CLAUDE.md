# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

TODO List API — NestJS + PostgreSQL + Drizzle ORM.

Spec lives in `docs/SDD-001.md` — API contracts (routes, request/response shapes, error codes) and
the database schema (ERD + table notes) are the source of truth. Read it before adding or changing
any endpoint or table.

## Commands

```bash
npm run start:dev        # watch mode
npm run build             # nest build -> dist/
npm run lint               # eslint --fix on src/ and test/
npm run format              # prettier --write src/ and test/

npm test                    # unit tests (jest, *.spec.ts, colocated under src/)
npm test -- users.service   # run a single suite by name pattern
npm run test:watch
npm run test:cov
npm run test:e2e            # e2e tests (jest, *.e2e-spec.ts, uses test/jest-e2e.json)

npm run db:generate         # drizzle-kit generate — snapshot src/db/schema.ts -> drizzle/*.sql
npm run db:migrate          # drizzle-kit migrate  — apply pending migrations
npm run db:push             # drizzle-kit push     — push schema directly, no migration file
npm run db:studio           # drizzle-kit studio   — browse the DB
```

### Running with Docker

```bash
docker compose up -d        # db (postgres:16) -> migrate (runs once, exits) -> api
docker compose down          # stop; add -v to also drop the pgdata volume
```

`api` depends on `migrate` completing successfully, which depends on `db` being healthy — schema is
always up to date before the app starts. The `migrate` build target reuses the `build` stage (it
needs `drizzle-kit`, a devDependency, plus `drizzle.config.ts` and `drizzle/`) — see `Dockerfile`.
The final `runtime` stage ships only production deps + compiled `dist/`.

For local (non-Docker) development, copy `.env.example` to `.env` and point `DATABASE_URL` at a
running Postgres (`docker compose up -d db` works for just the DB).

## Notes

- call me dude
- TypeScript is pinned to `^5.7` in devDependencies — npm's default resolution of a bare `typescript`
  range pulled in a `6.x` prerelease that breaks `ts-jest`/`typescript-eslint` peer deps. Don't relax
  this pin without checking those peers first.
- `npm audit` reports vulnerabilities transitively under `jest`/`@nestjs/cli`/`drizzle-kit`
  (`brace-expansion`, `minimatch`, `glob`, `esbuild`) — all dev-tool-only, nothing in the runtime
  dependency tree. Fixing requires major version bumps of those tools; left alone deliberately.
- do not mention claude in commit messages
- always ask for permission before any commit
- always `await` calls to `async` functions explicitly (including `return await x()` in a handler),
  even where returning the bare promise would behave the same — don't rely on implicit promise-return
  semantics
