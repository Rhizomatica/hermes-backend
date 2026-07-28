# Hermes Backend

> Next-generation backend for [HERMES](https://www.rhizomatica.org/hermes/) communication stations — enabling communities in remote or disaster-affected areas to exchange messages, files, audio, and GPS coordinates over HF radio (3–30 MHz).

**Hardware**: sBitx v2 (Raspberry Pi 4, 4 GB RAM) · **Access**: Local WiFi hotspot · **Stack**: Single Node.js process + SQLite

---

## Quick Start

```bash
git clone https://github.com/Rhizomatica/hermes-backend.git
cd hermes-backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Full setup guide: [Deployment Guide](docs/operations/deployment.md)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Clients (phone, laptop, browser)             │
└─────────┬────────────────────────┬───────────────────────┘
          │ HTTPS REST             │ WebSocket (real-time)
┌─────────▼────────────────────────▼───────────────────────┐
│               hermes-backend (single process)             │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  REST API   │  │  WebSocket   │  │  Event Bus     │  │
│  │  (Fastify)  │  │  Gateway     │  │  (EventEmitter) │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                  │            │
│  ┌──────▼────────────────▼──────────────────▼────────┐  │
│  │         Messaging Domain · Radio Service          │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │     Hardware Abstraction Layer (IRadioDriver)      │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────▼───────────────────────────┐  │
│  │            SQLite (WAL mode) · Jobs · Sessions     │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────┘
                       │ sBitx CLI
               ┌───────▼───────┐
               │ sBitx Radio   │
               └───────────────┘
```

**Key decisions:**
- **SQLite (WAL mode)** — Zero daemon, 2–5 MB RAM, crash-resilient. Perfect for single-station Pi 4.
- **Single Node.js process** — No Redis, no PostgreSQL, no external brokers. Modular monolith with in-process event bus.
- **Conversation-based messaging** — Messages belong to conversations, not inboxes. Per-recipient, per-channel delivery tracking.
- **REST + WebSocket** — REST for data access, WebSocket for real-time pushes (radio telemetry, new messages, presence). No sync protocol — clients fetch state via REST on reconnect.
- **Hardware Abstraction Layer** — `IRadioDriver` interface with real sBitx CLI and simulated driver for development.

**Memory footprint**: ~450–620 MB on Pi 4 (V8 heap: 384 MB, SQLite: 2–5 MB, OS: ~300 MB).

---

## Documentation

| Category | Documents |
|----------|-----------|
| **Specs** | [REST API](docs/architecture/api.md) · [Database Schema](docs/architecture/database.md) · [WebSocket Protocol](docs/architecture/websocket.md) · [Hardware Integration](docs/architecture/hardware-integration.md) |
| **Decisions** | [ADR-001: SQLite](docs/adr/adr-001-sqlite-for-pi4.md) · [ADR-002: Event Bus](docs/adr/adr-002-in-process-event-bus.md) · [ADR-003: Messaging](docs/adr/adr-003-conversation-messaging-model.md) · [ADR-004: JWT](docs/adr/adr-004-jwt-rs256-token-rotation.md) |
| **Development** | [Plan](docs/development/plan.md) · [Setup](docs/development/setup.md) · [Testing](docs/development/testing.md) · [CI/CD](docs/development/ci-cd.md) · [i18n](docs/development/i18n.md) |
| **Operations** | [Deployment](docs/operations/deployment.md) · [Security](docs/operations/security.md) · [Observability](docs/operations/observability.md) |
| **Audits** | [sBitx v2 Hardware Audit](docs/audits/sbitx-v2.md) · [Comprehensive Architecture Audit](docs/audits/comprehensive.md) |

---

## Technology

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22 LTS + TypeScript 5.x (strict) |
| HTTP | Fastify v5 + JSON Schema (AJV) + OpenAPI 3.1 |
| Database | SQLite 3.45+ (WAL mode) + Drizzle ORM |
| Event Bus | In-process EventEmitter (typed) |
| Job Queue | In-memory priority queue + SQLite backing store |
| Auth | JWT RS256 + RBAC + refresh token rotation |
| Logging | Pino (structured JSON) |
| Testing | Vitest + Supertest |

---

## Related Projects

| Project | Description |
|---------|-------------|
| [hermes-gui](https://github.com/Rhizomatica/hermes-gui) | Web UI for the radio operator |
| [hermes-radio-daemon](https://github.com/Rhizomatica/hermes-radio-daemon) | Radio daemon (HF TX/RX, telemetry) |
| [hermes-api](https://github.com/Rhizomatica/hermes-api) | Legacy PHP/Lumen API (being replaced) |
| [hermes-net](https://github.com/Rhizomatica/hermes-net) | HerMes networking protocol |

---

## License

GNU General Public License v3.0 · [Rhizomatica](https://www.rhizomatica.org/)