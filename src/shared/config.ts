/**
 * Configuration loader for Hermes Backend.
 * All configuration from environment variables — no process.env in modules.
 */
import { readFileSync } from 'node:fs';

export interface AppConfig {
  databasePath: string;
  port: number;
  host: string;
  corsOrigins: string;
  logLevel: string;
  radioDriver: string;
  dbAdapter: string;
  jwtPrivateKeyPath: string;
  jwtPublicKeyPath: string;
  jwtAccessExpiresIn: number;
  jwtRefreshExpiresIn: number;
  version: string;
}

function parseIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`Invalid integer for ${name}: ${value}`);
  return parsed;
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function loadConfig(): AppConfig {
  return {
    databasePath: process.env['DATABASE_PATH'] ?? './data/hermes.sqlite',
    port: parseIntEnv('PORT', 3000),
    host: process.env['HOST'] ?? '0.0.0.0',
    corsOrigins: process.env['CORS_ORIGINS'] ?? '*',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    radioDriver: process.env['RADIO_DRIVER'] ?? 'simulated',
    dbAdapter: process.env['DB_ADAPTER'] ?? 'sqlite',
    jwtPrivateKeyPath: process.env['JWT_PRIVATE_KEY_PATH'] ?? './keys/private.pem',
    jwtPublicKeyPath: process.env['JWT_PUBLIC_KEY_PATH'] ?? './keys/public.pem',
    jwtAccessExpiresIn: parseIntEnv('JWT_ACCESS_EXPIRES_IN', 900),
    jwtRefreshExpiresIn: parseIntEnv('JWT_REFRESH_EXPIRES_IN', 604_800),
    version: process.env['APP_VERSION'] || readVersion(),
  };
}