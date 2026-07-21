# Hermes Webservice

**API & Database Documentation**

This repository contains the comprehensive API and database documentation for the HERMES webservice — the next-generation backend for [HERMES](https://www.rhizomatica.org/hermes/) communication stations. The documentation is derived from the [hermes-backend](https://github.com/Rhizomatica/hermes-backend) architecture design, **adapted for single-station sBitx v2 deployments on Raspberry Pi 4 (4 GB RAM) in field conditions**.

HERMES enables communities in remote or disaster-affected areas to exchange messages, files, audio, and GPS coordinates over HF radio (3–30 MHz shortwave), where no internet, cell towers, or satellites are available.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [REST API](api.md) | Complete HTTP API reference — authentication, radio management, conversations, messaging, geolocation, system management, WebSocket gateway, and security |
| [Database Schema](database.md) | Full normalized SQLite schema — entity relationships, table definitions, indexes, migrations, retention policies, power-loss strategy, and Drizzle ORM TypeScript mapping |
| [Architecture Audit](architecture-audit-sbitx-v2.md) | Adversarial architecture audit for sBitx v2 — critical risks, power-loss analysis, memory budget, and hardware feasibility assessment |

---

## Technology Stack

| Layer | Technology | Rationale for Pi 4 |
|-------|------------|---------------------|
| Runtime | Node.js 22 LTS | Single process, event-loop concurrency |
| Language | TypeScript 5.x (strict) | End-to-end type safety |
| REST API | Fastify v5 | Low overhead, schema-first validation |
| Validation | JSON Schema (AJV) | Request/response boundary validation |
| API Docs | OpenAPI 3.1 + Swagger UI | Auto-generated from route schemas |
| Database | **SQLite (WAL mode)** | Zero-configuration, single-file, no daemon, minimal memory (~2–5 MB), crash-resilient |
| ORM | Drizzle ORM (SQLite adapter) | Type-safe queries without Rust codegen overhead |
| Event Bus | **In-process EventEmitter** | No external broker needed on single Pi 4 |
| Job Queues | **In-memory priority queue + SQLite backing store** | No Redis dependency; jobs survive process restart via SQLite |
| Auth | JWT RS256 + RBAC | Access/refresh token rotation |
| Session Store | **SQLite (user_sessions table)** | No Redis; token hashes stored in the database |
| Rate Limiting | **In-memory counters** | Acceptable for single-station; resets on restart (low risk) |
| Logging | Pino (structured JSON) | Low-overhead structured logging |
| Metrics | Prometheus + Grafana | Optional; disabled by default on Pi 4 to save resources |
| Testing | Vitest + Supertest | Fast, compatible with TypeScript |

### What Was Removed (and Why)

| Removed Component | Reason |
|-------------------|--------|
| PostgreSQL 17 + TimescaleDB | ~300–800 MB RAM; VACUUM I/O on SD card; WAL write amplification. SQLite WAL handles Pi 4 workloads trivially (2–3 concurrent clients, single writer). |
| Redis 7 (Pub/Sub, BullMQ, sessions, rate limiting) | ~80–300 MB RAM; single point of failure with no fallback. All functions replaced in-process for single-station deployment. |
| mediasoup SFU + coturn (WebRTC) | ~200–400 MB RAM for a feature unlikely to be used on sBitx v2 (the radio IS the audio channel). Gated behind `ENABLE_WEBRTC=false` config flag. |
| OpenTelemetry tracing | Optional; disabled by default to conserve Pi 4 resources. |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                  Clients (hermes-chat, hermes-gps, mobile)             │
└────────────┬──────────────────────┬──────────────────┐
             │ HTTPS REST           │ WSS              │
┌────────────▼──────────────────────▼──────────────────┘────────────────┐
│                        hermes-webservice (single Node.js process)      │
│  ┌──────────────────┐  ┌──────────────────┐                           │
│  │   REST API       │  │  WebSocket       │                           │
│  │   (Fastify)      │  │  Gateway         │                           │
│  └────────┬─────────┘  └────────┬─────────┘                           │
│           │                     │                                      │
│  ┌────────▼─────────────────────▼─────────────────────────────────────┐│
│  │          In-Process Event Bus (Node.js EventEmitter)               ││
│  └────────┬─────────────────────┬────────────────────────┬───────────┘│
│           │                     │                        │            │
│  ┌────────▼────────┐  ┌─────────▼──────────┐  ┌─────────▼──────────┐ │
│  │ Messaging       │  │ Radio/Telemetry     │  │ Sync Engine        │ │
│  │ Domain          │  │ Service             │  │ (In-process)       │ │
│  └────────┬────────┘  └─────────┬──────────┘  └─────────┬──────────┘ │
│           │                     │                        │            │
│  ┌────────▼─────────────────────▼────────────────────────▼───────────┐│
│  │              Hardware Abstraction Layer (HAL)                      ││
│  │         IRadioDriver → SBitxCLIDriver / SimulatedDriver           ││
│  └────────────────────────────┬───────────────────────────────────────┘│
│                               │                                        │
│  ┌────────────────────────────▼───────────────────────────────────────┐│
│  │                    SQLite Database (WAL mode)                       ││
│  │  • Conversations, Messages, Users, Sessions, Telemetry, GPS       ││
│  │  • Sync cursors, audit logs, rate limit counters (optional)       ││
│  └────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────┘
                                │ sBitx CLI
┌───────────────────────────────▼────────────────────────────────────────┐
│                         sBitx Hardware                                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### SQLite as Primary Database

SQLite in WAL (Write-Ahead Logging) mode is the production database for single-station sBitx v2 deployments. On a Raspberry Pi 4 with 2–3 concurrent clients and a single Node.js process handling all writes, SQLite's "single-writer" limitation is irrelevant — the Node.js event loop already serializes writes. Benefits over PostgreSQL on Pi 4:

- **Zero daemon process**: No background memory overhead (~2–5 MB vs 300–500 MB)
- **No VACUUM I/O contention**: No autovacuum competing for the SD card bus
- **Instant crash recovery**: WAL replay is near-instant; no `pg_resetwal` drama
- **Single-file backup**: `.sqlite` file can be copied while the database is running (`sqlite3 .backup`)
- **Drizzle ORM adapter**: Same TypeScript schema, different database file — PostgreSQL remains available for multi-station server deployments via the same repository interface

### Chat-Native Messaging (Not Email)

The messaging model uses **conversations** as the central entity — not inbox/outbox. Messages belong to conversations, delivery is tracked per-recipient per-channel, and email/radio transport is abstracted behind `message_envelopes`. This enables group conversations, reactions, threading, delivery receipts, and offline sync.

### Modular Monolith with In-Process Event Bus

The system is a modular monolith with a clear internal event bus via Node.js `EventEmitter`. Each module has explicit boundaries and communicates through typed interfaces — enabling future extraction into independent services. No Redis Pub/Sub is needed for a single-process deployment; if multi-process scaling becomes necessary (server deployments), the event bus can be swapped to Redis without changing module interfaces.

### Hardware Abstraction Layer (HAL)

All hardware communication goes through the `IRadioDriver` interface. CLI commands use `execFile` with argument arrays to prevent shell injection. A `SimulatedRadioDriver` enables full development and testing without physical hardware.

### Resilience & Degraded Modes

The system is designed for unreliable field conditions:

| Failure | Degraded Behavior |
|---------|-------------------|
| SQLite unavailable | API returns 503; radio status cache served from memory if available |
| Radio daemon disconnected | API serves last-known state with `radio.connected: false`; commands queued for retry |
| Power loss | SQLite WAL auto-recovers on next boot; clock validated against saved timestamp or GPS |
| Clock unsynchronized | Messages stamped with monotonic sequence numbers; timestamps marked with `clock_synced: false` until GPS/manual sync |

---

## Project Structure

```
hermes-webservice/
├── src/
│   ├── api/                    # Fastify HTTP routes, controllers, middleware
│   │   ├── v1/
│   │   │   ├── auth/           # Login, refresh, sessions
│   │   │   ├── radio/          # Radio control, telemetry
│   │   │   ├── conversations/  # Conversation CRUD
│   │   │   ├── messages/       # Message CRUD, reactions
│   │   │   ├── users/          # User management
│   │   │   ├── devices/        # Device registration
│   │   │   ├── system/         # Config, health, setup, clock sync
│   │   │   ├── geolocation/    # GPS readings
│   │   │   ├── frequencies/    # Frequency presets
│   │   │   ├── schedules/      # Connection schedules
│   │   │   └── attachments/    # File upload/download
│   │   └── openapi/            # OpenAPI spec generation
│   ├── gateway/                # WebSocket gateway
│   ├── hal/                    # Hardware Abstraction Layer
│   ├── messaging/              # Messaging domain logic
│   ├── events/                 # In-process event bus (EventEmitter)
│   ├── jobs/                   # In-memory job queue + SQLite backing store
│   ├── db/                     # Database layer (Drizzle ORM — SQLite adapter)
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── repositories/
│   ├── auth/                   # JWT, RBAC, session management
│   ├── clock/                  # Clock sync strategies (GPS, manual, saved timestamp)
│   ├── resilience/             # Power-loss handling, graceful shutdown, recovery
│   └── shared/                 # Shared types, errors, utilities
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── infrastructure/
    ├── scripts/
    └── observability/          # Optional metrics (disabled by default on Pi 4)
```

---

## Memory Budget (Raspberry Pi 4, 4 GB RAM)

| Component | Estimated Memory | Notes |
|-----------|:---:|-------|
| Node.js (Fastify + all modules) | 150–250 MB | V8 heap with `--max-old-space-size=384` |
| SQLite | 2–5 MB | WAL mode, shared cache |
| sBitx CLI + other system processes | 64 MB | |
| Linux OS + kernel | 200–300 MB | |
| **Total estimated** | **~450–620 MB** | Well within 4 GB budget |
| Buffer for spikes / file cache | ~3.4 GB available | |

No external daemon processes. No Redis. No PostgreSQL. No mediasoup. The entire stack runs in a single Node.js process with SQLite as the only external resource.

---

## Power-Loss & Clock Sync Strategy

See [Database Schema §12](database.md#12-power-loss--recovery-strategy) for the full power-loss strategy and [Database Schema §13](database.md#13-clock-synchronization-strategy) for clock sync.

**Summary:**
- SQLite WAL mode with `PRAGMA synchronous=NORMAL` for crash resilience
- Graceful shutdown on GPIO low-battery signal
- Boot-time clock initialization: saved timestamp → GPS (if available) → manual prompt
- Monotonic `last_event_sequence` for sync ordering (not wall-clock timestamps)
- `clock_synced` flag in health endpoint

---

## Upstream Resources

- [hermes-backend](https://github.com/Rhizomatica/hermes-backend) — Full architecture documentation, ADRs, roadmaps, and audit reports
- [hermes-radio-daemon](https://github.com/Rhizomatica/hermes-radio-daemon) — Radio daemon integration
- [hermes-api](https://github.com/Rhizomatica/hermes-api) — Legacy PHP/Lumen API (being replaced)
- [Rhizomatica — HERMES Project](https://www.rhizomatica.org/hermes/) — Project homepage

---

## License

GNU General Public License v3.0

---

> HERMES is a project by [Rhizomatica](https://www.rhizomatica.org/hermes/) enabling communities in remote or disaster-affected areas to communicate when infrastructure fails.# hermes-webservice
