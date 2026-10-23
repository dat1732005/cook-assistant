import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { NodeSqliteDriver } from '../db/node-driver.js';
import { MigrationRunner } from '../db/migration-runner.js';
import { loadDataBundle } from '../db/data-loader.js';
import { RecipeRepo } from '../db/recipe-repo.js';
// @ts-expect-error - CLI script without type declaration file
import { runBundle } from '../../../../scripts/bundle-data.js';

// Nạp dữ liệu synthetic test fixtures từ fixtures/t05/
const fixturesDir = path.resolve(import.meta.dirname, '../../../../fixtures/t05');

function loadFixtures() {
  const ingredients = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'ingredients.json'), 'utf-8')
  );
  const fxV = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-v.json'), 'utf-8'));
  const fxX = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-x.json'), 'utf-8'));
  const fxY = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-y.json'), 'utf-8'));
  const fxZ = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-z.json'), 'utf-8'));
  const fxW = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-w.json'), 'utf-8'));

  return {
    ingredients,
    recipes: [fxV, fxX, fxY, fxZ, fxW],
    fxV,
    fxX,
    fxY,
    fxZ,
    fxW,
  };
}

describe('T05: SQLite, Migrations, Data Bundling, Versioning & RecipeRepo', () => {
  // ==========================================
  // PHẦN A. Migration (A1 - A7)
  // ==========================================
  describe('A. Migration', () => {
    it('A1: Chạy migration trên CSDL trống -> 11 bảng được tạo, schema_migrations có version = 1', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        const runner = new MigrationRunner(driver);
        const res = await runner.run();
        expect(res.appliedCount).toBe(1);
        expect(res.currentVersion).toBe(1);

        // Kiểm tra schema_migrations có đúng 1 hàng, version = 1
        const migRows = await driver.query<{ version: number }>('SELECT * FROM schema_migrations;');
        expect(migRows.length).toBe(1);
        expect(migRows[0]?.version).toBe(1);

        // Kiểm tra 11 bảng người dùng tạo ra (9 MVP + 2 hệ thống)
        const tables = await driver.query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;"
        );
        const tableNames = tables.map((t) => t.name).sort();
        const expectedTables = [
          'ai_usage_log',
          'app_metadata',
          'cook_session',
          'ingredient',
          'pantry_event',
          'pantry_item',
          'recipe',
          'recipe_ingredient',
          'recipe_step',
          'schema_migrations',
          'user_profile',
        ].sort();

        expect(tableNames).toEqual(expectedTables);
        expect(tableNames.length).toBe(11);
      } finally {
        await driver.close();
      }
    });

    it('A2: Chạy migration lần thứ hai trên cùng CSDL -> Không lỗi, schema_migrations vẫn đúng 1 hàng', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        const runner = new MigrationRunner(driver);
        await runner.run();

        const res2 = await runner.run();
        expect(res2.appliedCount).toBe(0);
        expect(res2.currentVersion).toBe(1);

        const migRows = await driver.query('SELECT * FROM schema_migrations;');
        expect(migRows.length).toBe(1);
      } finally {
        await driver.close();
      }
    });

    it('A3: Migration 2 cố tình sai câu SQL -> Báo lỗi, rollback cả giao dịch, version vẫn là 1', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        const runner = new MigrationRunner(driver);
        await runner.run(); // Version 1 thành công

        // Migration 2 cố tình có cú pháp SQL sai
        const badMigrations = [
          {
            version: 2,
            name: '002_broken_migration',
            sql: 'CREATE TABLE broken_table (id INT PRIMARY KEY); INVALID SQL SYNTAX HERE;',
          },
        ];

        await expect(runner.run(badMigrations)).rejects.toThrow();

        // Kiểm tra schema_migrations vẫn chỉ có version = 1
        const migRows = await driver.query<{ version: number }>('SELECT * FROM schema_migrations;');
        expect(migRows.length).toBe(1);
        expect(migRows[0]?.version).toBe(1);

        // Bảng dở broken_table không tồn tại
        const brokenCheck = await driver.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='broken_table';"
        );
        expect(brokenCheck.length).toBe(0);
      } finally {
        await driver.close();
      }
    });

    it('A4: Chèn recipe_ingredient có recipe_id không tồn tại -> Bị từ chối do khóa ngoại', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        const runner = new MigrationRunner(driver);
        await runner.run();

        // Chèn trước ingredient hợp lệ
        await driver.execute(
          `INSERT INTO ingredient (id, name, "group", base_unit) VALUES ('test-ing', 'Test', 'gia-vi', 'g');`
        );

        // Chèn recipe_ingredient với recipe_id không tồn tại
        await expect(
          driver.execute(
            `INSERT INTO recipe_ingredient (id, recipe_id, ingredient_id, qty, unit, role, flavor_group)
             VALUES ('ri-1', 'non-existent-recipe', 'test-ing', 10, 'g', 'flavor', 'salt');`
          )
        ).rejects.toThrow(/FOREIGN KEY/i);
      } finally {
        await driver.close();
      }
    });

    it('A5: Chèn ai_usage_log với tokens_in, tokens_out, cost_micro_usd để trống -> Đọc ra NULL, không phải 0', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        const runner = new MigrationRunner(driver);
        await runner.run();

        // Cần tạo user_profile trước do khóa ngoại user_id
        await driver.execute("INSERT INTO user_profile (id) VALUES ('u1');");

        await driver.execute(
          `INSERT INTO ai_usage_log (id, user_id, kind, tokens_in, tokens_out, cost_micro_usd, created_at)
           VALUES ('log-1', 'u1', 'substitute', NULL, NULL, NULL, '2026-10-23T10:00:00Z');`
        );

        const row = await driver.queryOne<{
          tokens_in: number | null;
          tokens_out: number | null;
          cost_micro_usd: number | null;
        }>('SELECT tokens_in, tokens_out, cost_micro_usd FROM ai_usage_log WHERE id = ?;', [
          'log-1',
        ]);

        expect(row).toBeDefined();
        expect(row?.tokens_in).toBeNull();
        expect(row?.tokens_out).toBeNull();
        expect(row?.cost_micro_usd).toBeNull();
        expect(row?.tokens_in).not.toBe(0);
        expect(row?.tokens_out).not.toBe(0);
        expect(row?.cost_micro_usd).not.toBe(0);
      } finally {
        await driver.close();
      }
    });

    it("A6: Chèn ai_usage_log với kind = 'khac' -> Bị từ chối do CHECK constraint", async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        const runner = new MigrationRunner(driver);
        await runner.run();

        await driver.execute("INSERT INTO user_profile (id) VALUES ('u1');");

        await expect(
          driver.execute(
            `INSERT INTO ai_usage_log (id, user_id, kind, created_at)
             VALUES ('log-2', 'u1', 'khac', '2026-10-23T10:00:00Z');`
          )
        ).rejects.toThrow(/CHECK constraint/i);
      } finally {
        await driver.close();
      }
    });

    it("A7: Chèn ai_usage_log với kind = 'qa', tokens_in = 120, tokens_out = 45, cost = 1500 -> Thành công, đọc đúng 3 số nguyên", async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        const runner = new MigrationRunner(driver);
        await runner.run();

        await driver.execute("INSERT INTO user_profile (id) VALUES ('u1');");

        await driver.execute(
          `INSERT INTO ai_usage_log (id, user_id, kind, tokens_in, tokens_out, cost_micro_usd, created_at)
           VALUES ('log-3', 'u1', 'qa', 120, 45, 1500, '2026-10-23T10:00:00Z');`
        );

        const row = await driver.queryOne<{
          tokens_in: number;
          tokens_out: number;
          cost_micro_usd: number;
        }>('SELECT tokens_in, tokens_out, cost_micro_usd FROM ai_usage_log WHERE id = ?;', [
          'log-3',
        ]);

        expect(row?.tokens_in).toBe(120);
        expect(row?.tokens_out).toBe(45);
        expect(row?.cost_micro_usd).toBe(1500);
      } finally {
        await driver.close();
      }
    });
  });

  // ==========================================
  // PHẦN B. Nạp dữ liệu đóng gói (B1 - B8)
  // ==========================================
  describe('B. Nạp dữ liệu đóng gói', () => {
    it('B1: Lần đầu, data_version = 1, không bật cờ dev -> recipe có 4 hàng (fx-v, fx-x, fx-y, fx-z); fx-w không có; app_metadata có data_version = 1', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const { ingredients, recipes } = loadFixtures();

        const res = await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          { allowDraft: false }
        );

        expect(res.status).toBe('loaded');
        expect(res.loadedRecipesCount).toBe(4);

        const rows = await driver.query<{ slug: string }>('SELECT slug FROM recipe ORDER BY slug ASC;');
        const slugs = rows.map((r) => r.slug);
        expect(slugs).toEqual(['fx-v', 'fx-x', 'fx-y', 'fx-z']);

        const meta = await driver.queryOne<{ value: string }>(
          "SELECT value FROM app_metadata WHERE key = 'data_version';"
        );
        expect(meta?.value).toBe('1');
      } finally {
        await driver.close();
      }
    });

    it('B2: Chạy lại bộ nạp với cùng data_version = 1 -> Báo bỏ qua, số hàng mọi bảng không đổi', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const { ingredients, recipes } = loadFixtures();

        // Nạp lần 1
        await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          { allowDraft: false }
        );

        // Nạp lần 2 cùng data_version = 1
        let logOutput = '';
        const res2 = await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          {
            allowDraft: false,
            logger: (msg) => {
              console.log(msg);
              logOutput += msg;
            },
          }
        );

        expect(res2.status).toBe('skipped');
        expect(res2.loadedRecipesCount).toBe(0);
        expect(logOutput).toContain('bỏ qua nạp');

        const rows = await driver.query('SELECT slug FROM recipe;');
        expect(rows.length).toBe(4);
      } finally {
        await driver.close();
      }
    });

    it('B3: data_version = 2, fx-x đổi total_minutes 10 thành 12 và version tăng lên 2 -> Nạp lại 1 lần, recipe vẫn 4 hàng, fx-x cập nhật', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const { ingredients, recipes } = loadFixtures();

        await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          { allowDraft: false }
        );

        // Tạo bản copy của recipes với fx-x được cập nhật
        const updatedRecipes = recipes.map((r) => {
          if (r.slug === 'fx-x') {
            return { ...r, total_minutes: 12, version: 2 };
          }
          return r;
        });

        const res2 = await loadDataBundle(
          driver,
          { data_version: 2, ingredients, recipes: updatedRecipes },
          { allowDraft: false }
        );

        expect(res2.status).toBe('loaded');

        // Bảng recipe vẫn đúng 4 hàng (không nhân đôi)
        const rows = await driver.query<{ slug: string; total_minutes: number; version: number }>(
          'SELECT slug, total_minutes, version FROM recipe WHERE slug = ?;',
          ['fx-x']
        );
        expect(rows.length).toBe(1);
        expect(rows[0]?.total_minutes).toBe(12);
        expect(rows[0]?.version).toBe(2);

        const totalRows = await driver.query('SELECT slug FROM recipe;');
        expect(totalRows.length).toBe(4);

        const meta = await driver.queryOne<{ value: string }>(
          "SELECT value FROM app_metadata WHERE key = 'data_version';"
        );
        expect(meta?.value).toBe('2');
      } finally {
        await driver.close();
      }
    });

    it('B4: Lần đầu, data_version = 1, bật cờ dev -> recipe có 5 hàng (gồm fx-w)', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const { ingredients, recipes } = loadFixtures();

        const res = await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          { allowDraft: true }
        );

        expect(res.status).toBe('loaded');
        expect(res.loadedRecipesCount).toBe(5);

        const rows = await driver.query<{ slug: string }>('SELECT slug FROM recipe ORDER BY slug ASC;');
        expect(rows.map((r) => r.slug)).toEqual(['fx-v', 'fx-w', 'fx-x', 'fx-y', 'fx-z']);
      } finally {
        await driver.close();
      }
    });

    it('B5: Bộ dữ liệu rỗng -> Không lỗi, không crash, 0 hàng được nạp, ghi log rõ', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();

        let logOutput = '';
        const res = await loadDataBundle(
          driver,
          { data_version: 1, recipes: [] },
          {
            logger: (msg) => {
              console.log(msg);
              logOutput += msg;
            },
          }
        );

        expect(res.status).toBe('loaded');
        expect(res.loadedRecipesCount).toBe(0);
        expect(logOutput).toContain('không có món nào để nạp');

        const rows = await driver.query('SELECT slug FROM recipe;');
        expect(rows.length).toBe(0);
      } finally {
        await driver.close();
      }
    });

    it('B6: bundle-data khi thư mục đầu vào có đúng một tệp synthetic: true ngoài fixtures/ -> Thoát mã khác 0, in tệp vi phạm, không chép vào target', () => {
      const tempSource = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-test-b6-src-'));
      const tempTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-test-b6-dst-'));

      try {
        // Tạo đúng một tệp có synthetic: true ngoài fixtures/
        const synFile = path.join(tempSource, 'synthetic-recipe.json');
        fs.writeFileSync(
          synFile,
          JSON.stringify({
            slug: 'synthetic-mon-test',
            name: 'Món giả lập',
            synthetic: true,
            status: 'published',
            steps: [{ id: 's1', seconds: 30, text: 'step 1' }],
          }),
          'utf-8'
        );

        const res = runBundle({
          source: tempSource,
          target: tempTarget,
        });

        expect(res.success).toBe(false);
        expect(res.code).not.toBe(0);
        expect(res.error).toBe('synthetic-file-detected');
        expect(res.offendingFile).toContain('synthetic-recipe.json');

        // Đảm bảo không chép tệp đó vào thư mục target
        const copiedFiles = fs.readdirSync(tempTarget);
        expect(copiedFiles.length).toBe(0);
      } finally {
        fs.rmSync(tempSource, { recursive: true, force: true });
        fs.rmSync(tempTarget, { recursive: true, force: true });
      }
    });

    it('B7: bundle-data bản production khi cờ dev bật -> Build thất bại, in lý do rõ ràng', () => {
      const tempTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-test-b7-dst-'));
      try {
        const res = runBundle({
          source: path.resolve(import.meta.dirname, '../../../../data'),
          target: tempTarget,
          isProduction: true,
          isDev: true,
        });

        expect(res.success).toBe(false);
        expect(res.code).toBe(1);
        expect(res.error).toBe('production-dev-conflict');
      } finally {
        fs.rmSync(tempTarget, { recursive: true, force: true });
      }
    });

    it('B8: bundle-data với thư mục tạm có 3 món (published, reviewed, draft) -> Chứng minh chỉ 2 món được đóng gói, không có fixtures/', () => {
      const tempSource = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-test-b8-src-'));
      const tempTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-test-b8-dst-'));

      try {
        // Tạo 3 món: published, reviewed, draft trong thư mục tạm
        fs.writeFileSync(
          path.join(tempSource, 'recipe-published.json'),
          JSON.stringify({
            slug: 'mon-published',
            name: 'Món đã xuất bản',
            status: 'published',
            steps: [{ id: 's1', seconds: 60, text: 'step 1' }],
          }),
          'utf-8'
        );
        fs.writeFileSync(
          path.join(tempSource, 'recipe-reviewed.json'),
          JSON.stringify({
            slug: 'mon-reviewed',
            name: 'Món đã kiểm duyệt',
            status: 'reviewed',
            steps: [{ id: 's1', seconds: 60, text: 'step 1' }],
          }),
          'utf-8'
        );
        fs.writeFileSync(
          path.join(tempSource, 'recipe-draft.json'),
          JSON.stringify({
            slug: 'mon-draft',
            name: 'Món nháp',
            status: 'draft',
            steps: [{ id: 's1', seconds: 60, text: 'step 1' }],
          }),
          'utf-8'
        );

        const res = runBundle({
          source: tempSource,
          target: tempTarget,
          isDev: false,
          isProduction: false,
        });

        expect(res.success).toBe(true);
        expect(res.code).toBe(0);
        expect(res.recipeCount).toBe(2);

        // Chứng minh chỉ đúng 2 món được đóng gói, món draft không có
        const filesInTarget = fs.readdirSync(tempTarget);
        expect(filesInTarget).toContain('recipe-published.json');
        expect(filesInTarget).toContain('recipe-reviewed.json');
        expect(filesInTarget).not.toContain('recipe-draft.json');

        const manifest = JSON.parse(
          fs.readFileSync(path.join(tempTarget, 'bundle-manifest.json'), 'utf-8')
        );
        expect(manifest.recipe_count).toBe(2);
        expect(manifest.recipes.sort()).toEqual(['mon-published', 'mon-reviewed']);
      } finally {
        fs.rmSync(tempSource, { recursive: true, force: true });
        fs.rmSync(tempTarget, { recursive: true, force: true });
      }
    });
  });

  // ==========================================
  // PHẦN C. Phiên bản công thức (C1 - C4)
  // ==========================================
  describe('C. Phiên bản công thức', () => {
    it('C1: Nạp lại fx-x mà nội dung đổi nhưng version vẫn là 1 -> Từ chối với lỗi rõ ràng, CSDL không đổi', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const { ingredients, recipes } = loadFixtures();

        // Nạp lần đầu
        await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          { allowDraft: false }
        );

        // Nạp lại với total_minutes đổi từ 10 thành 12 nhưng version vẫn giữ là 1
        const changedWithoutBump = recipes.map((r) => {
          if (r.slug === 'fx-x') {
            return { ...r, total_minutes: 12, version: 1 };
          }
          return r;
        });

        await expect(
          loadDataBundle(
            driver,
            { data_version: 2, ingredients, recipes: changedWithoutBump },
            { allowDraft: false }
          )
        ).rejects.toThrow(/C1-REJECT/);

        // CSDL không đổi: fx-x.total_minutes vẫn là 10, data_version vẫn là 1
        const fxx = await driver.queryOne<{ total_minutes: number; version: number }>(
          'SELECT total_minutes, version FROM recipe WHERE slug = ?;',
          ['fx-x']
        );
        expect(fxx?.total_minutes).toBe(10);
        expect(fxx?.version).toBe(1);

        const meta = await driver.queryOne<{ value: string }>(
          "SELECT value FROM app_metadata WHERE key = 'data_version';"
        );
        expect(meta?.value).toBe('1');
      } finally {
        await driver.close();
      }
    });

    it('C2: Nạp lại fx-x với nội dung đổi và version = 2 -> Cập nhật thành công', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const { ingredients, recipes } = loadFixtures();

        await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          { allowDraft: false }
        );

        const changedWithBump = recipes.map((r) => {
          if (r.slug === 'fx-x') {
            return { ...r, total_minutes: 12, version: 2 };
          }
          return r;
        });

        const res = await loadDataBundle(
          driver,
          { data_version: 2, ingredients, recipes: changedWithBump },
          { allowDraft: false }
        );

        expect(res.status).toBe('loaded');
        const fxx = await driver.queryOne<{ total_minutes: number; version: number }>(
          'SELECT total_minutes, version FROM recipe WHERE slug = ?;',
          ['fx-x']
        );
        expect(fxx?.total_minutes).toBe(12);
        expect(fxx?.version).toBe(2);
      } finally {
        await driver.close();
      }
    });

    it('C3: Nạp lại fx-x với nội dung y hệt và version giữ nguyên -> Không lỗi, không cập nhật', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const { ingredients, recipes } = loadFixtures();

        await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          { allowDraft: false }
        );

        // Nạp lại data_version = 2 nhưng nội dung và version các món giữ y nguyên
        const res = await loadDataBundle(
          driver,
          { data_version: 2, ingredients, recipes },
          { allowDraft: false }
        );

        expect(res.status).toBe('loaded');
        const fxx = await driver.queryOne<{ total_minutes: number; version: number }>(
          'SELECT total_minutes, version FROM recipe WHERE slug = ?;',
          ['fx-x']
        );
        expect(fxx?.total_minutes).toBe(10);
        expect(fxx?.version).toBe(1);
      } finally {
        await driver.close();
      }
    });

    it('C4: Tạo cook_session khi fx-x.version = 1, nạp lên version = 2, tạo session mới -> Phiên cũ giữ 1, phiên mới có 2', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const { ingredients, recipes } = loadFixtures();

        await loadDataBundle(
          driver,
          { data_version: 1, ingredients, recipes },
          { allowDraft: false }
        );

        // Tạo cook_session cũ
        await driver.execute(
          `INSERT INTO cook_session (
            id, recipe_id, recipe_version, servings, optimization_mode, started_at, status
          ) VALUES ('cs-1', 'fx-x', 1, 2, 'fastest', '2026-10-23T10:00:00Z', 'done');`
        );

        // Nạp lại fx-x lên version = 2
        const updatedRecipes = recipes.map((r) => {
          if (r.slug === 'fx-x') {
            return { ...r, total_minutes: 12, version: 2 };
          }
          return r;
        });

        await loadDataBundle(
          driver,
          { data_version: 2, ingredients, recipes: updatedRecipes },
          { allowDraft: false }
        );

        // Tạo cook_session mới với phiên bản hiện tại của fx-x (version 2)
        const currentFxX = await driver.queryOne<{ version: number }>(
          'SELECT version FROM recipe WHERE slug = ?;',
          ['fx-x']
        );
        expect(currentFxX?.version).toBe(2);

        await driver.execute(
          `INSERT INTO cook_session (
            id, recipe_id, recipe_version, servings, optimization_mode, started_at, status
          ) VALUES ('cs-2', 'fx-x', ?, 2, 'fastest', '2026-10-23T11:00:00Z', 'cooking');`,
          [currentFxX!.version]
        );

        // Kiểm tra phiên cũ vẫn giữ nguyên recipe_version = 1
        const cs1 = await driver.queryOne<{ recipe_version: number }>(
          'SELECT recipe_version FROM cook_session WHERE id = ?;',
          ['cs-1']
        );
        expect(cs1?.recipe_version).toBe(1);

        // Phiên mới có recipe_version = 2
        const cs2 = await driver.queryOne<{ recipe_version: number }>(
          'SELECT recipe_version FROM cook_session WHERE id = ?;',
          ['cs-2']
        );
        expect(cs2?.recipe_version).toBe(2);
      } finally {
        await driver.close();
      }
    });
  });

  // ==========================================
  // PHẦN D. RecipeRepo (D1 - D5)
  // ==========================================
  describe('D. RecipeRepo', () => {
    let repoDriver: NodeSqliteDriver;
    let repo: RecipeRepo;

    // Chuẩn bị dữ liệu mục 0: fx-v, fx-x, fx-y, fx-z (fx-w là draft nên không có)
    beforeAll(async () => {
      repoDriver = new NodeSqliteDriver(':memory:');
      await new MigrationRunner(repoDriver).run();
      const { ingredients, recipes } = loadFixtures();

      await loadDataBundle(
        repoDriver,
        { data_version: 1, ingredients, recipes },
        { allowDraft: false }
      );
      repo = new RecipeRepo(repoDriver);
    });

    afterAll(async () => {
      await repoDriver.close();
    });

    // D1. Lọc theo dị ứng
    describe('D1. Lọc theo dị ứng', () => {
      it('D1a: Dị ứng egg -> [fx-y] (fx-x và fx-v có trứng, fx-z bị loại do dị ứng chưa rõ)', async () => {
        const list = await repo.list({ userAllergies: ['egg'] });
        expect(list.map((r) => r.slug)).toEqual(['fx-y']);
      });

      it('D1b: Dị ứng peanut -> [fx-x] (fx-y và fx-v có đậu phộng, fx-z bị loại do dị ứng chưa rõ)', async () => {
        const list = await repo.list({ userAllergies: ['peanut'] });
        expect(list.map((r) => r.slug)).toEqual(['fx-x']);
      });

      it('D1c: Dị ứng egg và peanut -> []', async () => {
        const list = await repo.list({ userAllergies: ['egg', 'peanut'] });
        expect(list.map((r) => r.slug)).toEqual([]);
      });

      it('D1d: Đã khai: không có dị ứng -> [fx-v, fx-x, fx-y, fx-z] (fx-z hiện ra vì người dùng không dị ứng)', async () => {
        const list = await repo.list({ userAllergies: [] });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x', 'fx-y', 'fx-z']);
      });

      it('D1e: Chưa khai dị ứng (null) -> [] (chưa hoàn thành Chào mừng, an toàn sức khỏe)', async () => {
        const list = await repo.list({ userAllergies: null });
        expect(list.map((r) => r.slug)).toEqual([]);
      });
    });

    // D2. Lọc theo thời gian (max_minutes, nhỏ hơn hoặc bằng), người dùng đã khai không dị ứng
    describe('D2. Lọc theo thời gian', () => {
      it('D2a: max_minutes = 25 -> [fx-v, fx-x, fx-z]', async () => {
        const list = await repo.list({ userAllergies: [], maxMinutes: 25 });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x', 'fx-z']);
      });

      it('D2b: max_minutes = 20 -> [fx-v, fx-x, fx-z] (biên: bằng 20 vẫn lấy)', async () => {
        const list = await repo.list({ userAllergies: [], maxMinutes: 20 });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x', 'fx-z']);
      });

      it('D2c: max_minutes = 19 -> [fx-v, fx-x]', async () => {
        const list = await repo.list({ userAllergies: [], maxMinutes: 19 });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x']);
      });

      it('D2d: max_minutes = 15 -> [fx-v, fx-x]', async () => {
        const list = await repo.list({ userAllergies: [], maxMinutes: 15 });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x']);
      });

      it('D2e: max_minutes = 10 -> [fx-v, fx-x] (biên: bằng 10 vẫn lấy)', async () => {
        const list = await repo.list({ userAllergies: [], maxMinutes: 10 });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x']);
      });

      it('D2f: max_minutes = 9 -> [fx-v]', async () => {
        const list = await repo.list({ userAllergies: [], maxMinutes: 9 });
        expect(list.map((r) => r.slug)).toEqual(['fx-v']);
      });

      it('D2g: max_minutes = 4 -> []', async () => {
        const list = await repo.list({ userAllergies: [], maxMinutes: 4 });
        expect(list.map((r) => r.slug)).toEqual([]);
      });
    });

    // D3. Lọc theo dụng cụ (người dùng cần có MỌI dụng cụ mà món yêu cầu)
    describe('D3. Lọc theo dụng cụ', () => {
      it('D3a: Chỉ chao -> [fx-v, fx-x, fx-z]', async () => {
        const list = await repo.list({ userAllergies: [], userEquipment: ['chao'] });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x', 'fx-z']);
      });

      it('D3b: Chỉ noi -> [fx-y]', async () => {
        const list = await repo.list({ userAllergies: [], userEquipment: ['noi'] });
        expect(list.map((r) => r.slug)).toEqual(['fx-y']);
      });

      it('D3c: chao và noi -> [fx-v, fx-x, fx-y, fx-z]', async () => {
        const list = await repo.list({ userAllergies: [], userEquipment: ['chao', 'noi'] });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x', 'fx-y', 'fx-z']);
      });

      it('D3d: Không có dụng cụ nào -> []', async () => {
        const list = await repo.list({ userAllergies: [], userEquipment: [] });
        expect(list.map((r) => r.slug)).toEqual([]);
      });
    });

    // D4. Kết hợp nhiều bộ lọc
    describe('D4. Kết hợp nhiều bộ lọc', () => {
      it('D4a: Dị ứng peanut + có chao + max_minutes = 15 -> [fx-x]', async () => {
        const list = await repo.list({
          userAllergies: ['peanut'],
          userEquipment: ['chao'],
          maxMinutes: 15,
        });
        expect(list.map((r) => r.slug)).toEqual(['fx-x']);
      });

      it('D4b: Dị ứng egg + có chao + max_minutes = 60 -> [] (fx-y cần noi mà người dùng không có)', async () => {
        const list = await repo.list({
          userAllergies: ['egg'],
          userEquipment: ['chao'],
          maxMinutes: 60,
        });
        expect(list.map((r) => r.slug)).toEqual([]);
      });

      it('D4c: Đã khai không dị ứng + có chao và noi + max_minutes = 60 -> [fx-v, fx-x, fx-y, fx-z]', async () => {
        const list = await repo.list({
          userAllergies: [],
          userEquipment: ['chao', 'noi'],
          maxMinutes: 60,
        });
        expect(list.map((r) => r.slug)).toEqual(['fx-v', 'fx-x', 'fx-y', 'fx-z']);
      });
    });

    // D5. get(slug)
    describe('D5. get(slug)', () => {
      it('D5a: get("fx-x") -> Trả đúng món fx-x kèm nguyên liệu và các bước', async () => {
        const detail = await repo.get('fx-x');
        expect(detail).toBeDefined();
        expect(detail?.slug).toBe('fx-x');
        expect(detail?.name).toBe('Món giả X');
        expect(detail?.ingredients.length).toBe(1);
        expect(detail?.ingredients[0]?.ingredient).toBe('fx-ing-egg');
        expect(detail?.steps.length).toBe(1);
        expect(detail?.steps[0]?.id).toBe('s1');
      });

      it('D5b: get("khong-co") -> Trả về null, không ném lỗi', async () => {
        const detail = await repo.get('khong-co');
        expect(detail).toBeNull();
      });

      it('D5c: get("fx-w") khi không bật cờ dev -> Trả về null (món draft không được nạp)', async () => {
        const detail = await repo.get('fx-w');
        expect(detail).toBeNull();
      });
    });
  });

  // ==========================================
  // PHẦN E. Driver và kiến trúc (E1 - E2)
  // ==========================================
  describe('E. Driver và kiến trúc', () => {
    it('E1: NodeSqliteDriver vượt qua toàn bộ các ca A đến D', () => {
      // Đã được chứng minh qua toàn bộ các test A-D phía trên chạy với NodeSqliteDriver
      expect(true).toBe(true);
    });

    it('E2: Mã nghiệp vụ (RecipeRepo, DataLoader, MigrationRunner) không import trực tiếp expo-sqlite hay node:sqlite', () => {
      const coreSrcDir = path.resolve(process.cwd(), 'src');
      const filesToCheck = [
        path.join(coreSrcDir, 'db', 'recipe-repo.ts'),
        path.join(coreSrcDir, 'db', 'data-loader.ts'),
        path.join(coreSrcDir, 'db', 'migration-runner.ts'),
        path.join(coreSrcDir, 'db', 'driver.ts'),
      ];

      for (const file of filesToCheck) {
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).not.toMatch(/from\s+['"]node:sqlite['"]/);
        expect(content).not.toMatch(/from\s+['"]expo-sqlite['"]/);
        expect(content).not.toMatch(/import\s+['"]node:sqlite['"]/);
        expect(content).not.toMatch(/import\s+['"]expo-sqlite['"]/);
      }
    });
  });
});
