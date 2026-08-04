# Development Progress — Hermes Backend

**Purpose**: Single source of truth for AI agent session handoff. Updated after every completed task.

---

## Current State

| Field | Value |
|-------|-------|
| **Phase** | 1 — Core Infrastructure & Auth |
| **Branch** | `feat/phase-1-core-infra` |
| **Last Commit** | `ca2b948` — feat(i18n): add i18n core module with locale detection, translations, and resource files for en/es/pt-BR |
| **PR** | Not yet opened |
| **PR URL** | — |

---

## Task Status

### Phase 0.B — Tooling Setup

| Task | Status | Commit |
|------|:------:|--------|
| D0.B.1 — Initialize repo (`package.json`, `tsconfig.json`, ESLint, Prettier, Vitest) | ✅ | `91452aa` |
| D0.B.2 — Set up Drizzle ORM with SQLite adapter, initial migration | ✅ | `8363247` |
| D0.B.3 — Create `DatabaseAdapter` interface + `SQLiteAdapter` implementation | ✅ | `3163eb0` |
| Quality Gate — `npm test`, `npm run build`, migration against `:memory:` | ✅ | `3163eb0` |
| Review fixes — prune deps, drop baseUrl, vite-tsconfig-paths, meaningful test | ✅ | `02651b1` |

### Phase 1 — Core Infrastructure & Auth

| Task | Status | Commit |
|------|:------:|--------|
| D1.1 — Fastify v5 server with health endpoint (`GET /health`, `GET /health/deep`) | ✅ | `e8cdc2d` |
| D1.2 — SQLite connection with WAL PRAGMAs | ✅ | `e8cdc2d` |
| D1.3 — Configuration loader (`src/shared/config.ts`) | ✅ | `e8cdc2d` |
| D1.4 — `users` table + repository (Drizzle) | ✅ | `aba6762` |
| D1.5 — Password hashing (bcrypt, cost ≥ 12) + unit tests | ✅ | `b333617` |
| D1.6 — JWT RS256 key pair generation + sign/verify utilities + unit tests | ✅ | `b333617` |
| D1.7 — `POST /auth/login` | ✅ | `aba6762` |
| D1.8 — `POST /auth/refresh` — token rotation with reuse detection | ✅ | `54d4183` |
| D1.9 — `POST /auth/logout` | ✅ | `5c67f75` |
| D1.10 — `user_sessions` table + repository | ✅ | `aba6762` |
| D1.11 — Auth middleware chain (CORS → Helmet → Rate Limiter → JWT Verifier → RBAC Guard) | ✅ | `79977fd` |
| D1.12 — `GET /users/me`, `POST /users`, `GET /users` (admin) | ✅ | `8ef638b` |
| D1.13 — i18n: `src/i18n/` structure — locale detector, resource loader, `t()` function | ✅ | `ca2b948` |
| D1.14 — i18n: resource files `en/` — extract existing strings from codebase | ✅ | `ca2b948` |
| D1.15 — i18n: resource files `es/` — complete Spanish translation | ✅ | `ca2b948` |
| D1.16 — i18n: resource files `pt-BR/` — complete Portuguese (Brazil) translation | ✅ | `ca2b948` |
| D1.17 — i18n: `locale` field in JWT payload + `users.locale` column | ✅ | `ca2b948` |

### Phase 2 — Database Layer & Repository Pattern

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D2.1–D2.16) | ⬜ READY | — |

### Phase 3 — HAL & Radio Integration

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D3.1–D3.16) | ⬜ BLOCKED (Phase 2 not complete) | — |

### Phase 4 — Messaging & Conversations

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D4.0–D4.16) | ⬜ BLOCKED (Phase 2 not complete) | — |

### Phase 5 — WebSocket Gateway

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D5.1–D5.13) | ⬜ BLOCKED (Phase 4 not complete) | — |

### Phase 6 — Attachments, Geolocation & Scheduling

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D6.1–D6.13) | ⬜ BLOCKED (Phase 5 not complete) | — |

### Phase 7 — System Management, Clock Sync & Resilience

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D7.1–D7.19) | ⬜ BLOCKED (Phase 6 not complete) | — |

### Phase 8 — Security Hardening & Legacy Compatibility

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D8.1–D8.10) | ⬜ BLOCKED (Phase 7 not complete) | — |

### Phase 9 — Testing, Validation & Deployment

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D9.1–D9.10) | ⬜ BLOCKED (Phase 8 not complete) | — |

---

## Next Task

> **Phase 1 Complete** — All tasks D1.1–D1.17 ✅. Next: Phase 2 — Database Layer & Repository Pattern (D2.1). Create branch `feat/phase-2-database` from `main` and begin.

---

## Notes & Blockers

- D1.13–D1.17 complete: i18n core module with 18 resource files (3 locales × 6 domains), locale detector, `t()` function with interpolation, `sendError()` i18n integration, `i18n:check` script. 96 tests pass (54 existing + 42 new unit tests).
- Phase 1 is fully complete. All tasks D1.1–D1.17 ✅. Ready for Phase 2.
- Phase 0.B is complete with all review fixes applied (7 commits on `feat/phase-0b-tooling`).
  - `npm run build` — zero TypeScript errors
  - `npm test` — 10 tests pass (SQLiteAdapter, health integration, password, token)
  - Migration against `:memory:` — users table with 13 columns, 6 indexes
- GitHub push failed (no credentials). PR must be created manually.
- Phase 1 started from current state (all Phase 0.B code is on `main`-equivalent branch).
- D1.8 complete: `POST /auth/refresh` with full ADR-004 token rotation + reuse detection. 15 tests pass.
- D1.9 complete: `POST /auth/logout` with session revocation. Idempotent. 21 tests pass overall.
- D1.11 complete: Auth middleware chain with 19 integration tests. RFC 7807 errors, adapter decoupling, logout protected.
- D1.12 complete: User endpoints (GET /users/me, POST /users, GET /users) with 13 integration tests. 54 tests pass overall.
  - Password hashes stripped from all responses
  - Admin-only routes (`POST /users`, `GET /users`) use `requireRole('admin')`
  - JSON Schema validation with `maxLength` and `minLength` constraints
  - Duplicate callsign detection returns 409

---

## Session Log

| Date | Session | Tasks Completed |
|------|---------|----------------|
| 2026-07-30 | Session 1 | D0.B.1, D0.B.2, D0.B.3, Quality Gate |
| 2026-07-30 | Session 1b | Review fixes: prune deps, drop baseUrl, vite-tsconfig-paths, meaningful test |
| 2026-08-03 | Session 2 | D1.1-D1.7, D1.10, review fixes, dotenv/config fix |
| 2026-08-03 | Session 3 | D1.8 — refresh token rotation with reuse detection |
| 2026-08-03 | Session 4 | D1.9 — logout endpoint with session revocation (6 tests) |
| 2026-08-03 | Session 5 | D1.11 — auth middleware chain (18 tests) |
| 2026-08-03 | Session 6 | D1.12 — user endpoints (13 tests) |
| 2026-08-04 | Session 7 | D1.13–D1.17 — i18n module (18 resource files, 42 tests) |

---

## Legend

| Mark | Meaning |
|:----:|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Complete |
| ⚠️ | Blocked / needs attention |