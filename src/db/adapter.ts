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
 *
 * ## Database Client Type
 *
 * `DatabaseClient` is currently aliased to `BetterSQLite3Database`. When
 * PostgreSQL support is added (Phase 10+), this alias will change to a union
 * or generic type. Repositories that need a specific backend can parameterize
 * `DatabaseAdapter<T>`; repositories that are backend-agnostic can use
 * the default parameter. See ADR-001 for the SQLite-first rationale.
 */
export type DatabaseClient = BetterSQLite3Database;

export interface DatabaseAdapter<TDb = DatabaseClient> {
  readonly db: TDb;

  /**
   * Execute work within a database transaction. If the callback resolves, the
   * transaction is committed. If it throws, the transaction is rolled back.
   *
   * In SQLite, transaction() uses `db.transaction()` which handles BEGIN/COMMIT/ROLLBACK.
   * In PostgreSQL (Phase 10+), this will map to `client.query('BEGIN')` / `COMMIT` / `ROLLBACK`.
   *
   * @example
   *   await adapter.transaction(async (tx) => {
   *     const messages = new MessagesRepository({ db: tx });
   *     const deliveries = new MessageDeliveriesRepository({ db: tx });
   *     const msg = await messages.create(...);
   *     await deliveries.create(...);
   *   });
   */
  transaction<T>(work: (txDb: TDb) => Promise<T>): Promise<T>;

  /** Check database connectivity and integrity (PRAGMA integrity_check) */
  healthCheck(): Promise<{ ok: boolean; details?: string }>;

  /** Close the database connection gracefully */
  close(): Promise<void>;
}
