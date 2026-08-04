import { describe, it, expect } from 'vitest';
import { SQLiteAdapter } from '../../src/db/sqlite.adapter.js';

describe('SQLiteAdapter', () => {
  it('should connect to :memory: and pass health check', async () => {
    const adapter = new SQLiteAdapter(':memory:');
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(true);
    await adapter.close();
  });

  it('should close gracefully without error', async () => {
    const adapter = new SQLiteAdapter(':memory:');
    await adapter.close();
    // If close() throws, the test fails automatically
  });
});