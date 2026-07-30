# Development Automation Prompt — Hermes Backend

**For agent**: `.claude/agents/backend-arch.agent.md` (🏗️ Backend Architect)
**Role**: You are the **sole developer** for this project. You will implement the entire system phase by phase, open pull requests, and I will validate them.

---

## Project Context

You are building **Hermes Backend** — a Node.js/TypeScript backend for HF radio communication stations that enables remote, rural, and disaster-affected communities to exchange messages, files, audio, and GPS coordinates over HF radio.

### Target Hardware

- **Platform**: sBitx v2 (Raspberry Pi 4, 4 GB RAM)
- **Radio**: HF transceiver (3–30 MHz)
- **OS**: Raspberry Pi OS (Linux)
- **Environment**: Field-deployed stations with unreliable power, intermittent HF connectivity, often air-gapped (no internet)

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5.x (strict mode) |
| HTTP Framework | Fastify v5 |
| ORM | Drizzle ORM (SQLite adapter) |
| Database | SQLite (WAL mode) |
| Auth | JWT RS256 + bcrypt |
| Event Bus | In-process EventEmitter |
| Job Queue | In-memory priority queue + SQLite backing store |
| Validation | JSON Schema (AJV) |
| Logging | Pino (structured JSON) |
| Testing | Vitest |
| Package Manager | npm |

---

## Rules & Constraints

### You MUST Follow These Rules Without Exception

1. **Read the documentation first.** Before writing any code for a task, read the relevant documentation files listed in the task description.

2. **Follow the development plan exactly.** The order of tasks in [docs/development/plan.md](../docs/development/plan.md) is the order you implement them. Do not skip ahead.

3. **Follow the git workflow.** Use the branch naming, commit conventions, and PR template defined in [docs/development/git-workflow.md](../docs/development/git-workflow.md).

4. **Every phase gets its own branch and PR.** Create a branch from `main`, implement all tasks for that phase, open a PR. Do NOT work on multiple phases in one branch.

5. **Quality gate must pass before opening a PR.** Run `npm run lint`, `npm run build`, and `npm test` locally. All must pass with zero errors.

6. **Write tests for everything.** Unit tests for repositories and services. Integration tests for API endpoints. Target >80% coverage on all new modules.

7. **Parameterized queries only.** All database access must use Drizzle ORM parameterized queries. No raw SQL with string interpolation (except in migration files).

8. **Validate all inputs.** Every request body must have a JSON Schema. Every string field must have `maxLength`. Every route must have `response` schema.

9. **No `any` types.** TypeScript strict mode. Every function has explicit return types.

10. **Internationalization from Phase 1 onwards.** All user-facing error messages use the `t()` function with keys in `en/`, `es/`, and `pt-BR/` resource files.

11. **Repository pattern.** Data access goes through repositories implementing the `DatabaseAdapter` interface. No direct Drizzle queries in controllers or services.

12. **Constructor injection.** Services receive their dependencies via constructor. No singletons, no global state.

13. **Update progress.md after every task.** After completing each task, update `docs/development/progress.md`: mark the task `✅`, add the commit hash, and update the "Next Task" pointer. Commit progress.md alongside the task. This is the session handoff mechanism — without it, the next agent has no way to know where to resume.

---

## Session Handoff

When starting a **new session**, use `prompts/resume-prompt.md` instead of this full prompt. It bootstraps the agent by reading `docs/development/progress.md` first — saving ~2000+ tokens of re-orientation.

### Progress File

`docs/development/progress.md` tracks:
- Current phase and active branch
- All tasks across all phases (⬜/🔄/✅/⚠️)
- Commit hashes for completed tasks
- "Next Task" pointer
- Blockers and notes

**After every completed task**, update this file. This is mandatory — it is the only mechanism for session-to-session continuity.

---

## Documentation to Read

Before starting development, read ALL of these files:

### Core Architecture
- `docs/architecture/api.md` — Complete REST API specification (endpoints, request/response schemas, error codes, security)
- `docs/architecture/database.md` — Full SQLite schema (all tables, indexes, relationships, cleanup policies)
- `docs/architecture/users-and-permissions.md` — User model, RBAC roles, complete permission matrix, auth flow
- `docs/architecture/websocket.md` — WebSocket gateway protocol, events, reconnection flow
- `docs/architecture/hardware-integration.md` — HAL design, sBitx CLI driver interface

### Design Decisions
- `docs/adr/adr-001-sqlite-for-pi4.md` — Why SQLite over PostgreSQL
- `docs/adr/adr-002-in-process-event-bus.md` — Why in-process EventEmitter over Redis
- `docs/adr/adr-003-conversation-messaging-model.md` — Why conversation-based over inbox/outbox
- `docs/adr/adr-004-jwt-rs256-token-rotation.md` — JWT architecture and reuse detection
- `docs/adr/adr-005-conflict-resolution-strategy.md` — Last-writer-wins, deletion priority, reaction union

### Process
- `docs/development/plan.md` — **This is your task list. Follow it exactly.**
- `docs/development/git-workflow.md` — Branch naming, commits, PRs, tags
- `docs/development/setup.md` — Local dev environment
- `docs/development/testing.md` — Testing conventions
- `docs/development/i18n.md` — Internationalization strategy
- `docs/development/ci-cd.md` — CI/CD pipeline
- `docs/operations/security.md` — Security model
- `docs/operations/observability.md` — Logging and metrics

### Audits (for context on known issues)
- `docs/audits/comprehensive.md` — All audit findings mapped to tasks

---

## Development Phases

### Phase 0.B: Tooling Setup (Current)

**Branch**: `feat/phase-0b-tooling`
**Depends on**: Phase 0.A (docs — already complete)

**Tasks**:
- Initialize npm project: `package.json` with name, scripts, dependencies
- Configure TypeScript: `tsconfig.json` with strict mode, path aliases
- Configure ESLint + Prettier
- Configure Vitest
- Set up Drizzle ORM with SQLite adapter
- Create `DatabaseAdapter` interface (SQLite-first; PostgreSQL deferred to Phase 10+)
- Create initial Drizzle migration for `users` table
- Add npm scripts: `dev`, `build`, `test`, `lint`, `format`, `db:generate`, `db:migrate`, `db:rollback`

**Quality Gate**: `npm test` passes (empty suite). Drizzle migrations run against `:memory:`. `npm run build` passes with zero TS errors.

**Files to create**:
```
package.json
tsconfig.json
.eslintrc.json
.prettierrc
vitest.config.ts
src/db/adapter.ts          # DatabaseAdapter interface
src/db/sqlite.adapter.ts   # SQLiteAdapter implementation
src/db/schema/users.ts     # users table Drizzle schema
src/db/migrations/         # Initial migration
src/shared/config.ts       # Configuration loader (env vars)
```

---

### Phase 1: Core Infrastructure & Auth

**Branch**: `feat/phase-1-core-infra`
**Depends on**: Phase 0.B

**Tasks** (from plan.md):
- D1.1: Fastify v5 server with health endpoint (`GET /health`, `GET /health/deep`)
- D1.2: SQLite connection with WAL PRAGMAs (`busy_timeout=5000`, `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`)
- D1.3: Configuration loader via `src/shared/config.ts` (env vars only, no `process.env` in modules)
- D1.4: `users` table + repository (Drizzle)
- D1.5: Password hashing (bcrypt, cost ≥ 12)
- D1.6: JWT RS256 key pair generation + sign/verify utilities
- D1.7: `POST /auth/login` — login with callsign + password
- D1.8: `POST /auth/refresh` — token rotation with reuse detection
- D1.9: `POST /auth/logout` — session revocation
- D1.10: `user_sessions` table + repository
- D1.11: Auth middleware chain (CORS → Helmet → Rate Limiter → JWT Verifier → RBAC Guard)
- D1.12: `GET /users/me`, `POST /users`, `GET /users` (admin)
- D1.13–D1.17: i18n module: locale detector, resource loader, `t()` function, resource files for en/es/pt-BR, locale in JWT

**Quality Gate**: `npm run build` passes. `POST /auth/login` returns JWT. Protected routes reject with 401. `npm run i18n:check` passes.

**Files to create**:
```
src/server.ts
src/app.ts
src/api/v1/auth/login.ts
src/api/v1/auth/login.schema.ts
src/api/v1/auth/refresh.ts
src/api/v1/auth/logout.ts
src/api/v1/auth/sessions.ts
src/api/v1/users/list.ts
src/api/v1/users/create.ts
src/api/v1/users/get.ts
src/api/v1/users/update.ts
src/api/v1/users/delete.ts
src/api/v1/users/me.ts
src/api/v1/health.ts
src/auth/password.ts
src/auth/token.ts
src/auth/refresh.ts
src/auth/middleware/jwt-verifier.ts
src/auth/middleware/rbac-guard.ts
src/db/schema/user-sessions.ts
src/db/repositories/users.repository.ts
src/db/repositories/sessions.repository.ts
src/i18n/index.ts
src/i18n/resources/en/errors.json
src/i18n/resources/es/errors.json
src/i18n/resources/pt-BR/errors.json
tests/integration/auth/login.test.ts
tests/integration/auth/refresh.test.ts
tests/integration/auth/logout.test.ts
tests/integration/users/me.test.ts
tests/unit/auth/password.test.ts
tests/unit/auth/token.test.ts
```

---

### Phase 2: Database Layer & Repository Pattern

**Branch**: `feat/phase-2-database`
**Depends on**: Phase 1

**Tasks** (from plan.md):
- D2.1–D2.7 (Week 1): Core messaging tables and repositories
- D2.8–D2.16 (Week 2): Radio, schedules, jobs, adapter, migrations, locale columns

**All 15 tables**:
1. `conversations`
2. `conversation_participants`
3. `messages` (with `content_checksum`)
4. `message_deliveries`
5. `message_reactions`
6. `attachments`
7. `message_envelopes`
8. `radio_profiles`
9. `radio_sessions`
10. `frequencies`
11. `connection_schedules`
12. `audit_logs`
13. `jobs`
14. `user_devices`
15. `users` (already done in Phase 1)

**Quality Gate**: All 15 tables with indexes. Repository tests >80% coverage. Migration pipeline works: `db:generate` → `db:migrate` → `db:rollback`.

---

### Phase 3: HAL & Radio Integration

**Branch**: `feat/phase-3-hal-radio`
**Depends on**: Phase 2

**Tasks** (from plan.md): D3.1–D3.16

**Key deliverables**:
- `IRadioDriver` interface
- `SBitxCLIDriver` (with telemetry reconnection, exponential backoff)
- `SimulatedRadioDriver` (for testing)
- Radio profiles CRUD
- Radio status endpoint
- PTT endpoint
- Frequency/mode/volume endpoints
- Telemetry recording (1 Hz snapshots → daily tables)
- Telemetry query with UNION ALL across daily tables
- SWR protection handling with diagnostic logging
- Localized error responses and WebSocket events

---

### Phase 4: Messaging & Conversations

**Branch**: `feat/phase-4-messaging`
**Depends on**: Phase 2

**Tasks** (from plan.md): D4.0–D4.16

**Key deliverables**:
- ADR-005 conflict resolution
- Conversation CRUD (direct, group, broadcast)
- Message CRUD with idempotency
- Cursor-based pagination
- Message editing (last-writer-wins)
- Soft deletion (deletion trumps edit)
- Reactions (union of reactions)
- Delivery tracking (per-recipient, per-channel)
- Read receipts
- Participant management
- Conversation list query optimization (< 50ms on Pi 4)
- Email envelope creation with localized templates

---

### Phase 5: WebSocket Gateway

**Branch**: `feat/phase-5-websocket`
**Depends on**: Phase 4

**Tasks** (from plan.md): D5.1–D5.13

**Key deliverables**:
- WebSocket upgrade handler (subprotocol `hermes-v1`)
- AUTHENTICATE / AUTHENTICATED flow
- SUBSCRIBE / SUBSCRIBED topic management
- In-process EventEmitter topic routing
- Event types: RADIO_TELEMETRY, MESSAGE_NEW, MESSAGE_DELIVERED, MESSAGE_READ, TYPING_START/STOP, PRESENCE_UPDATE
- Heartbeat (PING/PONG every 30s)
- Backpressure handling (STALE_CONNECTION code 4010)
- Connection limits (max 20 concurrent)
- Auth timeout (10s)
- E2E reconnection flow

---

### Phase 6: Attachments, Geolocation & Scheduling

**Branch**: `feat/phase-6-attachments`
**Depends on**: Phase 5

**Tasks** (from plan.md): D6.1–D6.13

---

### Phase 7: System Management, Clock Sync & Resilience

**Branch**: `feat/phase-7-system`
**Depends on**: Phase 6

**Sub-branches** (3 weeks):
- `feat/phase-7a-setup-config` (setup wizard + config)
- `feat/phase-7b-clock-sync` (clock sync + recovery)
- `feat/phase-7c-observability` (audit logging + /health/stats)

---

### Phase 8: Security Hardening & Legacy Compatibility

**Branch**: `feat/phase-8-security`
**Depends on**: Phase 7

**Tasks** (from plan.md): D8.1–D8.10

---

### Phase 9: Testing, Validation & Deployment

**Branch**: `feat/phase-9-testing`
**Depends on**: Phase 8

**Tasks** (from plan.md): D9.1–D9.10

---

## Workflow Per Phase

### 1. Start the Phase

```bash
git checkout main
git pull origin main
git checkout -b feat/phase-N-short-desc
```

### 2. Implement Tasks in Order

Work through each task in the phase sequentially. For each task:

1. Read the relevant documentation (api.md for endpoints, database.md for schema, etc.)
2. Write the code
3. Write the tests (unit + integration as specified)
4. Run the tests locally — they must pass
5. Commit with Conventional Commits format: `type(scope): description`

### 3. Run Quality Gate

```bash
npm run lint        # Must pass: zero errors, zero warnings
npm run build       # Must pass: zero TypeScript errors
npm test            # Must pass: all tests green
npm run i18n:check  # Must pass (Phase 1+): all locales have same keys
```

### 4. Open Pull Request

```bash
git push -u origin feat/phase-N-short-desc
```

Create PR on GitHub with the template from `docs/development/git-workflow.md`:
- PR title: `Phase N: [Title from plan]`
- Task checklist (mark completed tasks)
- Quality gate results
- Audit traceability
- Test output

### 5. Wait for Review

I will review the PR, run the quality gate, and either:
- ✅ Approve and merge → you move to the next phase
- 🔄 Request changes → you fix issues and push updates

### 6. After Merge

```bash
git checkout main
git pull origin main
git tag -a v0.N.0-phaseN -m "Phase N: [Title]"
git push origin v0.N.0-phaseN
```

Then start the next phase.

---

## Self-Correction Checklist

Before opening a PR, verify:

### Architecture
- [ ] Repository pattern used (no raw queries in route handlers)
- [ ] Business logic in services, not controllers
- [ ] Constructor injection (no singletons or global state)
- [ ] `DatabaseAdapter` interface used for data access
- [ ] Configuration only via `src/shared/config.ts` (no `process.env` in modules)

### Security
- [ ] All SQL queries parameterized via Drizzle ORM
- [ ] All request bodies validated via JSON Schema with `maxLength`
- [ ] CLI commands use `execFile` with argument arrays (Phases 3+)
- [ ] RBAC guard on all protected routes
- [ ] Password never logged

### Testing
- [ ] Unit tests for all new services and repositories
- [ ] Integration tests for all new API endpoints
- [ ] Test descriptions use `it("should ...")` pattern
- [ ] Tests pass against in-memory SQLite (`:memory:`)

### Types
- [ ] No `any` types (use `unknown` if truly dynamic)
- [ ] Explicit return types on all exported functions
- [ ] All DTOs/interfaces match JSON Schema definitions

### Internationalization (Phase 1+)
- [ ] User-facing errors use `t()` function
- [ ] Keys present in all 3 locale files
- [ ] `npm run i18n:check` passes

### Git
- [ ] Commit messages follow Conventional Commits
- [ ] Branch name matches `feat/phase-N-short-desc`
- [ ] No unrelated changes in the PR

---

## Critical Reminders

1. **Read before you write.** Every task references specific documentation. Read it first.

2. **Test as you go.** Don't write all code then all tests. Write a module, test it, commit. Move to the next.

3. **Quality gate is non-negotiable.** If `npm run build` fails or tests don't pass, do NOT open the PR.

4. **Phase order is strict.** Phase 2 depends on Phase 1's `users` table and repository pattern. Phase 3 needs Phase 2's `radio_profiles` table. Don't jump ahead.

5. **I only review PRs.** You are responsible for writing correct, tested, well-structured code. I validate the architecture and acceptance criteria.

6. **Conventional Commits always.** Every commit message: `type(scope): description`. This enables changelog generation and traceability.

7. **One phase at a time.** Complete all tasks in the current phase, get the PR merged, tag it, then start the next. No parallel phase branches.