import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export interface DatabaseAdapter {
  readonly db: BetterSQLite3Database;

  /** Check database connectivity and integrity */
  healthCheck(): Promise<{ ok: boolean; details?: string }>;

  /** Close the database connection gracefully */
  close(): Promise<void>;
}