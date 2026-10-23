/**
 * File: packages/core/src/__tests__/allergy-and-time-filter.test.ts
 * Làm gì: Bộ kiểm thử độc lập cho quy tắc dị ứng (AllergenCode[] | null), ALLERGIES_NOT_DECLARED,
 *         và quy tắc kiểm định/lọc món ăn theo total_minutes.
 * Nhận vào: NodeSqliteDriver, UserProfileRepo, RecipeRepo, RecipeSchema, validateData.
 * Trả ra: Kết quả kiểm thử tự động với ít nhất 2 ca đúng và 3 ca sai theo chỉ đạo của chủ dự án.
 * Ai gọi: Bộ chạy kiểm thử Vitest qua lệnh `pnpm test` và `pnpm verify`.
 * Bám theo: Quyết định kỹ thuật của chủ dự án tại T06 & T-INFRA; docs/coding-rules.md.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeSqliteDriver } from '../db/node-driver.js';
import { MigrationRunner } from '../db/migration-runner.js';
import { UserProfileRepo } from '../db/profile-repo.js';
import { RecipeRepo, ALLERGIES_NOT_DECLARED } from '../db/recipe-repo.js';
import { UserProfileSchema } from '../schemas/profile.js';
// @ts-expect-error validate-data.js là tệp script JS ngoài thư mục src
import { validateData } from '../../../../scripts/validate-data.js';

describe('Kiểm thử quy tắc dị ứng và bộ lọc thời gian (T06 / T-INFRA)', () => {
  // ==========================================
  // CÁC CA ĐÚNG (HỢP LỆ)
  // ==========================================
  describe('Các ca đúng (Hợp lệ)', () => {
    it('Ca đúng 1: user_profile.allergies là null (chưa khai báo) -> Lưu SQLite thành công; RecipeRepo.list trả về [] kèm mã ALLERGIES_NOT_DECLARED', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const profileRepo = new UserProfileRepo(driver);
        const recipeRepo = new RecipeRepo(driver);

        // Lưu hồ sơ người dùng khi chưa khai báo dị ứng (allergies: null)
        const saved = await profileRepo.saveProfile({
          servings: 2,
          allergies: null,
          essential_spices: ['muoi', 'tieu'],
          available_equipment: ['chao', 'noi'],
        });

        expect(saved.allergies).toBeNull();

        // Đọc lại từ CSDL SQLite để đảm bảo giá trị null được lưu bền vững
        const loaded = await profileRepo.getProfile();
        expect(loaded).not.toBeNull();
        expect(loaded?.allergies).toBeNull();

        // Gọi RecipeRepo.list với allergies = null
        const result = await recipeRepo.list({ allergies: null });

        // Danh sách phải rỗng để đảm bảo an toàn tính mạng người dùng
        expect(result.length).toBe(0);
        expect([...result]).toEqual([]);
        // Thuộc tính code phải mang mã ALLERGIES_NOT_DECLARED
        expect(result.code).toBe(ALLERGIES_NOT_DECLARED);
      } finally {
        await driver.close();
      }
    });

    it('Ca đúng 2: user_profile.allergies là [] (đã khai: không có dị ứng) -> Lưu SQLite thành công; RecipeRepo.list trả về danh sách món, không có mã ALLERGIES_NOT_DECLARED', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const profileRepo = new UserProfileRepo(driver);
        const recipeRepo = new RecipeRepo(driver);

        // Thêm 1 món mẫu có total_minutes hợp lệ vào bảng recipe
        await driver.execute(
          `INSERT INTO recipe (
            id, slug, name, servings_base, total_minutes, difficulty, equipment, tags, status, version
          ) VALUES ('mon-1', 'mon-rau-xao', 'Món rau xào', 2, 10, 1, '["chao"]', '["xao"]', 'published', 1);`
        );

        // Lưu hồ sơ người dùng đã khai rõ ràng không có dị ứng (allergies: [])
        const saved = await profileRepo.saveProfile({
          servings: 3,
          allergies: [],
          essential_spices: ['muoi'],
          available_equipment: ['chao'],
        });

        expect(saved.allergies).toEqual([]);

        // Đọc lại từ SQLite
        const loaded = await profileRepo.getProfile();
        expect(loaded?.allergies).toEqual([]);

        // Gọi RecipeRepo.list khi đã khai không dị ứng
        const result = await recipeRepo.list({ allergies: [] });

        // Món hợp lệ được trả về
        expect(result.length).toBe(1);
        expect(result[0]?.slug).toBe('mon-rau-xao');
        // Không có mã lỗi ALLERGIES_NOT_DECLARED
        expect(result.code).toBeUndefined();
      } finally {
        await driver.close();
      }
    });

    it('Ca đúng 3: Bộ lọc thời gian (max_minutes) giữ lại món đạt ngưỡng và tự động loại món thiếu total_minutes (null hoặc 0)', async () => {
      const driver = new NodeSqliteDriver(':memory:');
      try {
        await new MigrationRunner(driver).run();
        const recipeRepo = new RecipeRepo(driver);

        // Chèn 3 món thử nghiệm:
        // 1. mon-chuan: total_minutes = 15 (đạt ngưỡng <= 15)
        // 2. mon-lau: total_minutes = 30 (vượt ngưỡng > 15)
        // 3. mon-thieu-gio: total_minutes = 0 (coi như thiếu thông tin thời gian)
        await driver.execute(
          `INSERT INTO recipe (id, slug, name, servings_base, total_minutes, difficulty, equipment, tags, status, version)
           VALUES ('m1', 'mon-chuan', 'Món chuẩn 15p', 2, 15, 1, '[]', '[]', 'published', 1);`
        );
        await driver.execute(
          `INSERT INTO recipe (id, slug, name, servings_base, total_minutes, difficulty, equipment, tags, status, version)
           VALUES ('m2', 'mon-lau', 'Món lâu 30p', 2, 30, 1, '[]', '[]', 'published', 1);`
        );
        await driver.execute(
          `INSERT INTO recipe (id, slug, name, servings_base, total_minutes, difficulty, equipment, tags, status, version)
           VALUES ('m3', 'mon-thieu-gio', 'Món thiếu giờ 0p', 2, 0, 1, '[]', '[]', 'published', 1);`
        );

        // Lọc với max_minutes = 15 khi người dùng đã khai không dị ứng
        const result = await recipeRepo.list({
          allergies: [],
          max_minutes: 15,
        });

        // Chỉ đúng món chuẩn 15 phút được trả về; món lâu (30p) và món thiếu giờ (0p) bị loại
        expect(result.map((r) => r.slug)).toEqual(['mon-chuan']);
      } finally {
        await driver.close();
      }
    });
  });

  // ==========================================
  // CÁC CA SAI (BẮT LỖI)
  // ==========================================
  describe('Các ca sai (Bắt lỗi)', () => {
    it('Ca sai 1: Lưu user_profile với mã dị ứng không thuộc enum AllergenCode -> Bị từ chối với lỗi rõ ràng', () => {
      const invalidData = {
        id: 'user-fail-1',
        servings: 2,
        allergies: ['hat-dieu-la'], // Mã dị ứng không hợp lệ
      };

      const parsed = UserProfileSchema.safeParse(invalidData);
      expect(parsed.success).toBe(false);

      if (!parsed.success) {
        const errorPath = parsed.error.issues[0]?.path;
        expect(errorPath).toContain('allergies');
      }
    });

    it('Ca sai 2: Lưu user_profile với kiểu dữ liệu sai của allergies (chuỗi hoặc số thay vì mảng/null) -> Bị từ chối', () => {
      const invalidString = {
        id: 'user-fail-2',
        servings: 2,
        allergies: 'egg', // Phải là mảng hoặc null, không được truyền chuỗi
      };

      const parsed = UserProfileSchema.safeParse(invalidString);
      expect(parsed.success).toBe(false);
    });

    it('Ca sai 3: Món ở trạng thái published thiếu total_minutes -> validateData báo lỗi rõ ràng', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-test-min-published-'));
      try {
        const recipesDir = path.join(tempDir, 'recipes');
        fs.mkdirSync(recipesDir, { recursive: true });

        const publishedMissingMinutes = {
          slug: 'mon-thieu-phut',
          name: 'Món thiếu phút nấu',
          servings_base: 2,
          equipment: ['chao'],
          ingredients: [
            {
              ingredient: 'trung-ga',
              qty: 2,
              unit: 'quả',
              role: 'structure',
              flavor_group: 'none',
              optional: false,
            },
          ],
          steps: [
            {
              id: 's1',
              order: 1,
              title: 'Rán trứng',
              kind: 'active',
              seconds: 120,
              after: [],
              resources: ['chao'],
              text: 'Rán chín đều hai mặt',
            },
          ],
          status: 'published',
          reviewer: 'Chuyên gia ẩm thực',
          reviewed_at: '2026-10-23',
          source: 'Sách nấu ăn gia đình',
          confirmed_by: 'Bếp trưởng',
          missing_fields: [],
          synthetic: true,
          // Thiếu total_minutes
        };

        fs.writeFileSync(
          path.join(recipesDir, 'mon-thieu-phut.json'),
          JSON.stringify(publishedMissingMinutes, null, 2),
          'utf8'
        );

        const result = validateData({ dataDir: tempDir });
        expect(result.valid).toBe(false);
        expect(
          result.errors.some((err: string) =>
            err.includes('thiếu trường total_minutes (tổng phút nấu hợp lệ)')
          )
        ).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('Ca sai 4: Món ở trạng thái reviewed có total_minutes <= 0 (ví dụ: -10) -> validateData báo lỗi rõ ràng', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-test-min-reviewed-'));
      try {
        const recipesDir = path.join(tempDir, 'recipes');
        fs.mkdirSync(recipesDir, { recursive: true });

        const reviewedNegativeMinutes = {
          slug: 'mon-phut-am',
          name: 'Món phút âm',
          servings_base: 2,
          total_minutes: -10, // Số âm không hợp lệ
          equipment: ['noi'],
          ingredients: [
            {
              ingredient: 'thit-heo',
              qty: 200,
              unit: 'g',
              role: 'structure',
              flavor_group: 'none',
              optional: false,
            },
          ],
          steps: [
            {
              id: 's1',
              order: 1,
              title: 'Luộc thịt',
              kind: 'active',
              seconds: 600,
              after: [],
              resources: ['noi'],
              text: 'Luộc thịt chín tới',
            },
          ],
          status: 'reviewed',
          reviewer: 'Chuyên gia dinh dưỡng',
          reviewed_at: '2026-10-23',
          source: 'Tài liệu bếp Việt',
          confirmed_by: 'Bác sĩ dinh dưỡng',
          missing_fields: [],
          synthetic: true,
        };

        fs.writeFileSync(
          path.join(recipesDir, 'mon-phut-am.json'),
          JSON.stringify(reviewedNegativeMinutes, null, 2),
          'utf8'
        );

        const result = validateData({ dataDir: tempDir });
        expect(result.valid).toBe(false);
        expect(
          result.errors.some((err: string) =>
            err.includes('total_minutes')
          )
        ).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
