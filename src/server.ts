import 'dotenv/config';
import { loadConfig } from '@shared/config.js';
import { SQLiteAdapter } from '@db/sqlite.adapter.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const adapter = new SQLiteAdapter(config.databasePath);

  const app = await buildApp({ config, adapter });

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Server listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    await adapter.close();
    process.exit(1);
  }
}

void main();