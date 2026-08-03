import { execSync } from 'node:child_process';
import { SQLiteAdapter } from '../../src/db/sqlite.adapter.js';
import { buildApp } from '../../src/app.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { FastifyInstance } from 'fastify';

const PRIV = '/tmp/test-hermes-priv.pem';
const PUB = '/tmp/test-hermes-pub.pem';

let keysGenerated = false;

function ensureKeys(): void {
  if (keysGenerated) return;
  execSync(`openssl genrsa -out ${PRIV} 2048 2>/dev/null`);
  execSync(`openssl rsa -in ${PRIV} -pubout -out ${PUB} 2>/dev/null`);
  keysGenerated = true;
}

export function getTestKeyPaths(): { privateKeyPath: string; publicKeyPath: string } {
  ensureKeys();
  return { privateKeyPath: PRIV, publicKeyPath: PUB };
}

export function createTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  const keys = getTestKeyPaths();
  return {
    databasePath: ':memory:',
    port: 0,
    host: '127.0.0.1',
    corsOrigins: '*',
    logLevel: 'silent',
    radioDriver: 'simulated',
    dbAdapter: 'sqlite',
    jwtPrivateKeyPath: keys.privateKeyPath,
    jwtPublicKeyPath: keys.publicKeyPath,
    jwtAccessExpiresIn: 900,
    jwtRefreshExpiresIn: 604800,
    version: '0.0.0-test',
    ...overrides,
  };
}

/**
 * Create the users and user_sessions tables in an in-memory SQLite database.
 * Matches the Drizzle schema defined in src/db/schema/.
 */
export function createTestTables(adapter: SQLiteAdapter): void {
  adapter.db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      callsign TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'user' NOT NULL CHECK(role IN ('admin', 'operator', 'user', 'readonly')),
      status TEXT DEFAULT 'active' NOT NULL CHECK(status IN ('active', 'suspended', 'pending')),
      avatar_path TEXT,
      metadata TEXT DEFAULT '{}' NOT NULL,
      locale TEXT DEFAULT 'en' NOT NULL CHECK(locale IN ('en', 'es', 'pt-BR')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT
    )
  `);
  adapter.db.run('CREATE UNIQUE INDEX IF NOT EXISTS users_callsign_unique ON users (callsign)');
  adapter.db.run('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)');

  adapter.db.run(`
    CREATE TABLE user_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      device_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      refresh_replaced_by TEXT,
      created_at TEXT NOT NULL
    )
  `);
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions (token_hash)');
  adapter.db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_active ON user_sessions (expires_at)');
}

export interface TestAppContext {
  app: FastifyInstance;
  adapter: SQLiteAdapter;
}

export async function createTestApp(overrides?: Partial<AppConfig>): Promise<TestAppContext> {
  ensureKeys();
  const config = createTestConfig(overrides);
  const adapter = new SQLiteAdapter(':memory:');
  const app = await buildApp({ config, adapter });
  await app.listen({ port: 0, host: '127.0.0.1' });
  return { app, adapter };
}