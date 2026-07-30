import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/**
 * DatabaseAdapter Strategy
 * ========================
 *
 * SQLite is the primary production database for single-station sBitx v2 deployments
 * on Raspberry Pi 4. See ADR-001 (docs/adr/adr-001-sqlite-for-pi4.md) for rationale.
 *
 * This adapter interface abstracts the database backend, enabling PostgreSQL for
 * multi-station server deployments without changing application code.
 *
 * **Current implementation**: SQLiteAdapter (src/db/sqlite.adapter.ts)
 *   - WAL mode, busy_timeout=5000, foreign_keys=ON, synchronous=NORMAL
 *   - Only backend implemented and tested in Phases 1–9
 *
 * **Future**: PostgresAdapter (Phase 10+)
 *   - For multi-station federation deployments
 *   - Swap via DB_ADAPTER environment variable (default: 'sqlite')
 *
 * All repository classes depend on this interface via constructor injection.
 * No direct Drizzle queries in controllers or services — data access goes through
 * repositories implementing this adapter.
 */
export interface DatabaseAdapter {
  readonly db: BetterSQLite3Database;

  /** Check database connectivity and integrity (PRAGMA integrity_check) */
  healthCheck(): Promise<{ ok: boolean; details?: string }>;

  /** Close the database connection gracefully */
  close(): Promise<void>;
}
