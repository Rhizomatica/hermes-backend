# WebSocket Realtime Gateway — Hermes Webservice

## Overview

The WebSocket gateway provides realtime event streaming to connected clients (browser UI, mobile devices). It implements a custom subprotocol (`hermes-v1`) built on top of the WebSocket protocol (RFC 6455).

## Protocol Specification

### Connection

Connect to the WebSocket endpoint with the `hermes-v1` subprotocol:

```
ws://localhost:3000/gateway
wss://sbitx.local:3000/gateway  (production)

Subprotocols: hermes-v1
```

### Message Format

All messages are JSON-encoded with a `type` field:

```json
{
  "type": "MESSAGE_TYPE",
  "timestamp": "2026-07-27T15:30:00.000Z",
  "payload": { }
}
```

### Authentication Flow

```
Client                          Server
  │                                │
  │  CONNECT (hermes-v1)           │
  │──────────────────────────────▶ │
  │                                │ 10-second auth timeout starts
  │                                │
  │  AUTHENTICATE                  │
  │  { token: "<access_token>" }   │
  │──────────────────────────────▶ │
  │                                │ Verify JWT RS256 signature
  │                                │ Check expiry, RBAC claims
│  AUTHENTICATED                 │
│  { userId, callsign, role,     │
│    locale, sessionId,          │
│    serverTime, connectionId }  │
  │◀────────────────────────────── │
  │                                │
  │  SUBSCRIBE                     │
  │  { topics: ["conversation:*",  │
  │    "radio:telemetry"] }        │
  │──────────────────────────────▶ │
  │                                │
  │  SUBSCRIBED                    │
  │  { topics: [...] }             │
  │◀────────────────────────────── │
```

If the client does not send `AUTHENTICATE` within 10 seconds, the server closes the connection with code `4001` (auth timeout).

### Client → Server Messages

| Type | Description | Payload |
|------|-------------|---------|
| `AUTHENTICATE` | Authenticate with JWT | `{ token: string }` |
| `SUBSCRIBE` | Subscribe to topics | `{ topics: string[] }` |
| `UNSUBSCRIBE` | Unsubscribe from topics | `{ topics: string[] }` |
| `PING` | Heartbeat | `{ }` |
| `SYNC_REQUEST` | Request missed events | `{ cursors: { [topic]: number } }` |

### Server → Client Messages

| Type | Description | Payload |
|------|-------------|---------|
| `AUTHENTICATED` | Auth successful | `{ userId, callsign, role, locale, serverTime, connectionId }` |
| `SUBSCRIBED` | Subscription confirmed | `{ topics: string[] }` |
| `ERROR` | Error occurred | `{ code: number, message: string }` |
| `PONG` | Heartbeat response | `{ serverTime }` |
| `SYNC_DELTA` | Batch of missed events | `{ events: Event[], nextCursors }` |
| `SYNC_SUMMARY` | Too many missed events | `{ topic, missedCount, suggestion }` |
| `SYNC_COMPLETE` | Sync finished | `{ cursors }` |
| `MESSAGE_NEW` | New message in conversation | `{ message, conversationId }` |
| `MESSAGE_EDITED` | Message was edited | `{ message, conversationId }` |
| `MESSAGE_DELETED` | Message was soft-deleted | `{ messageId, conversationId }` |
| `MESSAGE_DELIVERED` | Delivery confirmed | `{ messageId, userId, channel }` |
| `MESSAGE_READ` | Messages were read | `{ conversationId, userId, readUpTo }` |
| `TYPING_START` | User started typing | `{ conversationId, userId }` |
| `TYPING_STOP` | User stopped typing | `{ conversationId, userId }` |
| `PRESENCE_UPDATE` | User presence changed | `{ userId, status }` |
| `RADIO_TELEMETRY` | Radio telemetry snapshot | `{ frequency, power, swr, ... }` |
| `RADIO_STATUS` | Radio connection changed | `{ connected }` |

## Topics

Topics use a hierarchical format with wildcards:

| Topic | Description | Push Rate |
|-------|-------------|:---:|
| `radio:telemetry` | Radio telemetry snapshots | 1 Hz |
| `radio:status` | Radio connection/disconnection | Event-driven |
| `conversation:*` | All conversation events for user's conversations | Event-driven |
| `conversation:{id}` | Events for a specific conversation | Event-driven |
| `presence:station` | User presence for the entire station | Event-driven |
| `system:announcement` | System-wide announcements | Event-driven |

## Heartbeat

```
Every 30 seconds:
  Client → Server: PING
  Server → Client: PONG { serverTime }

If no PING received in 60 seconds: Server closes connection (code 4002, heartbeat timeout)
```

## Sync Protocol

When a client reconnects after being offline, it sends `SYNC_REQUEST` with its last known event sequence cursors:

```json
{
  "type": "SYNC_REQUEST",
  "cursors": {
    "conversation:abc-123": 142,
    "conversation:def-456": 89
  }
}
```

Server responds with `SYNC_DELTA` (up to 100 events per batch):

```json
{
  "type": "SYNC_DELTA",
  "events": [
    { "sequence": 143, "type": "MESSAGE_NEW", "data": { ... } },
    { "sequence": 144, "type": "MESSAGE_NEW", "data": { ... } }
  ],
  "nextCursors": {
    "conversation:abc-123": 144,
    "conversation:def-456": 89
  }
}
```

If missed events exceed 500, the server sends `SYNC_SUMMARY` instead:

```json
{
  "type": "SYNC_SUMMARY",
  "conversation:abc-123": {
    "missedCount": 1250,
    "suggestion": "Use REST API for full resync"
  }
}
```

## Connection Limits

| Limit | Value | Behavior |
|-------|:---:|----------|
| Max concurrent connections | 10 | New connection rejected with `503` if exceeded |
| Auth timeout | 10 seconds | Connection closed with code `4001` |
| Heartbeat timeout | 60 seconds | Connection closed with code `4002` |
| Max topic subscriptions | 50 | Additional `SUBSCRIBE` messages rejected |
| TYPING_START rate limit | 1 per 2 seconds | Duplicate events dropped silently |

## Error Codes

| Code | Name | Description |
|:---:|------|-------------|
| `4001` | AUTH_TIMEOUT | Client did not authenticate within 10 seconds |
| `4002` | HEARTBEAT_TIMEOUT | No PING received in 60 seconds |
| `4003` | INVALID_TOKEN | JWT verification failed |
| `4004` | TOKEN_EXPIRED | JWT access token is expired |
| `4005` | INSUFFICIENT_PERMISSIONS | User role doesn't have WebSocket access |
| `4006` | CONNECTION_LIMIT_REACHED | Server at max 10 concurrent connections |
| `4007` | SUBSCRIPTION_LIMIT_REACHED | Client exceeded 50 topic subscriptions |
| `4008` | UNKNOWN_MESSAGE_TYPE | Server received unrecognized message type |
| `4009` | RATE_LIMITED | Client sent too many messages |

## Implementation Notes

- The WebSocket gateway uses `@fastify/websocket` (which wraps `ws` library)
- Each connection runs in its own async context
- Event bus subscription is set up after `SUBSCRIBE`; cleaned up on disconnect
- Backpressure: if a client's send buffer exceeds 16 KB, events are dropped (logged at WARN)
- Radio telemetry (1 Hz) is pushed to all subscribers of `radio:telemetry` via the in-process event bus (see [ADR-002](adr/adr-002-in-process-event-bus.md))

## TypeScript Types

```typescript
// src/gateway/types.ts

interface HermesWebSocketMessage {
  type: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

interface AuthMessage extends HermesWebSocketMessage {
  type: "AUTHENTICATE";
  payload: { token: string };
}

interface SubscribeMessage extends HermesWebSocketMessage {
  type: "SUBSCRIBE";
  payload: { topics: string[] };
}

interface SyncRequestMessage extends HermesWebSocketMessage {
  type: "SYNC_REQUEST";
  payload: { cursors: Record<string, number> };
}

// Server → Client

interface AuthenticatedMessage extends HermesWebSocketMessage {
  type: "AUTHENTICATED";
  payload: { userId: string; callsign: string; role: string; locale: string; serverTime: string; connectionId: string };
}

interface SyncDeltaMessage extends HermesWebSocketMessage {
  type: "SYNC_DELTA";
  payload: {
    events: SyncEvent[];
    nextCursors: Record<string, number>;
  };
}

interface RadioTelemetryMessage extends HermesWebSocketMessage {
  type: "RADIO_TELEMETRY";
  payload: {
    frequency: number;
    power: number;
    swr: number;
    temperature: number;
    mode: string;
    timestamp: string;
  };
}
```

## References

- [RFC 6455 — The WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)
- [ADR-002 — In-Process Event Bus](adr/adr-002-in-process-event-bus.md)
- [docs/api.md](api.md) §7 — WebSocket gateway in the API spec