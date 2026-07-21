# Architecture Review Prompt — Hermes Webservice

**For agent**: `.claude/agents/auditor-arch.agent.md` ( 🔍 Architecture Auditor )

---

Review the following architecture documentation for the **Hermes Webservice** — a next-generation backend for HF radio communication stations that enables remote, rural, and disaster-affected communities to exchange messages, files, audio, and GPS coordinates over HF radio.

## Target Hardware

The system will run on the **sBitx v2** hardware platform:
- Hardware: Raspberry Pi 4, 4 GB RAM
- Radio: HF transceiver (3–30 MHz)
- OS: Linux (Raspberry Pi OS)
- Environment: Field-deployed stations with unreliable power, temperature stress, intermittent HF radio connectivity, and no internet access (air-gapped or store-and-forward)

> Hardware details: https://www.hfsignals.com/index.php/sbitx-v2/

## Documents to Review

1. **`api.md`** — Full REST API specification (974 lines): Fastify v5 endpoints for authentication, radio management, conversation-based messaging, user/devices, attachments, geolocation, system management, WebSocket realtime gateway protocol, security model (JWT RS256, RBAC), rate limiting, error handling
2. **`database.md`** — Full database schema (893 lines): PostgreSQL 17 + TimescaleDB, 17 tables across 9 domains, Drizzle ORM, migrations, indexes, retention policies, legacy SQLite migration path
3. **`README.md`** — Project overview with architecture diagram, technology stack, key design decisions

## Critical Review Areas

### 1. Hardware Feasibility (sBitx v2 / Raspberry Pi 4)
- Can PostgreSQL 17 + TimescaleDB + Redis 7 + Node.js + mediasoup + coturn all run on 4 GB RAM?
- What is the estimated memory budget per service?
- Which service is most likely to cause OOM kills under load?
- Is there a fallback architecture if PostgreSQL is too heavy? Is the SQLite abstraction layer sufficient?
- What happens during peak load: simultaneous telemetry ingest, message sync, and WebRTC audio?

### 2. Messaging & Synchronization Model
- Is the conversation-based messaging model (replacing inbox/outbox) correctly designed?
- Are there edge cases in the per-recipient, per-channel, per-device delivery tracking?
- Is the offline sync model (sync_cursors + sync_queue + SYNC_DELTA on reconnect) robust?
- What happens under message duplication, packet loss, partial sync?
- Are there race conditions between concurrent message delivery and cursor updates?
- Is the client_message_id idempotency mechanism sufficient?

### 3. WebSocket & Realtime Architecture
- Is the WebSocket protocol (hermes-v1 subprotocol, typed envelope, topic subscriptions) well-designed?
- Are there backpressure risks?
- Is the 10-second auth timeout appropriate?
- Is the reconnect/resume sync mechanism reliable?
- What are the failure modes of the Redis Pub/Sub event bus?

### 4. Database Design
- Is the schema properly normalized? Are denormalizations justified?
- Are indexes sufficient for the critical query paths (conversation list with unread counts)?
- Are TIMESTAMPTZ, UUID PKs, soft deletes correctly applied?
- Are the TimescaleDB retention policies appropriate?
- Is the migration strategy (zero-downtime, Drizzle ORM) feasible on constrained hardware?

### 5. Security
- Is JWT RS256 + RBAC appropriate for this threat model?
- Are there attack surfaces in the WebSocket gateway? Replay attacks?
- Is the HAL CLI execution security (`execFile` with arrays) sufficient?
- Are attachments properly secured (MIME validation, signed URLs, conversation membership checks)?
- Is the audit logging complete?

### 6. Radio & HAL Integration
- Is the Hardware Abstraction Layer design appropriate?
- Does the `IRadioDriver` interface cover all necessary sBitx v2 operations?
- Is the BullMQ command queue with serial execution correct for hardware control?
- Are there timing/ordering issues with radio commands?

### 7. Operational Resilience
- What happens during unexpected power loss? Data integrity?
- Is the observability (Pino, OpenTelemetry, Prometheus) sufficient for remote, air-gapped stations?
- How do you debug an air-gapped station that has no internet?
- Are there operational blind spots?

### 8. Long-Term Sustainability
- Is the modular monolith architecture appropriate, or will it become a monolith spaghetti?
- Is the migration path from SQLite to PostgreSQL realistic?
- Are the ADR decisions well-documented and justified?
- What technical debt is being introduced?
- What will break first in production?

## What I Need

A comprehensive adversarial architecture review that:
1. Identifies the top 5-10 critical risks, ranked by severity
2. Validates or challenges each architectural decision
3. Surfaces hidden assumptions and edge cases
4. Recommends concrete mitigations for each risk
5. Provides a go/no-go assessment for moving to Phase 1 implementation

Be brutally honest. Challenge everything. Think like a production incident survivor reviewing an architecture that failed in the field.