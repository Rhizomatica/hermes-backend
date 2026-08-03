# Development Progress — Hermes Backend

**Purpose**: Single source of truth for AI agent session handoff. Updated after every completed task.

---

## Current State

| Field | Value |
|-------|-------|
| **Phase** | 1 — Core Infrastructure & Auth |
| **Branch** | `feat/phase-1-core-infra` |
| **Last Commit** | `e8cdc2d` — feat(core): Fastify server, health endpoints, SQLite WAL, config loader |
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
| D1.4 — `users` table + repository (Drizzle) | 🔄 | — |
| D1.5 — Password hashing (bcrypt, cost ≥ 12) | ⬜ TODO | — |
| D1.6 — JWT RS256 key pair generation + sign/verify utilities | ⬜ TODO | — |
| D1.7 — `POST /auth/login` | ⬜ TODO | — |
| D1.8 — `POST /auth/refresh` | ⬜ TODO | — |
| D1.9 — `POST /auth/logout` | ⬜ TODO | — |
| D1.10 — `user_sessions` table + repository | ⬜ TODO | — |
| D1.11 — Auth middleware chain (CORS → Helmet → Rate Limiter → JWT Verifier → RBAC Guard) | ⬜ TODO | — |
| D1.12 — `GET /users/me`, `POST /users`, `GET /users` (admin) | ⬜ TODO | — |
| D1.13–D1.17 — i18n module | ⬜ TODO | — |

### Phase 2 — Database Layer & Repository Pattern

| Task | Status | Commit |
|------|:------:|--------|
| All tasks (D2.1–D2.16) | ⬜ BLOCKED (Phase 1 not complete) | — |

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

> **D1.4** — `users` table + repository (Drizzle) — currently in progress

---

## Notes & Blockers

- Phase 0.B is complete with all review fixes applied (7 commits on `feat/phase-0b-tooling`).
  - `npm run build` — zero TypeScript errors
  - `npm test` — 2 tests pass (SQLiteAdapter health check + graceful close)
  - Migration against `:memory:` — users table with 13 columns, 6 indexes
- GitHub push failed (no credentials). PR must be created manually.
- Phase 1 started from current state (all Phase 0.B code is on `main`-equivalent branch).

---

## Session Log

| Date | Session | Tasks Completed |
|------|---------|----------------|
| 2026-07-30 | Session 1 | D0.B.1, D0.B.2, D0.B.3, Quality Gate |
| 2026-07-30 | Session 1b | Review fixes: prune deps, drop baseUrl, vite-tsconfig-paths, meaningful test |
| 2026-08-03 | Session 2 | Starting Phase 1 |

---

## Legend

| Mark | Meaning |
|:----:|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Complete |
| ⚠️ | Blocked / needs attention |