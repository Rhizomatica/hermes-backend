import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { DatabaseAdapter } from '@db/adapter.js';

export class SQLiteAdapter implements DatabaseAdapter {
  public readonly db: BetterSQLite3Database;
  private readonly sqlite: Database.Database;

  constructor(dbPath: string) {
    this.sqlite = new Database(dbPath);

    // Enable WAL mode and performance PRAGMAs per docs/architecture/database.md §1
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('busy_timeout = 5000');
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('synchronous = NORMAL');

    this.db = drizzle(this.sqlite);
  }

  /**
   * Execute work within a transaction. Uses Drizzle's `db.transaction()` which
   * maps to better-sqlite3's native transaction support.
   *
   * The callback receives the same `db` instance wrapped in a transactional scope.
   * If the callback resolves, the transaction commits. If it throws, the transaction
   * rolls back automatically.
   */
  async transaction<T>(work: (txDb: BetterSQLite3Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return work(tx);
    });
  }

  async healthCheck(): Promise<{ ok: boolean; details?: string }> {
    try {
      const result = this.sqlite.pragma('integrity_check', { simple: true }) as string;
      return result === 'ok' ? { ok: true } : { ok: false, details: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, details: message };
    }
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }
}
