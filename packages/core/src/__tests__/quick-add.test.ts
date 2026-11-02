/**
 * File: packages/core/src/__tests__/quick-add.test.ts
 * Module: @cook/core
 *
 * Kiểm thử nghiệp vụ Thêm nhanh nguyên liệu vào kho (T11).
 * Kiểm tra:
 *   1. Danh sách 15 nguyên liệu hay dùng (T11.4).
 *   2. Tìm kiếm theo tên chuẩn và tên gọi khác (T11.1).
 *   3. Mức "một ít / vừa / nhiều" lấy từ cấu hình nguyên liệu (T11.2).
 *   4. Nếu MISSING thì không cho chọn mức (T11.2).
 *   5. Vị trí bảo quản và thêm hàng loạt vào kho bằng PantryService (T11.1, T11.3).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NodeSqliteDriver } from '../db/node-driver.js';
import { MigrationRunner } from '../db/migration-runner.js';
import { PantryService } from '../db/pantry-service.js';
import {
  COMMON_15_INGREDIENTS,
  QUICK_ADD_STORAGE_LOCATIONS,
  canSelectPortionLevel,
  resolvePortionQuantity,
  searchIngredients,
  batchAddToPantry,
} from '../pantry/quick-add.js';

describe('T11: Thêm nhanh nguyên liệu vào kho (Quick Add)', () => {
  let driver: NodeSqliteDriver;
  let pantryService: PantryService;

  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    const runner = new MigrationRunner(driver);
    await runner.run();
    pantryService = new PantryService(driver);

    // Chèn nguyên liệu cơ bản vào DB
    for (const ing of COMMON_15_INGREDIENTS) {
      await driver.execute(
        `INSERT INTO ingredient (id, name, "group", base_unit, aliases)
         VALUES (?, ?, 'common', ?, ?)`,
        [ing.id, ing.name, ing.baseUnit, JSON.stringify(ing.aliases)],
      );
    }
  });

  describe('T11.4: Danh sách 15 nguyên liệu hay dùng', () => {
    it('Chứa đúng 15 nguyên liệu với đầy đủ thông tin chuẩn', () => {
      expect(COMMON_15_INGREDIENTS.length).toBe(15);
      for (const ing of COMMON_15_INGREDIENTS) {
        expect(ing.id).toBeDefined();
        expect(ing.name).toBeDefined();
        expect(Array.isArray(ing.aliases)).toBe(true);
        expect(['g', 'ml', 'cái']).toContain(ing.baseUnit);
        expect(QUICK_ADD_STORAGE_LOCATIONS).toContain(ing.defaultLocation);
      }
    });
  });

  describe('T11.1: Tìm kiếm theo tên chuẩn và tên gọi khác', () => {
    it('Tìm theo tên chuẩn tiếng Việt có dấu hoặc không dấu', () => {
      const results = searchIngredients('trứng', COMMON_15_INGREDIENTS);
      expect(results.some((r) => r.id === 'trung-ga')).toBe(true);
    });

    it('Tìm theo tên gọi khác (alias): "hột gà" -> tìm thấy trứng gà', () => {
      const results = searchIngredients('hột gà', COMMON_15_INGREDIENTS);
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('trung-ga');
    });

    it('Tìm "ba rọi" -> tìm thấy thịt ba chỉ', () => {
      const results = searchIngredients('ba rọi', COMMON_15_INGREDIENTS);
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('thit-ba-chi');
    });

    it('Chuỗi rỗng trả về toàn bộ danh sách', () => {
      const results = searchIngredients('', COMMON_15_INGREDIENTS);
      expect(results.length).toBe(15);
    });
  });

  describe('T11.2: Mức "một ít / vừa / nhiều" và cấm khi MISSING', () => {
    it('Nguyên liệu có cấu hình định lượng: tính đúng lượng theo mức', () => {
      expect(canSelectPortionLevel('trung-ga')).toBe(true);
      expect(resolvePortionQuantity('trung-ga', 'little')).toBe(2);
      expect(resolvePortionQuantity('trung-ga', 'medium')).toBe(4);
      expect(resolvePortionQuantity('trung-ga', 'lot')).toBe(10);

      expect(resolvePortionQuantity('ca-chua', 'little')).toBe(200);
      expect(resolvePortionQuantity('ca-chua', 'medium')).toBe(500);
      expect(resolvePortionQuantity('ca-chua', 'lot')).toBe(1000);
    });

    it('Nếu missing_fields chứa portion_levels -> cấm chọn mức (trả về null)', () => {
      // Dù trung-ga có cấu hình nhưng nếu missing_fields báo thiếu thì cấm chọn
      expect(canSelectPortionLevel('trung-ga', ['portion_levels'])).toBe(false);
      expect(resolvePortionQuantity('trung-ga', 'medium', ['portion_levels'])).toBeNull();
    });

    it('Nguyên liệu khai báo MISSING trong dữ liệu: không cho chọn mức', () => {
      expect(canSelectPortionLevel('nguyen-lieu-chua-can')).toBe(false);
      expect(resolvePortionQuantity('nguyen-lieu-chua-can', 'little')).toBeNull();
    });
  });

  describe('T11.1 & T11.3: Thêm nhiều nguyên liệu cùng vị trí bảo quản vào kho', () => {
    it('Thêm hàng loạt 3 nguyên liệu khác nhau vào kho thành công', async () => {
      const ids = await batchAddToPantry(pantryService, [
        {
          ingredientId: 'trung-ga',
          quantity: 4,
          baseUnit: 'cái',
          storageLocation: 'ngăn mát',
        },
        {
          ingredientId: 'ca-chua',
          quantity: 500,
          baseUnit: 'g',
          storageLocation: 'ngăn mát',
        },
        {
          ingredientId: 'nuoc-mam',
          quantity: 150,
          baseUnit: 'ml',
          storageLocation: 'nhiệt độ phòng',
        },
      ]);

      expect(ids.length).toBe(3);
      expect(await pantryService.getTotalQuantity('trung-ga')).toBe(4);
      expect(await pantryService.getTotalQuantity('ca-chua')).toBe(500);
      expect(await pantryService.getTotalQuantity('nuoc-mam')).toBe(150);

      // Kiểm tra vị trí bảo quản trong DB
      const lots = await pantryService.getLotsByIngredient('nuoc-mam');
      expect(lots[0]?.storage_location).toBe('nhiệt độ phòng');
    });

    it('Báo lỗi nếu số lượng không dương', async () => {
      await expect(
        batchAddToPantry(pantryService, [
          {
            ingredientId: 'trung-ga',
            quantity: 0,
            baseUnit: 'cái',
            storageLocation: 'ngăn mát',
          },
        ]),
      ).rejects.toThrow();
    });
  });
});
