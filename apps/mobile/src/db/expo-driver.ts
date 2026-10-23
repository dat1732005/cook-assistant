import type { SQLiteDatabase, SQLiteBindValue } from 'expo-sqlite';
import type { SqlDriver } from '@cook/core';

/**
 * Bản cài đặt SqlDriver sử dụng expo-sqlite cho ứng dụng React Native / Expo di động (Mục T05.1).
 */
export class ExpoSqliteDriver implements SqlDriver {
  private db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  static async create(db: SQLiteDatabase): Promise<ExpoSqliteDriver> {
    // Bắt buộc bật foreign_keys theo chỉ đạo số 1 của chủ dự án
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return new ExpoSqliteDriver(db);
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    if (!params || params.length === 0) {
      await this.db.execAsync(sql);
      return;
    }
    await this.db.runAsync(sql, ...(params as SQLiteBindValue[]));
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!params || params.length === 0) {
      return (await this.db.getAllAsync<T>(sql)) ?? [];
    }
    return (await this.db.getAllAsync<T>(sql, ...(params as SQLiteBindValue[]))) ?? [];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    if (!params || params.length === 0) {
      return (await this.db.getFirstAsync<T>(sql)) ?? null;
    }
    return (await this.db.getFirstAsync<T>(sql, ...(params as SQLiteBindValue[]))) ?? null;
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    let result!: T;
    await this.db.withTransactionAsync(async () => {
      result = await fn(this);
    });
    return result;
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
  }
}
