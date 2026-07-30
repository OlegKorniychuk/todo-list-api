# Implementation Plan: TODO List API business logic

## Overview

The scaffold (`docs/SDD-001.md` contracts + schema, NestJS modules, Drizzle wiring, Docker, CI) is
in place. Every service method currently throws `NotImplementedException`; every controller reads a
hardcoded `TODO_USER_ID` instead of an authenticated caller. This plan sequences the remaining work:
auth → lists → tasks → sharing, following the dependency graph (nothing above auth can be tested
end-to-end without a real logged-in user; tasks and shares both depend on list access resolution).

Current branch is `feat/auth` — Phase 1 below is already the intended scope of that branch.

## Architecture decisions

- **Password hashing: `bcryptjs`** (pure JS, no native addon). Originally chose native `bcrypt`, but
  swapped after confirming the only reason it needed alpine build tools (`python3 make g++`) at all
  was musl vs glibc prebuilt-binary mismatch — not worth the extra Dockerfile surface for this app's
  scale. No Dockerfile changes needed.
- **E2E via Testcontainers, not manual `docker compose up -d db`.** `test/*.e2e-spec.ts` spins up a
  disposable `postgres:16-alpine` container per run (`@testcontainers/postgresql`), runs the Drizzle
  migrations against it, points `DATABASE_URL` at its mapped port, and tears it down after — no
  developer setup step, no shared/stateful test DB, safe to run in CI unmodified (GitHub Actions'
  `ubuntu-latest` runners have Docker preinstalled).
- **Refresh token rotation**: on `POST /auth/refresh`, revoke the presented token (`revoked_at =
  now()`) and issue a new row, rather than reusing the same row. Simpler to reason about and matches
  the `revoked_at` column already in the schema.
- **Access resolution is a single shared helper**, not duplicated per module. `lists`, `tasks`, and
  `shares` all need the same owner-or-viewer-or-none check against `todo_lists` + `list_shares`; built
  once in Phase 2 and reused by every later task.
- **`role: 'editor'` stays unused.** The schema supports it (see `docs/SDD-001.md` § Access model)
  but the current SDD only specifies view-only sharing. Do not wire editor-write behavior into these
  tasks — that's a separate future change requiring an SDD update first, per `CLAUDE.md`.

## Task list

### Phase 1: Auth foundation (current branch)

- [ ] **Task 1: Password hashing utility**
  **Description:** Add `bcryptjs` (bundles its own types, no `@types/*` needed). Small wrapper
  (`hash(plain)`, `verify(plain, hash)`) — no need for a full module, a couple of exported functions
  is enough.
  **Acceptance criteria:**
  - [ ] `hashPassword`/`verifyPassword` round-trip correctly (hash then verify returns true; wrong
        password returns false)
  - [ ] `docker compose build` still succeeds
  **Verification:** `npm test -- crypto`; `docker compose build`
  **Dependencies:** None
  **Files:** `package.json`, `Dockerfile`, `src/common/crypto/password.ts` (+ `.spec.ts`)
  **Scope:** XS

- [ ] **Task 2: `UsersService` real implementation**
  **Description:** Implement `findById`, `findByEmail`, `create` against the `users` table via
  Drizzle. `findByEmail` must be case-insensitive (matches the `lower(email)` unique index).
  **Acceptance criteria:**
  - [ ] `create` inserts and returns the new user; duplicate email throws a `ConflictException` (409)
  - [ ] `findByEmail('Foo@Bar.com')` finds a user stored as `foo@bar.com`
  - [ ] `findById`/`findByEmail` return `undefined`/`null` (not throw) when not found — callers decide
        the HTTP status
  **Verification:** `npm test -- users.service`
  **Dependencies:** None (schema already exists)
  **Files:** `src/modules/users/users.service.ts` (+ `.spec.ts`)
  **Scope:** S

- [ ] **Task 3: `AuthService.register` + `login`**
  **Description:** `register` hashes the password, calls `UsersService.create`, issues an access+
  refresh JWT pair, and persists the refresh token's hash + expiry to `refresh_tokens`. `login` verifies
  credentials and issues the same pair. Controller already has the routes wired (`auth.controller.ts`)
  — just remove the `NotImplementedException` calls.
  **Acceptance criteria:**
  - [ ] `POST /auth/register` with a fresh email returns `201` + user + token pair; duplicate email
        returns `409`
  - [ ] `POST /auth/login` with correct credentials returns `200` + token pair; wrong password or
        unknown email returns `401` (don't leak which one)
  - [ ] A row is written to `refresh_tokens` on both register and login
  **Verification:** `npm test -- auth.service`; manual: `docker compose up -d`, curl register then
  login
  **Dependencies:** Task 1, Task 2
  **Files:** `src/modules/auth/auth.service.ts` (+ `.spec.ts`), `src/modules/users/users.service.ts`
  (read-only use)
  **Scope:** M

- [ ] **Task 4: `JwtAuthGuard` + current-user decorator**
  **Description:** Implement the guard (currently a stub in
  `src/modules/auth/guards/jwt-auth.guard.ts`) to verify the bearer access token and attach the
  resolved user to `request.user`. Add a `@CurrentUser()` param decorator so controllers stop reading
  `TODO_USER_ID`. Apply the guard to `GET /auth/me` and `POST /auth/logout` only in this task — the
  rest of the controllers get it in Phase 2+ alongside their real logic.
  **Acceptance criteria:**
  - [ ] Missing/invalid/expired bearer token → `401`
  - [ ] Valid token → handler receives the correct user id via `@CurrentUser()`
  **Verification:** `npm test -- jwt-auth.guard`
  **Dependencies:** Task 2 (to resolve the user), Task 3 (tokens exist to test against)
  **Files:** `src/modules/auth/guards/jwt-auth.guard.ts` (+ `.spec.ts`),
  `src/modules/auth/decorators/current-user.decorator.ts`
  **Scope:** S

- [ ] **Task 5: `AuthService.refresh` + `logout`**
  **Description:** `refresh` validates the presented refresh token against `refresh_tokens`
  (hash match, not expired, not revoked), revokes it, and issues a new pair (rotation — see
  Architecture decisions). `logout` revokes the caller's current refresh token.
  **Acceptance criteria:**
  - [ ] Valid refresh token → `200` + new pair; old token now rejected on reuse
  - [ ] Expired or revoked token → `401`
  - [ ] `POST /auth/logout` sets `revoked_at` and returns `204`
  **Verification:** `npm test -- auth.service`
  **Dependencies:** Task 3, Task 4
  **Files:** `src/modules/auth/auth.service.ts`, `src/modules/auth/auth.controller.ts`
  **Scope:** M

- [ ] **Task 6: Wire `GET /auth/me`**
  **Description:** Trivial once Task 4/5 land — return the `@CurrentUser()` user, guarded.
  **Acceptance criteria:**
  - [ ] `GET /auth/me` with valid token → `200` + user; no token → `401`
  **Verification:** `npm test -- auth.controller`
  **Dependencies:** Task 4
  **Files:** `src/modules/auth/auth.controller.ts`
  **Scope:** XS

### Checkpoint: Phase 1 — Auth complete

- [ ] `npm run build`, `npm run lint:ci`, `npm run format:check`, `npm test` all pass
- [ ] `docker compose up -d` then full curl flow: register → login → me → refresh → logout → old
      access token still valid until expiry, old refresh token rejected
- [ ] Review with human before starting Phase 2

### Phase 2: Lists

- [ ] **Task 7: Shared list-access resolver**
  **Description:** One service (e.g. `ListAccessService`) with a method like
  `resolve(userId, listId): { role: 'owner' | 'viewer' | null }` — checks `todo_lists.owner_id` first,
  falls back to a `list_shares` lookup. `lists`, `tasks`, and `shares` services all call this instead
  of querying access rules independently.
  **Acceptance criteria:**
  - [ ] Owner → `'owner'`; shared user → `'viewer'`; neither → `null`
  - [ ] Deleted/nonexistent list → `null` (caller maps to `404`)
  **Verification:** `npm test -- list-access`
  **Dependencies:** Phase 1 checkpoint (needs a real authenticated user to test against)
  **Files:** `src/modules/lists/list-access.service.ts` (+ `.spec.ts`)
  **Scope:** S

- [ ] **Task 8: `ListsService.create` / `findAllForUser` / `findOne` + guard wiring**
  **Description:** Apply `JwtAuthGuard` + `@CurrentUser()` to `ListsController`. Implement create
  (owner = caller), list-all (owner ∪ shared, optional `?role=` filter), get-one (403 if no access via
  Task 7's resolver, else include `role` in the response per the SDD resource shape).
  **Acceptance criteria:**
  - [ ] `POST /lists` → `201`, caller is owner
  - [ ] `GET /lists` returns only lists the caller owns or is shared on
  - [ ] `GET /lists/:id` → `403` if resolver returns `null`, `404` if list truly doesn't exist
        (distinguish: no access to an existing list is `403` per SDD, not `404` — don't leak existence
        either way if that's a later hardening concern, but SDD explicitly lists both codes so respect it)
  **Verification:** `npm test -- lists.service`; e2e smoke via curl
  **Dependencies:** Task 7
  **Files:** `src/modules/lists/lists.service.ts` (+ `.spec.ts`), `src/modules/lists/lists.controller.ts`
  **Scope:** M

- [ ] **Task 9: `ListsService.rename` / `remove`**
  **Description:** Owner-only. Non-owner (including viewers) gets `403`.
  **Acceptance criteria:**
  - [ ] Owner renames → `200`; viewer or stranger attempts → `403`
  - [ ] Owner deletes → `204`; cascades tasks + shares (already enforced at the DB level by the FKs —
        just confirm it happens)
  **Verification:** `npm test -- lists.service`
  **Dependencies:** Task 8
  **Files:** `src/modules/lists/lists.service.ts`
  **Scope:** S

### Checkpoint: Phase 2 — Lists complete

- [ ] Full owner CRUD on lists works end-to-end (curl or a `lists.e2e-spec.ts` if written)
- [ ] `npm test` green

### Phase 3: Tasks

- [ ] **Task 10: `TasksService.create` / `findAll` / `findOne`**
  **Description:** Apply guard to `TasksController`. Read access via Task 7's resolver (owner or
  viewer can read); write (`create`) is owner-only.
  **Acceptance criteria:**
  - [ ] Owner creates a task → `201`, defaults `status: 'todo'`
  - [ ] Owner or viewer can list/get tasks; a user with no access → `403`
  - [ ] `?status=` filter on list works
  **Verification:** `npm test -- tasks.service`
  **Dependencies:** Task 7, Task 8 (list must exist/be creatable first)
  **Files:** `src/modules/tasks/tasks.service.ts` (+ `.spec.ts`), `src/modules/tasks/tasks.controller.ts`
  **Scope:** M

- [ ] **Task 11: `TasksService.update` / `updateStatus` / `remove`**
  **Description:** Owner-only for all three. Viewer attempting any → `403`.
  **Acceptance criteria:**
  - [ ] Owner edits title/description → `200`; viewer attempt → `403`
  - [ ] Owner updates status through all three enum values → `200`; invalid status value → `400`
        (already enforced by `UpdateTaskStatusDto`'s `@IsIn` — confirm it's actually reached)
  - [ ] Owner deletes → `204`; viewer attempt → `403`
  **Verification:** `npm test -- tasks.service`
  **Dependencies:** Task 10
  **Files:** `src/modules/tasks/tasks.service.ts`
  **Scope:** M

### Checkpoint: Phase 3 — Tasks complete

- [ ] Full task CRUD + status transitions work for an owner; `npm test` green

### Phase 4: Sharing

- [ ] **Task 12: `SharesService.create`**
  **Description:** Owner-only. Resolve target by email via `UsersService.findByEmail` (404 if no such
  user). Insert into `list_shares` with `role: 'viewer'` (hardcode — SDD doesn't accept a role in the
  request body yet).
  **Acceptance criteria:**
  - [ ] Owner shares with an existing user's email → `201`
  - [ ] Sharing with own email → `422`; sharing with unknown email → `404`; duplicate share → `409`
        (relies on the `list_shares_list_user_unique` index — catch the DB constraint violation and
        map to 409, don't pre-check-then-insert racily)
  - [ ] Non-owner attempting to share → `403`
  **Verification:** `npm test -- shares.service`
  **Dependencies:** Task 7 (ownership check), Task 2 (`findByEmail`)
  **Files:** `src/modules/shares/shares.service.ts` (+ `.spec.ts`), `src/modules/shares/shares.controller.ts`
  **Scope:** M

- [ ] **Task 13: `SharesService.findAll` / `remove`**
  **Description:** Owner-only listing and revocation.
  **Acceptance criteria:**
  - [ ] Owner lists shares → `200` with resolved emails; non-owner → `403`
  - [ ] Owner revokes a share → `204`; revoked user immediately loses list/task read access
  **Verification:** `npm test -- shares.service`
  **Dependencies:** Task 12
  **Files:** `src/modules/shares/shares.service.ts`
  **Scope:** S

### Checkpoint: Phase 4 — Sharing complete, full SDD implemented

- [ ] `npm run build && npm run lint:ci && npm run format:check && npm test` all green
- [ ] Manual full-matrix curl pass: owner CRUD everything; viewer reads list+tasks but every write
      attempt is `403`; revoked viewer loses access immediately
- [ ] Every error code in `docs/SDD-001.md` (`400/401/403/404/409/422`) has been hit at least once

### Phase 5: End-to-end tests

- [ ] **Task 14a: Testcontainers e2e harness**
  **Description:** Add `@testcontainers/postgresql` (dev dep). Global Jest setup
  (`test/setup-e2e.ts`, wired via `globalSetup`/`globalTeardown` in `test/jest-e2e.json`) starts a
  `postgres:16-alpine` container once per e2e run, runs `drizzle-kit migrate` against it
  programmatically, and exports its connection string for the app under test (override
  `DATABASE_URL` before `AppModule` boots in each spec, e.g. via `ConfigModule` override in the
  Nest testing module).
  **Acceptance criteria:**
  - [ ] Container starts, migrations apply, `DATABASE_URL` resolves to the container before any spec
        body runs
  - [ ] Container is torn down after the suite, pass or fail (no leaked containers)
  **Verification:** `npm run test:e2e` (with only a trivial smoke spec) starts/stops a container
  visibly (`docker ps` during a manual run)
  **Dependencies:** Phase 4 checkpoint
  **Files:** `test/setup-e2e.ts`, `test/teardown-e2e.ts`, `test/jest-e2e.json`, `package.json`
  **Scope:** S

- [ ] **Task 14b: Full-flow e2e spec**
  **Description:** `test/app.e2e-spec.ts` walking register → login → create list → invite viewer by
  email → viewer reads list+tasks → viewer write attempts rejected (403) → owner task CRUD → owner
  revokes share → viewer access gone.
  **Acceptance criteria:**
  - [ ] `npm run test:e2e` passes against the Testcontainers-provisioned database
  - [ ] Every status code in the SDD error table (`400/401/403/404/409/422`) is exercised at least
        once across the spec
  **Verification:** `npm run test:e2e`
  **Dependencies:** Task 14a
  **Files:** `test/app.e2e-spec.ts`
  **Scope:** M

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Race on duplicate share / duplicate email (check-then-insert TOCTOU) | Low | Rely on DB unique constraints, catch the Postgres error code, map to `409` — never pre-check-then-insert as the only guard |
| `403` vs `404` ambiguity on lists/tasks a user can't see | Low | SDD already specifies both codes per endpoint (`docs/SDD-001.md`); follow it literally, don't invent an existence-hiding scheme it doesn't ask for |
| Refresh token rotation reuse-detection (stolen token replay) | Low, out of scope | Not in the current SDD; note only — revisit if auth hardening is requested later |
| Testcontainers needs Docker-in-Docker in CI | Low | GitHub Actions `ubuntu-latest` ships Docker preinstalled; no change needed to `ci.yml` beyond letting `test:e2e` run there if/when it's added to the workflow |
