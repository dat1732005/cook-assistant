import { SqlDriver } from './driver.js';
import { INITIAL_SCHEMA_SQL } from './migrations/001_initial_schema.js';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const DEFAULT_MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    sql: INITIAL_SCHEMA_SQL,
  },
];

/**
 * Bộ chạy migration cơ sở dữ liệu có đánh số phiên bản, tính giao dịch và idempotent (Mục T05.2).
 */
export class MigrationRunner {
  constructor(private driver: SqlDriver) {}

  /**
   * Chạy các migrations chưa được áp dụng.
   * Mỗi migration được thực thi trong một transaction riêng biệt.
   */
  async run(
    migrations: Migration[] = DEFAULT_MIGRATIONS
  ): Promise<{ appliedCount: number; currentVersion: number }> {
    // 1. Đảm bảo bảng schema_migrations tồn tại
    await this.driver.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // 2. Lấy danh sách phiên bản đã áp dụng
    const appliedRows = await this.driver.query<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC;'
    );
    const appliedVersions = new Set(appliedRows.map((r) => r.version));

    let appliedCount = 0;
    const sorted = [...migrations].sort((a, b) => a.version - b.version);

    for (const mig of sorted) {
      if (appliedVersions.has(mig.version)) {
        continue;
      }

      // Thực thi migration trong một giao dịch
      await this.driver.transaction(async (tx) => {
        await tx.execute(mig.sql);
        await tx.execute(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'));",
          [mig.version, mig.name]
        );
      });

      appliedCount++;
      appliedVersions.add(mig.version);
    }

    const currentVersionRow = await this.driver.queryOne<{ max_version: number | null }>(
      'SELECT MAX(version) as max_version FROM schema_migrations;'
    );

    return {
      appliedCount,
      currentVersion: currentVersionRow?.max_version ?? 0,
    };
  }
}
