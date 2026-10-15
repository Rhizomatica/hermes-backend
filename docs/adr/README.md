# ADR — Decision Register

Living document for the Go rewrite (branch `feat/go-rewrite`).

The Node.js/TypeScript backend and its ADRs are preserved for consultation in:

- branch `archive/nodejs-legacy`
- tag `legacy-nodejs-20261015`
- local folder `hermes-backend-backup/`

This register reconciles the two documents that previously described the system
(`hermes-documentation/tech_docs/api-redesign/README.md` vs `hermes-backend/`,
see `COMPARISON.md`) into **one** target.

## Locked decisions

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| ADR-001 | Language / runtime | **Go**, single binary | Replaces Node.js (V8 ~150–600 MB RSS) |
| ADR-002 | Database | **SQLite (WAL)** via `modernc.org/sqlite` | Zero daemon, ~2–5 MB, backup = file copy |
| ADR-003 | REST contract | `api-rest.yaml` → **`/api/v2`, snake_case, RFC 9457** | Maintainer's authoritative spec |
| ADR-004 | WebSocket | `api-ws.yaml` → **`hermes.v1`** at `/api/v2/ws` | Maintainer's authoritative spec |
| ADR-005 | Auth | **Opaque session tokens (hashed) + argon2id** | Replaces JWT RS256 (legacy ADR-004) |
| ADR-006 | Roles | `readonly` < `user` < `operator` < `admin` | Spec's `x-hermes-role` |
| ADR-007 | Topology | One process serves REST+WS; radiod/Mercury behind HAL, **cgo consolidation later** | Phased per legacy ADR-006 spikes S1/S2 |
| ADR-008 | Broadcast | NNCP area broadcast plane, RaptorQ carousel | Decided by Rafael, 2026-10-12 |

## Open decisions (block schema freeze)

| # | Decision | Proposed default | Owner |
|---|----------|------------------|-------|
| O-01 | Messaging model: per-recipient delivery vs chat-native conversations | Per-recipient delivery (`inbox/outbox/drafts` + delivery state), matching deployed `.hmp` | Product + Backend |
| O-02 | Radio config source of truth | DB desired-config + daemon runtime state reconciled on boot | Radio + Backend |
| O-03 | Roles for existing users at upgrade | Everyone except `root` starts as `user` | Product |
| O-04 | `nncp-transport` branch fate | Merge before the migration step | Maintainer |
| O-05 | Local-only chat (delivery `channel=websocket`) | Allow; same-station users bypass HF | Product + Backend |
