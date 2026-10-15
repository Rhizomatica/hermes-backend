# Hermes Backend (Go)

Station backend for [HERMES](https://www.rhizomatica.org/hermes/) communication
stations — communities exchange messages, files, audio, and GPS over HF radio.

This is a **Go rewrite** of the previous Node.js/TypeScript backend. The old
implementation is preserved for consultation in the `archive/nodejs-legacy`
branch, the `legacy-nodejs-20261015` tag, and the local
`hermes-backend-backup/` folder.

## What it is

A single Go binary (`hermesd`) that serves, on one port:

- **REST** `/api/v2` — contract in [`api/contracts/api-rest.yaml`](api/contracts/api-rest.yaml) (OpenAPI 3.1).
- **WebSocket** `hermes.v1` at `/api/v2/ws` — contract in [`api/contracts/api-ws.yaml`](api/contracts/api-ws.yaml) (AsyncAPI 3.1).

## Stack

| Layer | Choice |
|-------|--------|
| Language | Go 1.24 |
| HTTP | `net/http` (stdlib) + method routing |
| WebSocket | `gorilla/websocket` (planned) |
| Database | SQLite (WAL) via `modernc.org/sqlite` (planned) |
| Auth | Opaque session tokens (hashed) + argon2id (planned) |
| Logging | `log/slog` structured JSON |

## Quick start

```bash
go run ./cmd/hermesd
curl -s localhost:3000/health
```

## Documentation

See [`docs/`](docs/) — decision register, architecture, development plan, and
operations guides. The vendored YAML specs are the single source of truth for
the wire contract.

## License

GNU General Public License v3.0 · [Rhizomatica](https://www.rhizomatica.org/)
