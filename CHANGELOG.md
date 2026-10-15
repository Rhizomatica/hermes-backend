# Changelog

All notable changes to the Hermes Backend project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **ADR-006: Go Rewrite and Single-Process Station Consolidation** (`docs/adr/adr-006-go-rewrite-and-station-consolidation.md`) — proposes rewriting the backend in Go and linking the Mercury modem (`libmercury_core.a`) and the radio daemon (`libradio_daemon_core.a`) in-process via cgo, with an explicit real-time isolation contract (R1–R6).
- Go migration task list (`docs/development/go-migration.md`) — gating spikes S0–S3 plus porting waves 1–6, a contract-freeze checklist, and exit criteria.
- ADR re-validation of ADR-001…005 against the Go implementation plan (`docs/development/go-migration.md` Part 3) — §R-1 single-writer serialization (per-file write discipline, bounded write queue), §R-2 event-bus delivery model **specification**, §R-3 RSA key bootstrap + explicit RS256 allow-list, §R-4 no change, §R-5 documentation defects (ADR-001 adapter selector, pragma count), and **§R-6 documentation defects in ADR-004** (JWT claim set; rate-limit model).
- Repository-topology analysis (`docs/development/go-migration.md` → *Repository topology*) — new-repo vs. stay-in-place, with the deciding input and the trigger to re-open recorded; the decision itself is deferred and gated on Spike S2.

### Changed
- **ADR-006 + `go-migration.md`: audit remediation pass.** The Context now separates **as-designed from as-implemented** — the real driver is `SBitxCLIDriver` (`execFile('/usr/local/bin/sbitx')` plus a `telemetry --interval 1` child), and no WebSocket or TCP-TNC client exists in the repository; the "what is removed" table names the *real* removals (per-command process spawn, telemetry stdout parsing) and marks the two not-yet-built surfaces as removed-before-written; the isolation contract is made implementable (`isolcpus` + **engine self-pinning**, since `GOMAXPROCS` does not place threads, and buffer-level `mlock` instead of process-wide `mlockall`); the `ExecStopPost` PTT mitigation is replaced with a requirement that **survives `SIGKILL`/`SIGSEGV`/OOM**; contract figures are corrected (16 tables, 4 of 7 pragmas applied, canonical JWT claim set, the global `300/min` limiter and its spoofable `X-Forwarded-For` key); Waves 3–6 are re-framed as **built to spec** rather than ported; and the RAM exit criterion now requires a **recorded baseline**.
- ADR-004: added a correction note to §"RBAC Claims in JWT" — the documented `permissions`/`station` claims are not issued, and the issued `callsign`/`locale` claims were undocumented (`src/auth/token.ts`).
- ADR-005: the multi-station federation forward reference now points to ADR-007 (ADR-006 is the Go rewrite and station consolidation).
- ADR-001: corrected the documented adapter selector from `DATABASE_ADAPTER` to the implemented `DB_ADAPTER`.
- ADR-001, ADR-002, ADR-005: added "Go port note" cross-references for the runtime assumptions that do not carry over to Go (event-loop write serialization, `EventEmitter` delivery semantics).
- `docs/development/plan.md`: added a note that the Node.js/TypeScript phase plan remains the behavioral specification the Go port must satisfy.
- `README.md`: the Decisions index now lists ADR-005 and ADR-006; the Development index links the Go migration guide.

### Planned
- See `docs/development/plan.md` for the full 10-phase development roadmap.

---

## [0.1.0] — Pre-Implementation

### Added
- Initial project documentation and architecture specification
- Full REST API specification (`docs/architecture/api.md`) — 1081 lines covering all endpoints
- Full database schema (`docs/architecture/database.md`) — 1436 lines, 17+ tables, SQLite WAL mode design
- Architecture audit for sBitx v2 Raspberry Pi 4 deployment (`docs/audits/sbitx-v2.md`)
- 10-phase development plan with 90+ discrete tasks (`docs/development/plan.md`)
- Root-level project files: `README.md`, `LICENSE` (GPLv3), `CONTRIBUTING.md`, `CHANGELOG.md`, `.gitignore`, `.env.example`
- Architecture Decision Records: ADR-001 through ADR-004
- Supporting documentation: development setup, CI/CD strategy, testing strategy, security model, deployment guide, WebSocket protocol, hardware integration guide, observability guide