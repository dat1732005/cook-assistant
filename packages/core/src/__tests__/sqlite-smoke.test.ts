import { describe, expect, it } from 'vitest';

describe('T05: node:sqlite Smoke Test', () => {
  it('loads node:sqlite without error or provides a clear failure message', async () => {
    let DatabaseSync: typeof import('node:sqlite').DatabaseSync;
    try {
      const sqliteModule = await import('node:sqlite');
      DatabaseSync = sqliteModule.DatabaseSync;
    } catch (err) {
      throw new Error(
        `[CRITICAL] node:sqlite is not available in Node ${process.version}. ` +
          `T05 requires Node >=22.23.2 with native node:sqlite support. Error: ${(err as Error).message}`,
        { cause: err }
      );
    }

    if (!DatabaseSync) {
      throw new Error(
        `[CRITICAL] node:sqlite.DatabaseSync is undefined in Node ${process.version}. ` +
          `T05 requires Node >=22.23.2 with synchronous SQLite support.`
      );
    }

    expect(DatabaseSync).toBeDefined();

    // Verify database creation and basic operations
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE smoke_test (id INTEGER PRIMARY KEY, msg TEXT);');
      const insert = db.prepare('INSERT INTO smoke_test (msg) VALUES (?)');
      insert.run('hello sqlite');

      const select = db.prepare('SELECT msg FROM smoke_test WHERE id = 1');
      const row = select.get() as { msg: string } | undefined;
      expect(row).toBeDefined();
      expect(row?.msg).toBe('hello sqlite');
    } finally {
      db.close();
    }
  });
});
