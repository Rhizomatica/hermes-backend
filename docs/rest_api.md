### 4.1 REST API (`src/api/`)

The REST API is the primary synchronous interface of the HERMES ecosystem. It exposes all HTTP endpoints consumed by the Web UI, mobile clients, CLI tools, and third-party integrations while coordinating with the Radio Daemon and the messaging services.

Built with Fastify, the API focuses on performance, schema validation, and a clean separation between transport and business logic. **For sBitx v2 field deployments on Raspberry Pi 4, the entire stack runs in a single Node.js process with SQLite (WAL mode) as the only external resource.**

#### Responsibilities

**Authentication & Authorization**
- User authentication
- Session management
- JWT/API tokens
- Role-Based Access Control (RBAC)
- Permission validation

**Radio Management**
- Radio control
- Radio configuration
- Radio diagnostics
- Frequency management
- Integration with Radio Daemon
- Station status
- Radio metrics

**Messaging**
- Conversation management
- Message CRUD
- Message synchronization
- Message delivery status
- Attachments
- Broadcast messages
- Local station chat

**User & Station Management**
- Users
- Stations
- Devices
- User permissions
- Device registration

**System Management**
- Initial setup (Quiz)
- Configuration
- Clock synchronization
- Installed applications
- Health endpoints
- Metrics
- Logs
- Diagnostics

**Geolocation**
- GPS position
- Station location
- Position history

#### Technical Design

**API**
- Fastify
- REST
- Versioned endpoints (`/api/v1`)
- JSON Schema validation (AJV) with `maxLength` constraints on all string fields
- OpenAPI 3.1 generation
- Swagger UI

**Architecture**
- Thin Controllers
- Domain Services
- Repository pattern with `DatabaseAdapter` interface
- Dependency Injection

**Validation**
- Request validation
- Response validation
- Typed DTOs
- Shared schemas
- Message `content` capped at 64 KB (`maxLength: 65536`)
- Conversation participant limits: `direct`=2, `group`=50, `broadcast`=200

**Security**
- RBAC
- JWT (RS256, 15-min access / 30-day refresh)
- Rate limiting (in-memory counters)
- Audit logs (SQLite-backed, immutable)

#### Integration Requirements

**Radio Daemon**

Must remain fully compatible with:

- [hermes-radio-daemon](https://github.com/Rhizomatica/hermes-radio-daemon)
- [hermes-api](https://github.com/Rhizomatica/hermes-api)

Responsibilities include:
- Radio configuration
- Radio state
- Metrics
- Frequency information
- PTT
- TX/RX state
- WebSocket event consumption

#### Required Improvements

**Existing API**
- Review existing architecture
- Standardize code patterns
- Improve consistency
- Increase test coverage
- Improve documentation
- Modularize services

**Messaging Model**

Replace the current message model with a conversation-based architecture.

Possible entities:

```
Station
 ├── Conversations
 │      ├── Messages
 │      ├── Attachments
 │      ├── Delivery Status
 │      └── Participants
```

Features:
- Conversations
- Threads
- Attachments
- Drafts
- Delivery tracking (per-recipient, per-channel)
- Synchronization
- Read status
- Forwarding

**Message Status**

Suggested lifecycle:

```
Draft
    ↓
Queued (sending)
    ↓
Encoding
    ↓
Waiting Radio
    ↓
Transmitting
    ↓
Transmitted (sent)
    ↓
Received (delivered)
    ↓
Read

Also include:
- Failed
- Cancelled
- Expired
```

#### Initial Configuration (Quiz)

The API should expose endpoints to drive the first-time setup wizard.

Responsibilities:
- Country
- Callsign
- Station information
- Radio profile
- Clock synchronization (GPS or manual)
- Installed applications
- User creation
- Network settings

Potential endpoint: `POST /api/v1/setup`

#### Application Management

Possible API endpoints:
- `GET /apps`
- `POST /apps/install`
- `POST /apps/remove`
- `POST /apps/update`

Examples:
- Hermes Chat
- GPS
- Future plugins

The installer could execute commands such as `turbo run install --filter=hermes-chat` or activate pre-installed modules depending on deployment strategy.

#### Architectural Decisions

**Runtime**

Evaluate:
- Node.js (preferred)
- Go
- Python

Current recommendation: **Node.js + TypeScript** (with `--max-old-space-size=384` on Pi 4)

Reasons:
- Shared language with frontend
- Faster development
- Existing ecosystem
- Strong Fastify support
- Single-process concurrency via event loop (no multi-process overhead on Pi 4)

**Database**

| Database | Pros | Cons | Verdict for sBitx v2 |
|----------|------|------|----------------------|
| SQLite (WAL mode) | Zero configuration, excellent for Pi 4, single file, simple backup, crash-resilient, ~2–5 MB memory | Single-writer (irrelevant: single Node.js process serializes writes) | ✅ **Primary for field stations** |
| PostgreSQL | Robust, ACID, better synchronization, full SQL, better future scalability | 300–800 MB RAM, daemon process, VACUUM I/O, SD card wear | ⚠️ Multi-station server deployments only (Phase 4 federation) |

**Decision**: **SQLite (WAL mode)** for single-station sBitx v2 deployments with a `DatabaseAdapter` interface that allows migration to PostgreSQL for larger multi-station server deployments. The Drizzle ORM adapter pattern makes this a configuration switch, not a code rewrite.

**Cache / Pub/Sub / Job Queues / Sessions**

| Component | Original Design | sBitx v2 Decision | Rationale |
|-----------|:---:|---|------|
| Event Bus | Redis Pub/Sub | **In-process EventEmitter** | Single Node.js process; no cross-process fan-out needed |
| Job Queues | BullMQ (Redis) | **In-memory priority queue + SQLite backing store** | Jobs survive process restart via `jobs` table |
| Session Store | Redis | **SQLite (`user_sessions` table)** | Token hashes stored in the database; no Redis dependency |
| Rate Limiting | Redis counters | **In-memory counters** | Acceptable tradeoff: resets on restart, low risk for single-station |

**Event Bus — Degraded Mode**

If the in-process EventEmitter is unavailable (should never happen in normal operation — it's in the same process), the system falls back to direct service calls. This is a non-issue for a modular monolith.

**WebRTC / Audio Streaming**

| Feature | Decision | Rationale |
|---------|----------|-----------|
| mediasoup SFU | **Removed** | 200–400 MB RAM for a feature unlikely to be used on sBitx v2 (the radio IS the audio channel) |
| coturn | **Removed** | Not needed without mediasoup |
| WebRTC signaling | **Gated behind `ENABLE_WEBRTC=false`** config flag (default off) | Peer-to-peer WebRTC available as optional feature for LAN audio testing |
| Browser audio | **Future consideration** | If LAN audio is needed, implement as browser audio capture → WebSocket → ALSA playback (no SFU needed) |

#### Power-Loss & Resilience

Field-deployed sBitx v2 stations face unreliable power. The system must handle sudden power loss gracefully:

- **Filesystem**: ext4 with `data=ordered` or f2fs (flash-friendly) on SD card; mount with `noatime`
- **SQLite WAL mode**: Near-instant crash recovery; no manual intervention needed
- **Graceful shutdown**: GPIO low-battery signal triggers `systemctl stop` → flush queues → checkpoint WAL → write clock to file → exit
- **Boot recovery**: WAL auto-recovery → rehydrate job queue → clock initialization → API starts accepting (< 10 seconds)
- **SD card wear**: WAL append-only writes, batch transactions, metrics disabled by default, telemetry/GPS in separate DB files

See [database.md §12](database.md#12-power-loss--recovery-strategy) for the full strategy.

#### Clock Synchronization

Air-gapped stations have no NTP. The Raspberry Pi 4 has no RTC battery — clock resets to epoch on power cycle:

1. **Saved timestamp**: Read `/var/lib/hermes/last_known_time` from graceful shutdown
2. **GPS** (if available): Parse NMEA sentences for UTC time
3. **Manual**: Operator sets time via `POST /api/v1/system/clock/sync`
4. **Monotonic sequences**: Sync ordering uses `last_event_sequence` (integer), never wall-clock timestamps
5. **`clock_synced` flag**: Exposed in health endpoint and WebSocket `AUTHENTICATED` response

See [database.md §13](database.md#13-clock-synchronization-strategy) for the full strategy.

#### Resource Constraints (Raspberry Pi 4, 4 GB RAM)

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| Message `content` | 64 KB (`maxLength: 65536`) | JSON Schema / AJV |
| Conversation participants (group) | 50 | Business logic |
| Conversation participants (broadcast) | 200 | Business logic |
| File upload size | 50 MB | Streaming parser |
| Messages per page | 50 | Query parameter validation |
| Sync delta batch size | 100 events | Sync engine |
| Sync catch-up threshold | 500 missed events → send `SYNC_SUMMARY` | Sync engine |
| WebSocket connections | 10 concurrent | Gateway |
| V8 heap | 384 MB (`--max-old-space-size=384`) | Node.js flag |
| Total estimated memory | ~450–620 MB | Well within 4 GB budget |

#### Open Questions

**Messaging Model**

Should HERMES behave more like:

| Model | Characteristics |
|-------|----------------|
| Delta Chat | Email as transport, conversations, offline-first, asynchronous |
| Traditional Chat | Real-time, WebSocket, radio synchronization |
| Hybrid | Chat UX, store-and-forward messaging, email-like metadata, offline synchronization |

**Decision**: **Hybrid model** — conversation-based UX with store-and-forward transport. Same message model works for real-time WebSocket delivery AND delayed radio delivery. The `message_envelopes` abstraction handles email/SMTP interop without polluting the chat model.

**Conversation Ownership**

Should conversations belong to:

| Model | Structure |
|-------|-----------|
| Station | `Station → Conversation` |
| User | `User → Conversation` |
| Both | `Station → Users → Conversations` |

**Decision**: **User-owned conversations within a station context.** Users are members of conversations; conversations exist within the station database. Multi-user support within a single station is first-class.

**Local Chat**

Should users connected to the same station be able to exchange messages without transmitting over HF?

**Decision**: **Yes.** Local-only conversations use `channel=websocket` delivery. Mixed local + radio conversations are supported — delivery records are created per-channel and the system attempts all available channels.

**Radio Configuration**

Should the Radio Daemon remain the source of truth, or should the configuration also be persisted in the database?

**Decision**: **Daemon provides runtime state via WebSocket; API persists desired configuration in `radio_profiles` table.** On startup, the API reconciles database state with daemon state. When the daemon is unreachable, the API serves last-known state from the database with `radio.connected: false`.

**Broadcast Messaging**

Clarify the desired behavior:
- Broadcast to every reachable station?
- Geographic broadcast?
- Frequency-based broadcast?
- Group broadcast?
- One-to-many conversations?

**Decision**: **One-to-many `broadcast` conversations with recipient station lists.** Recipients cannot reply (broadcast is one-directional). Maximum 200 recipients per broadcast conversation.

#### Future Considerations
- Event-driven architecture (in-process EventEmitter today; swap to Redis Pub/Sub for multi-process if needed)
- CQRS for messaging
- Background workers (in-memory queue + SQLite backing store today; swap to BullMQ/Redis for multi-process if needed)
- Offline synchronization
- Conflict resolution
- Plugin architecture
- Multi-radio support
- Multi-tenant stations
- Distributed synchronization
- Federation between HERMES stations (Phase 4 — PostgreSQL + Redis may be reintroduced for multi-station server)
- Full API versioning strategy
- GraphQL gateway (future)
- WebSocket API for real-time events

#### Initial Recommendation

A solid foundation for sBitx v2 on Raspberry Pi 4:

- **Fastify + TypeScript + Node.js**
- **SQLite (WAL mode)** with `DatabaseAdapter` interface for future PostgreSQL migration
- **Conversation-first messaging model** (hybrid: chat UX, store-and-forward transport)
- **Station** as the primary entity, with optional multi-user support within a station
- **Radio Daemon** as the runtime source of truth, while the API persists configuration and messaging data
- **Hybrid messaging model** inspired by Delta Chat: a chat-style interface combined with store-and-forward behavior and rich message metadata, making it well suited for HF radio networks
- **In-process event bus** (EventEmitter) — no external Redis/PubSub needed
- **In-memory job queue + SQLite backing store** — jobs survive process restarts
- **Full power-loss resilience** via SQLite WAL mode, graceful shutdown, and boot-time recovery
- **Clock sync via GPS/manual/saved timestamp** — monotonic sequence numbers for sync ordering
- **Resource limits enforced at the API boundary** — message size, participant counts, page sizes