import { DatabaseSync } from 'node:sqlite';
import { SqlDriver } from './driver.js';

function normalizeParams(params?: unknown[]): (string | number | bigint | null | Uint8Array)[] | undefined {
  if (!params) return undefined;
  return params.map((p) => {
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p === undefined) return null;
    return p as string | number | bigint | null | Uint8Array;
  });
}

/**
 * Bản cài đặt SqlDriver sử dụng mô-đun node:sqlite của Node.js (Mục T05.1).
 * Dùng cho môi trường chạy kiểm thử tự động (tests) trên Node.js.
 */
export class NodeSqliteDriver implements SqlDriver {
  private db: DatabaseSync;
  private savepointCounter = 0;

  constructor(location: string = ':memory:') {
    this.db = new DatabaseSync(location);
    // Bắt buộc bật foreign_keys theo đúng chỉ đạo số 1 của chủ dự án
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    const normalized = normalizeParams(params);
    if (!normalized || normalized.length === 0) {
      this.db.exec(sql);
      return;
    }
    const stmt = this.db.prepare(sql);
    stmt.run(...normalized);
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const normalized = normalizeParams(params);
    const rows = normalized && normalized.length > 0 ? stmt.all(...normalized) : stmt.all();
    return rows as T[];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const normalized = normalizeParams(params);
    const row = normalized && normalized.length > 0 ? stmt.get(...normalized) : stmt.get();
    return (row as T) ?? null;
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    const spName = `sp_${++this.savepointCounter}`;
    this.db.exec(`SAVEPOINT ${spName};`);
    try {
      const result = await fn(this);
      this.db.exec(`RELEASE SAVEPOINT ${spName};`);
      return result;
    } catch (error) {
      this.db.exec(`ROLLBACK TO SAVEPOINT ${spName};`);
      this.db.exec(`RELEASE SAVEPOINT ${spName};`);
      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
