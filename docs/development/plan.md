# Hermes Backend — Development Plan

Based on the current documentation structure and the sBitx v2 constraints, here's a phased development plan moving from architecture docs → working code.

---

## Phase 0: Documentation & Tooling Setup (Current)

**Goal**: Solidify the specification before any code is written.

### D0.A — Documentation (Complete ✅)

| Task | Deliverable | Status |
|------|-------------|:---:|
| D0.A.1 | Core specs: `docs/api.md`, `docs/database.md` | ✅ Done |
| D0.A.2 | Architecture audit: `docs/architecture-audit-sbitx-v2.md` | ✅ Done |
| D0.A.3 | ADRs: [ADR-001](adr/adr-001-sqlite-for-pi4.md), [ADR-002](adr/adr-002-in-process-event-bus.md), [ADR-003](adr/adr-003-conversation-messaging-model.md), [ADR-004](adr/adr-004-jwt-rs256-token-rotation.md) | ✅ Done |
| D0.A.4 | Root files: `README.md`, `LICENSE` (GPLv3), `CONTRIBUTING.md`, `CHANGELOG.md`, `.gitignore`, `.env.example` | ✅ Done |
| D0.A.5 | Dev docs: [Development Guide](development.md), [CI/CD](ci-cd.md), [Testing Strategy](testing-strategy.md), [Security](security.md) | ✅ Done |
| D0.A.6 | Ops docs: [Deployment](deployment.md), [WebSocket](websocket.md), [Hardware Integration](hardware-integration.md), [Observability](observability.md) | ✅ Done |
| D0.A.7 | Cleaned up: `docs/rest_api.md` marked as deprecated (superseded by `docs/api.md`) | ✅ Done |
| D0.A.8 | i18n strategy: `docs/i18n.md` — 3 languages (en, es, pt-BR), locale resolution, resource structure | ✅ Done |
| D0.A.9 | Updated `docs/api.md` with Accept-Language header and localized error responses | ✅ Done |
| D0.A.10 | Updated `docs/database.md` with locale columns (`users.locale`, `audit_logs.locale`, `message_envelopes.locale`) | ✅ Done |
| D0.A.11 | Updated `docs/development.md` with i18n section | ✅ Done |
| D0.A.12 | Updated `docs/tasks/plan.md` with i18n tasks across all phases | ✅ Done |

### D0.B — Tooling Setup (Pending — Phase 1 Prerequisite)

| Task | Deliverable | Depends On |
|------|-------------|------------|
| D0.B.1 | Initialize repo: `package.json`, `tsconfig.json`, ESLint, Prettier, Vitest config | — |
| D0.B.2 | Set up Drizzle ORM with SQLite adapter, initial migration | D0.3 |
| D0.B.3 | Create `DatabaseAdapter` interface with SQLite implementation stub | D0.B.2 |

**Milestone**: `npm test` passes with an empty test suite. Drizzle migrations run against an in-memory SQLite database.

---

## Phase 1: Core Infrastructure & Auth (Week 1–2)

**Goal**: Fastify server boots, connects to SQLite, users can authenticate.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D1.1 | Fastify v5 server with health endpoint (`GET /health`, `GET /health/deep`) | Integration |
| D1.2 | SQLite connection with WAL PRAGMAs, busy_timeout, foreign_keys | Unit |
| D1.3 | Configuration loader (env vars + config file) | Unit |
| D1.4 | `users` table + repository (Drizzle) | Unit |
| D1.5 | Password hashing (bcrypt, cost ≥ 12) | Unit |
| D1.6 | JWT RS256 key pair generation + sign/verify utilities | Unit |
| D1.7 | `POST /auth/login` — login with callsign + password | Integration |
| D1.8 | `POST /auth/refresh` — token rotation with reuse detection | Integration |
| D1.9 | `POST /auth/logout` — session revocation | Integration |
| D1.10 | `user_sessions` table + repository | Unit |
| D1.11 | Auth middleware chain: CORS → Helmet → Rate Limiter → JWT Verifier → RBAC Guard | Unit + Integration |
| D1.12 | `GET /users/me`, `POST /users`, `GET /users` (admin) | Integration |
| D1.13 | i18n: `src/i18n/` structure — locale detector, resource loader, `t()` function | Unit |
| D1.14 | i18n: resource files `en/` — extract existing strings from codebase | Unit |
| D1.15 | i18n: resource files `es/` — complete Spanish translation | Unit |
| D1.16 | i18n: resource files `pt-BR/` — complete Portuguese (Brazil) translation | Unit |
| D1.17 | i18n: `locale` field in JWT payload + `users.locale` column | Unit + Integration |

**Milestone**: API boots. `POST /auth/login` returns JWT tokens with locale. Protected routes reject unauthenticated requests. Error messages rendered in user's preferred language (en/es/pt-BR).

---

## Phase 2: Database Layer & Repository Pattern (Week 3)

**Goal**: Complete database layer with all tables, migrations, and the adapter interface.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D2.1 | `conversations` table + repository | Unit |
| D2.2 | `conversation_participants` table + repository | Unit |
| D2.3 | `messages` table + repository (with idempotency via `client_message_id`) | Unit |
| D2.4 | `message_deliveries` table + repository | Unit |
| D2.5 | `message_reactions` table + repository | Unit |
| D2.6 | `attachments` table + repository | Unit |
| D2.7 | `message_envelopes` table + repository | Unit |
| D2.8 | `radio_profiles` + `radio_sessions` tables + repositories | Unit |
| D2.9 | `frequencies` + `connection_schedules` tables + repositories | Unit |
| D2.10 | `audit_logs` table + repository (immutable, append-only) | Unit |
| D2.11 | `jobs` table + repository (SQLite-backed queue) | Unit |
| D2.12 | `DatabaseAdapter` interface implemented for all repositories | Unit |
| D2.13 | Migration pipeline: `npm run db:generate`, `db:migrate`, `db:rollback` | Manual |
| D2.14 | Migration: add `locale` column to `users` table (DEFAULT 'en', CHECK IN) | Unit |
| D2.15 | Migration: add `locale` column to `audit_logs` table (DEFAULT 'en') | Unit |
| D2.16 | Migration: add `locale` column to `message_envelopes` table (DEFAULT 'en') | Unit |

**Milestone**: All 15 tables created, indexed, and queryable. All repository tests pass against in-memory SQLite. Locale columns present on all i18n-relevant tables. No sync tables needed — clients fetch current state via REST on reconnect.

---

## Phase 3: HAL & Radio Integration (Week 4–5)

**Goal**: Hardware Abstraction Layer talks to sBitx CLI. Radio status and telemetry endpoints work.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D3.1 | `IRadioDriver` interface definition | — |
| D3.2 | `SBitxCLIDriver` — wraps `execFile` calls to sBitx CLI | Unit (mocked) |
| D3.3 | `SimulatedRadioDriver` — fake radio for testing/development | Unit |
| D3.4 | Radio profiles CRUD endpoints (`/radio/profiles`) | Integration |
| D3.5 | `GET /radio/status` — real-time radio snapshot | Integration |
| D3.6 | `POST /radio/ptt` — push-to-talk | Integration |
| D3.7 | `POST /radio/profiles/:idx/frequency` — set frequency | Integration |
| D3.8 | Radio telemetry recording: 1 Hz snapshots → `telemetry_YYYYMMDD` tables | Integration |
| D3.9 | `GET /radio/telemetry` — time-range query with UNION ALL across daily tables | Integration |
| D3.10 | `GET /radio/sessions` — radio session history | Integration |
| D3.11 | SWR protection handling + `POST /radio/protection/reset` | Integration |
| D3.12 | i18n: locale detection middleware (AsyncLocalStorage per request) | Unit |
| D3.13 | i18n: localized error responses across all endpoints (RFC 7807 `message` + `details`) | Integration |
| D3.14 | i18n: translated AJV validation error messages (JSON Schema) | Integration |
| D3.15 | i18n: WebSocket `AUTHENTICATED` frame includes `locale` field | Integration |
| D3.16 | i18n: WebSocket system events localized (`SYSTEM_NOTIFICATION`, `CLOCK_SYNCED`) | Integration |

**Milestone**: Simulated radio responds to commands. Telemetry is recorded and queryable by time range. All API errors and WebSocket system messages are localized.

---

## Phase 4: Messaging & Conversations (Week 6–8)

**Goal**: Full conversation-based messaging with delivery tracking.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D4.1 | `POST /conversations` — create direct/group/broadcast | Integration |
| D4.2 | `GET /conversations` — paginated list with `contentPreview` and unread counts | Integration |
| D4.3 | `GET /conversations/:id` — conversation detail | Integration |
| D4.4 | `PATCH /conversations/:id` — update title/metadata | Integration |
| D4.5 | Participant management: add, remove, list | Integration |
| D4.6 | `POST /conversations/:id/messages` — send message with idempotency | Integration |
| D4.7 | `GET /conversations/:id/messages` — cursor-based pagination | Integration |
| D4.8 | `PATCH /conversations/:id/messages/:msgId` — edit message | Integration |
| D4.9 | `DELETE /conversations/:id/messages/:msgId` — soft delete | Integration |
| D4.10 | Message reactions: add/remove | Integration |
| D4.11 | `POST /conversations/:id/read` — mark read | Integration |
| D4.12 | Delivery tracking: per-recipient, per-channel (`message_deliveries`) | Integration |
| D4.13 | Message content validation: 64 KB max, reject oversized payloads | Unit |
| D4.14 | Participant limit enforcement: direct=2, group=50, broadcast=200 | Unit |
| D4.15 | Conversation list query optimization (the critical query) | Performance test |
| D4.16 | `message_envelopes` — email/SMTP transport envelope creation with localized templates | Integration |

**Milestone**: Full messaging lifecycle works: create conversation → send message → track delivery → edit/delete/react. Idempotency prevents duplicates. Email envelopes include locale for template selection.

---

## Phase 5: WebSocket Gateway (Week 9–10)

**Goal**: Real-time event streaming via WebSocket. No sync protocol needed — clients fetch current state via REST on reconnect.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D5.1 | WebSocket upgrade handler (subprotocol `hermes-v1`) | Integration |
| D5.2 | `AUTHENTICATE` / `AUTHENTICATED` flow with `serverTime` and `locale` | Integration |
| D5.3 | `SUBSCRIBE` / `SUBSCRIBED` topic management | Integration |
| D5.4 | In-process EventEmitter topic routing | Unit |
| D5.5 | `RADIO_TELEMETRY` event push (1 Hz) | Integration |
| D5.6 | `MESSAGE_NEW`, `MESSAGE_DELIVERED`, `MESSAGE_READ` events | Integration |
| D5.7 | `TYPING_START` / `TYPING_STOP` (rate-limited: 1 per 2 sec) | Integration |
| D5.8 | `PRESENCE_UPDATE` — online/offline/away | Integration |
| D5.9 | Heartbeat: PING/PONG every 30 seconds | Integration |
| D5.10 | WebSocket backpressure handling: `STALE_CONNECTION` + code `4010` | Integration |
| D5.11 | WebSocket connection limits (max 20 concurrent) | Integration |
| D5.12 | Auth timeout: drop unauthenticated connections after 10s | Integration |

**Milestone**: WebSocket clients receive real-time radio telemetry and message events. Reconnection is handled purely via REST API — clients fetch current state on reconnect. No sync engine, no cursor management, no delta batching. System notifications are locale-aware per connection.

---

## Phase 6: Attachments, Geolocation & Scheduling (Week 11–12)

**Goal**: File uploads, GPS tracking, and connection schedules work.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D6.1 | `POST /attachments` — multipart upload with MIME validation | Integration |
| D6.2 | SHA-256 checksum deduplication | Unit |
| D6.3 | `GET /attachments/:id/download` — signed time-limited URLs | Integration |
| D6.4 | Attachment token for HF radio store-and-forward (30-day expiry) | Unit |
| D6.5 | File size limit enforcement (50 MB, streaming) | Integration |
| D6.6 | `POST /geolocation` — report GPS position | Integration |
| D6.7 | `GET /geolocation/current` — latest position | Integration |
| D6.8 | `GET /geolocation/history` — time-range query across daily tables | Integration |
| D6.9 | `POST /frequencies` — create frequency preset | Integration |
| D6.10 | `POST /schedules` — create connection schedule with recurrence | Integration |
| D6.11 | Schedule runner: checks `next_run_at`, triggers radio connection | Unit |
| D6.12 | `POST /schedules/:id/cancel` — cancel scheduled connection | Integration |

**Milestone**: Files can be uploaded, downloaded, and linked to messages. GPS positions are recorded and queryable by time range. Connection schedules are created and executed.

---

## Phase 7: System Management, Clock Sync & Resilience (Week 13–14)

**Goal**: Station management, clock synchronization, and power-loss resilience.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D7.1 | `POST /setup` — first-time setup wizard with locale detection & selection | Integration |
| D7.2 | `GET /system/config`, `PATCH /system/config` | Integration |
| D7.3 | `GET /system/clock` — clock sync status endpoint | Integration |
| D7.4 | `POST /system/clock/sync` — manual clock set | Integration |
| D7.5 | Clock initialization sequence: saved timestamp → GPS → manual | Unit |
| D7.6 | GPS NMEA sentence parser for UTC time extraction | Unit |
| D7.7 | `last_known_time` file write on graceful shutdown | Unit |
| D7.8 | Graceful shutdown handler (GPIO signal / systemd stop) | Integration |
| D7.9 | Boot-time recovery: rehydrate job queue, WAL auto-recovery | Integration |
| D7.10 | `POST /system/reboot`, `POST /system/shutdown` | Integration |
| D7.11 | `GET /apps`, `POST /apps/install` | Integration |
| D7.12 | `GET /metrics` — Prometheus endpoint (disabled by default) | Integration |
| D7.13 | Audit logging: all significant actions written to `audit_logs` with `locale` context | Integration |
| D7.14 | Retention cleanup cron: telemetry (90d), GPS (365d), audit (2y), sync_queue (30d), deleted messages (90d), sessions (7d), jobs (30d) | Unit |
| D7.15 | i18n: setup wizard locale detection via `Accept-Language` header | Integration |
| D7.16 | i18n: `PATCH /users/me` accepts `locale` field (token invalidation on change) | Integration |
| D7.17 | i18n: `npm run i18n:check` script — validates all locales have the same keys | Unit |

**Milestone**: Station can be set up from scratch in any supported language. Clock syncs from GPS or manual input. Power loss is handled gracefully with < 10 second recovery. Users can switch language via profile settings.

---

## Phase 8: Security Hardening & Legacy Compatibility (Week 15–16)

**Goal**: Production-ready security and backward compatibility.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D8.1 | Rate limiting: all limits from §8 of API spec enforced | Integration |
| D8.2 | Content validation: `maxLength` on all string fields | Unit |
| D8.3 | Helmet security headers configured | Integration |
| D8.4 | CORS allowlist | Integration |
| D8.5 | TLS 1.2+ configuration | Manual |
| D8.6 | JWT key rotation support (invalidates tokens, clients re-auth with new locale) | Unit |
| D8.7 | Legacy compatibility shim: `GET /messages/inbox`, `GET /messages/outbox`, `GET /messages/:id` | Integration |
| D8.8 | Legacy write endpoints redirected to new conversation API | Integration |
| D8.9 | Input sanitization: CLI args via `execFile` arrays (no shell) | Unit |
| D8.10 | SQL injection: verify all queries use Drizzle parameterized queries | Review |

**Milestone**: All security controls active. Legacy endpoints work. System is production-ready for field deployment.

---

## Phase 9: Testing, Validation & Deployment (Week 17–18)

**Goal**: Test suite complete. Deployable to Raspberry Pi 4.

| Task | Deliverable | Tests |
|------|-------------|-------|
| D9.1 | Unit test coverage ≥ 80% across all modules (including i18n) | — |
| D9.2 | Integration tests for all API endpoints (with `Accept-Language` variants) | — |
| D9.3 | E2E tests: simulated radio + WebSocket client + message flow + locale switching | — |
| D9.4 | Load test: 3 concurrent WebSocket clients + 1 Hz telemetry + message send/receive | Performance |
| D9.5 | Memory profiling on actual Pi 4 hardware (verify i18n overhead < 100 KB) | Manual |
| D9.6 | SD card write endurance test (72-hour run) | Manual |
| D9.7 | Power-loss simulation: kill power mid-transaction, verify WAL recovery | Manual |
| D9.8 | Systemd service unit file | — |
| D9.9 | Deployment script for sBitx v2 | — |
| D9.10 | `README.md` updated with install/run instructions and language configuration | — |

**Milestone**: All tests pass. Memory usage stays under 384 MB V8 heap. Pi 4 deployment tested with real sBitx hardware. All 3 languages verified in E2E tests.

---

## Phase 10: Optional / Future (Beyond Week 18)

| Task | Notes |
|------|-------|
| WebRTC audio (peer-to-peer) | Gated behind `ENABLE_WEBRTC=true`; only if LAN audio is needed |
| PostgreSQL adapter | For multi-station server deployments (Phase 4 federation) |
| Redis adapter | For multi-process deployments (swap in-process event bus to Redis Pub/Sub) |
| GraphQL gateway | Alternative to REST for complex queries |
| Multi-radio support | Multiple sBitx devices on one station |
| Federation protocol | Station-to-station sync over HF |
| Machine translation of messages | `message_translations` table; automatic translation via offline model or external API |
| Additional languages | Extend to French (fr), Quechua (qu), Guarani (gn) — community-driven translations |
| RTL language support | Arabic (ar), Hebrew (he) — requires CSS/bidirectional text support in Web UI |

---

## i18n Summary

Internationalization is integrated across all phases, not bolted on at the end:

| Phase | i18n Tasks |
|-------|------------|
| Phase 0 | Documentation: `docs/i18n.md`, updates to api.md, database.md, development.md |
| Phase 1 | Core infrastructure: `src/i18n/` module, locale detector, resource files (en/es/pt-BR), JWT locale field |
| Phase 2 | Database: `locale` columns on `users`, `audit_logs`, `message_envelopes` tables |
| Phase 3 | API & WebSocket: locale middleware, localized errors, localized WebSocket events |
| Phase 7 | Setup wizard locale detection, `PATCH /users/me` locale field, `i18n:check` script |
| Phase 9 | Test coverage for i18n, E2E with locale switching, memory profiling |

### Supported Languages

| Code | Language | Coverage | Priority |
|------|----------|----------|:---:|
| `en` | English | 100% (fallback) | P0 |
| `es` | Español | 100% | P0 |
| `pt-BR` | Português (Brasil) | 100% | P1 |

### Design Decisions

- **No runtime translation libraries**: Plain JSON files loaded at startup — no `i18next` or similar heavy dependency. Total overhead ~60 KB for all 3 languages.
- **Locale in JWT**: Avoids database query on every request to determine user language preference.
- **Fallback chain**: User preference → `Accept-Language` header → `en`.
- **Terminology**: Radio technical terms (frequency, mode, PTT, SWR, SNR) kept in English per international ham radio convention.
- **User messages NOT translated**: Message content is stored and transmitted as-is. Machine translation is a future optional feature (Phase 10+).

---

## Deliverables by Phase

```
Phase 0:  docs/ clean, package.json, tsconfig, Drizzle init, i18n documentation
Phase 1:  Fastify server, auth (login/refresh/logout), RBAC middleware, i18n core module + translations
Phase 2:  All 17+ DB tables, repositories, DatabaseAdapter, migrations, locale columns
Phase 3:  HAL, sBitx CLI driver, radio status, telemetry recording, localized errors & WebSocket
Phase 4:  Conversations, messages, delivery tracking, reactions, localized email templates
Phase 5:  WebSocket gateway, real-time events, offline sync engine, locale-aware notifications
Phase 6:  File uploads, GPS tracking, frequency presets, schedules
Phase 7:  Setup wizard with locale, clock sync, graceful shutdown, boot recovery, retention, user locale settings
Phase 8:  Rate limiting, security headers, legacy shim, input validation
Phase 9:  80%+ test coverage (incl. i18n), Pi 4 profiling, deployment scripts