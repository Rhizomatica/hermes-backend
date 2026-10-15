# Hermes Backend — Documentation

Documentation for the Go rewrite. The two YAML specs vendored in
[`../api/contracts/`](../api/contracts/) are the **single source of truth** for
the wire contract; the prose documents explain intent and implementation.

## Index

| Area | Files | Status |
|------|-------|:------:|
| Decisions | [`adr/`](adr/) — decision register + ADRs | register ✅ · ADRs in progress |
| Contracts | [`../api/contracts/api-rest.yaml`](../api/contracts/api-rest.yaml) · [`../api/contracts/api-ws.yaml`](../api/contracts/api-ws.yaml) | ✅ vendored |
| Development | [`development/plan.md`](development/plan.md) | ✅ |
| Architecture | `architecture/overview.md`, `api.md`, `websocket.md`, `database.md`, `auth.md`, `radio-integration.md`, `messaging.md` | planned |
| Operations | `operations/deployment.md`, `security.md`, `observability.md` | planned |
| Audits | `audits/` (carried forward from legacy) | planned |

## Planned architecture set

The prose architecture docs will map 1:1 to the vendored specs and to the Go
package layout in `internal/`:

- `overview.md` — single process, domain breakdown (auth, radio, messaging,
  email, geolocation, system, schedules, events, reticulum).
- `api.md` — REST `/api/v2` conventions (snake_case, RFC 9457, roles,
  `X-Request-Id`, pagination) — elaborates `api-rest.yaml`.
- `websocket.md` — `hermes.v1` (subscribe/publish, snapshot/`seq`, heartbeat,
  backpressure, binary audio, role gating, PTT safety) — elaborates `api-ws.yaml`.
- `database.md` — SQLite (WAL) schema, blocked on O-01 (messaging model).
- `auth.md` — session tokens, argon2id, RBAC, CSRF, first-boot setup code.
- `radio-integration.md` — `IRadioDriver` HAL; radiod/Mercury first, cgo later.
- `messaging.md` — messages / email / UUCP / `.hmp` compatibility.
