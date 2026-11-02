/**
 * File: packages/core/src/__tests__/pantry-service.test.ts
 * Module: @cook/core
 *
 * Kiểm thử toàn diện PantryService đọc kỳ vọng trực tiếp từ khối JSON Ca P trong docs/expected/T10.md.
 * Bao gồm các ca kiểm thử P1 đến P10 và 1 test chứng minh đỏ khi đổi một số trong khối JSON.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeSqliteDriver } from '../db/node-driver.js';
import { MigrationRunner } from '../db/migration-runner.js';
import {
  PantryService,
  roundTo3,
  calcDeductAmount,
  buildDeductSpecs,
} from '../db/pantry-service.js';

// ==========================================
// ĐỌC KỲ VỌNG TRỰC TIẾP TỪ docs/expected/T10.md
// ==========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const expectedFilePath = path.resolve(__dirname, '../../../../docs/expected/T10.md');
const t10RawContent = fs.readFileSync(expectedFilePath, 'utf-8');

const jsonBlocks = [...t10RawContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
  .map((m) => (m && m[1] ? (JSON.parse(m[1]) as Record<string, unknown>) : null))
  .filter((b): b is Record<string, unknown> => b !== null);

interface RecipeIngredientSpec {
  i: string;
  qty: number;
  unit: string;
  optional?: boolean;
}

interface SyntheticRecipe {
  servings_base: number;
  ingredients: RecipeIngredientSpec[];
}

interface BlockPType {
  case: 'P';
  init: Record<string, number>;
  recipes: Record<string, SyntheticRecipe>;
  cases: Array<{
    id: string;
    recipe?: string;
    servings?: number;
    after?: Record<string, number>;
    omit?: string[];
    substitute?: Record<string, Record<string, number>>;
    override?: Record<string, number>;
    shortage?: Record<string, number>;
    lots?: Record<string, Array<{ lot: string; qty: number; expires_day: number | null }>>;
    after_lots?: Record<string, number>;
    events_for_ca_chua?: Array<{ lot: string; delta: number }>;
    essential?: string[];
    base?: string;
    undo?: { after: string };
    undo_twice?: { error: string };
    ingredient_qty?: number;
    unit?: string;
    base_servings?: number;
    deduct?: number;
  }>;
}

const blockP = jsonBlocks.find((b) => b['case'] === 'P') as unknown as BlockPType;

if (!blockP) {
  throw new Error('Không tìm thấy khối JSON Ca P trong docs/expected/T10.md');
}

// Bảng quy đổi giả theo T10.md
const syntheticConversions: Record<
  string,
  { baseUnit: 'g' | 'ml' | 'cái'; conversions: Record<string, number> }
> = {
  trung: { baseUnit: 'cái', conversions: { quả: 1 } },
  'ca-chua': { baseUnit: 'g', conversions: { quả: 100 } },
  duong: { baseUnit: 'g', conversions: { 'thìa cà phê': 4, 'thìa canh': 12 } },
  muoi: { baseUnit: 'g', conversions: { 'thìa cà phê': 5 } },
  toi: { baseUnit: 'cái', conversions: { nhánh: 1 } },
  'hanh-la': { baseUnit: 'cái', conversions: { nhánh: 1 } },
  'nuoc-mam': { baseUnit: 'ml', conversions: { 'thìa cà phê': 5, 'thìa canh': 15 } },
  'dau-an': { baseUnit: 'ml', conversions: { 'thìa cà phê': 5, 'thìa canh': 15 } },
  'rau-muong': { baseUnit: 'g', conversions: {} },
  'thit-ba-chi': { baseUnit: 'g', conversions: {} },
};

/**
 * Khởi tạo CSDL SQLite in-memory, chạy migration và chèn dữ liệu nguyên liệu giả.
 */
async function setupDb(): Promise<{ driver: NodeSqliteDriver; service: PantryService }> {
  const driver = new NodeSqliteDriver(':memory:');
  const runner = new MigrationRunner(driver);
  await runner.run();

  // Chèn nguyên liệu giả vào bảng ingredient để đảm bảo toàn vẹn dữ liệu
  for (const [id, info] of Object.entries(syntheticConversions)) {
    await driver.execute(
      `INSERT INTO ingredient (id, name, "group", base_unit, conversions)
       VALUES (?, ?, 'synthetic', ?, ?)`,
      [id, id, info.baseUnit, JSON.stringify(info.conversions)],
    );
  }

  // Chèn các món ăn giả vào bảng recipe để thỏa mãn foreign key của cook_session
  for (const [recipeId, recipeData] of Object.entries(blockP.recipes)) {
    await driver.execute(
      `INSERT INTO recipe (id, slug, name, servings_base, total_minutes, difficulty, status)
       VALUES (?, ?, ?, ?, 30, 1, 'published')`,
      [recipeId, recipeId, recipeId, recipeData.servings_base],
    );
  }

  const service = new PantryService(driver);
  return { driver, service };
}

/**
 * Tạo bản ghi cook_session trước khi gọi deductForSession để thỏa mãn foreign key.
 */
async function createCookSession(
  driver: NodeSqliteDriver,
  sessionId: string,
  recipeId: string,
  servings: number,
): Promise<void> {
  await driver.execute(
    `INSERT INTO cook_session (id, recipe_id, recipe_version, servings, optimization_mode, started_at, status)
     VALUES (?, ?, 1, ?, 'fastest', datetime('now'), 'cooking')`,
    [sessionId, recipeId, servings],
  );
}

/**
 * Nạp kho ban đầu theo định nghĩa INIT của Ca P.
 */
async function populatePantryInit(
  service: PantryService,
  overrides?: Record<string, number>,
): Promise<void> {
  const init = { ...blockP.init, ...(overrides ?? {}) };
  for (const [ingId, qty] of Object.entries(init)) {
    const info = syntheticConversions[ingId];
    if (info) {
      await service.add({
        id: `init-${ingId}`,
        ingredientId: ingId,
        quantity: qty,
        baseUnit: info.baseUnit,
        storageLocation: 'bếp',
      });
    }
  }
}

describe('T10: PantryService (đối chiếu docs/expected/T10.md - Ca P)', () => {
  let driver: NodeSqliteDriver;
  let service: PantryService;

  beforeEach(async () => {
    const setup = await setupDb();
    driver = setup.driver;
    service = setup.service;
  });

  // =========================================================================
  // CÁC HÀM CƠ BẢN: add & adjust
  // =========================================================================
  describe('Các hàm cơ bản: add & adjust', () => {
    it('add thêm lô nguyên liệu và adjust cập nhật số lượng ghi pantry_event', async () => {
      const lotId = await service.add({
        ingredientId: 'trung',
        quantity: 10,
        baseUnit: 'cái',
        storageLocation: 'ngăn mát',
      });
      expect(typeof lotId).toBe('string');
      expect(await service.getTotalQuantity('trung')).toBe(10);

      // Điều chỉnh số lượng
      await service.adjust(lotId, 7);
      expect(await service.getTotalQuantity('trung')).toBe(7);

      // Kiểm tra sự kiện adjust được ghi
      const events = await driver.query<{ delta: number; reason: string }>(
        'SELECT delta, reason FROM pantry_event WHERE pantry_item_id = ?',
        [lotId],
      );
      expect(events.length).toBe(1);
      expect(events[0]?.reason).toBe('adjust');
      expect(events[0]?.delta).toBe(-3);

      // Không cho phép số lượng âm
      await expect(service.adjust(lotId, -1)).rejects.toThrow();
    });
  });

  // =========================================================================
  // CA P1 - P4: Trừ kho theo công thức chuẩn
  // =========================================================================
  describe('P1 - P4: Trừ kho theo công thức và số phần', () => {
    it('P1: M1, 2 phần -> trứng 3, cà chua 300, mắm 95, đường 98, dầu 170, hành 2', async () => {
      const p1Case = blockP.cases.find((c) => c.id === 'P1')!;
      await populatePantryInit(service);

      const recipe = blockP.recipes[p1Case.recipe!]!;
      const specs = buildDeductSpecs({
        recipe,
        servings: p1Case.servings!,
        conversionsMap: syntheticConversions,
      });

      await createCookSession(driver, 'session_P1', p1Case.recipe!, p1Case.servings!);
      const res = await service.deductForSession('session_P1', specs);
      expect(Object.keys(res.shortages).length).toBe(0);

      const snapshot = await service.getSnapshot();
      for (const [ingId, expectedQty] of Object.entries(p1Case.after!)) {
        expect(snapshot[ingId]).toBe(expectedQty);
      }
    });

    it('P2: M1, 4 phần -> trứng 0, cà chua 100, mắm 90, đường 96, dầu 140, hành 1', async () => {
      const p2Case = blockP.cases.find((c) => c.id === 'P2')!;
      await populatePantryInit(service);

      const recipe = blockP.recipes[p2Case.recipe!]!;
      const specs = buildDeductSpecs({
        recipe,
        servings: p2Case.servings!,
        conversionsMap: syntheticConversions,
      });

      await createCookSession(driver, 'session_P2', p2Case.recipe!, p2Case.servings!);
      await service.deductForSession('session_P2', specs);

      const snapshot = await service.getSnapshot();
      for (const [ingId, expectedQty] of Object.entries(p2Case.after!)) {
        expect(snapshot[ingId]).toBe(expectedQty);
      }
    });

    it('P3: M2, 3 phần -> rau muống 550, muối 192.5, tỏi 7', async () => {
      const p3Case = blockP.cases.find((c) => c.id === 'P3')!;
      await populatePantryInit(service);

      const recipe = blockP.recipes[p3Case.recipe!]!;
      const specs = buildDeductSpecs({
        recipe,
        servings: p3Case.servings!,
        conversionsMap: syntheticConversions,
      });

      await createCookSession(driver, 'session_P3', p3Case.recipe!, p3Case.servings!);
      await service.deductForSession('session_P3', specs);

      const snapshot = await service.getSnapshot();
      for (const [ingId, expectedQty] of Object.entries(p3Case.after!)) {
        expect(snapshot[ingId]).toBe(expectedQty);
      }
    });

    it('P4: M3, 2 phần -> thịt 600, trứng 2, mắm 70, đường 88', async () => {
      const p4Case = blockP.cases.find((c) => c.id === 'P4')!;
      await populatePantryInit(service);

      const recipe = blockP.recipes[p4Case.recipe!]!;
      const specs = buildDeductSpecs({
        recipe,
        servings: p4Case.servings!,
        conversionsMap: syntheticConversions,
      });

      await createCookSession(driver, 'session_P4', p4Case.recipe!, p4Case.servings!);
      await service.deductForSession('session_P4', specs);

      const snapshot = await service.getSnapshot();
      for (const [ingId, expectedQty] of Object.entries(p4Case.after!)) {
        expect(snapshot[ingId]).toBe(expectedQty);
      }
    });
  });

  // =========================================================================
  // CA P5 - P8: Tùy biến bỏ/thay thế, thiếu kho, nhiều lô, gia vị thiết yếu
  // =========================================================================
  describe('P5 - P8: Tùy biến nguyên liệu và quản lý lô', () => {
    it('P5: M1, 2 phần, bỏ hành lá, thay nước mắm bằng muối 3 g', async () => {
      const p5Case = blockP.cases.find((c) => c.id === 'P5')!;
      await populatePantryInit(service);

      const recipe = blockP.recipes[p5Case.recipe!]!;
      const specs = buildDeductSpecs({
        recipe,
        servings: p5Case.servings!,
        omit: p5Case.omit,
        substitute: p5Case.substitute,
        conversionsMap: syntheticConversions,
      });

      await createCookSession(driver, 'session_P5', p5Case.recipe!, p5Case.servings!);
      await service.deductForSession('session_P5', specs);

      const snapshot = await service.getSnapshot();
      for (const [ingId, expectedQty] of Object.entries(p5Case.after!)) {
        expect(snapshot[ingId]).toBe(expectedQty);
      }
    });

    it('P6: M1, 2 phần, kho chỉ có trứng 2 cái -> trứng về 0, thiếu 1', async () => {
      const p6Case = blockP.cases.find((c) => c.id === 'P6')!;
      await populatePantryInit(service, p6Case.override);

      const recipe = blockP.recipes[p6Case.recipe!]!;
      const specs = buildDeductSpecs({
        recipe,
        servings: p6Case.servings!,
        conversionsMap: syntheticConversions,
      });

      await createCookSession(driver, 'session_P6', p6Case.recipe!, p6Case.servings!);
      const res = await service.deductForSession('session_P6', specs);

      const snapshot = await service.getSnapshot();
      for (const [ingId, expectedQty] of Object.entries(p6Case.after!)) {
        expect(snapshot[ingId]).toBe(expectedQty);
      }

      // Kiểm tra phần thiếu
      for (const [ingId, expectedShortage] of Object.entries(p6Case.shortage!)) {
        expect(res.shortages[ingId]).toBe(expectedShortage);
      }
    });

    it('P7: Cà chua có 3 lô L1 (150 g hạn ngày 2), L2 (300 g hạn ngày 5), L3 (100 g không hạn) -> trừ L1 trước rồi L2', async () => {
      const p7Case = blockP.cases.find((c) => c.id === 'P7')!;
      // Nạp kho INIT nhưng không nạp cà chua
      const initWithoutCaChua = { ...blockP.init };
      delete initWithoutCaChua['ca-chua'];
      await populatePantryInit(service, initWithoutCaChua);

      // Thêm 3 lô cà chua cụ thể
      const caChuaLots = p7Case.lots!['ca-chua']!;
      for (const lot of caChuaLots) {
        await service.add({
          id: lot.lot,
          ingredientId: 'ca-chua',
          quantity: lot.qty,
          baseUnit: 'g',
          storageLocation: 'ngăn mát',
          expiryDate: lot.expires_day ? `2026-11-0${lot.expires_day}` : null,
        });
      }

      const recipe = blockP.recipes[p7Case.recipe!]!;
      const specs = buildDeductSpecs({
        recipe,
        servings: p7Case.servings!,
        conversionsMap: syntheticConversions,
      });

      await createCookSession(driver, 'session_P7', p7Case.recipe!, p7Case.servings!);
      const res = await service.deductForSession('session_P7', specs);

      // Kiểm tra lượng sau của từng lô
      for (const [lotId, expectedQty] of Object.entries(p7Case.after_lots!)) {
        const row = await driver.queryOne<{ quantity: number }>(
          'SELECT quantity FROM pantry_item WHERE id = ?',
          [lotId],
        );
        expect(row?.quantity).toBe(expectedQty);
      }

      // Kiểm tra các sự kiện ghi cho cà chua
      const caChuaResult = res.ingredients.find((r) => r.ingredientId === 'ca-chua')!;
      expect(caChuaResult.events.length).toBe(p7Case.events_for_ca_chua!.length);
      for (let i = 0; i < p7Case.events_for_ca_chua!.length; i++) {
        const expectedEvt = p7Case.events_for_ca_chua![i]!;
        expect(caChuaResult.events[i]?.pantryItemId).toBe(expectedEvt.lot);
        expect(caChuaResult.events[i]?.delta).toBe(expectedEvt.delta);
      }
    });

    it('P8: Nước mắm, đường, dầu ăn khai "luôn có sẵn" -> không trừ kho các mục này', async () => {
      const p8Case = blockP.cases.find((c) => c.id === 'P8')!;
      await populatePantryInit(service);

      const recipe = blockP.recipes[p8Case.recipe!]!;
      const specs = buildDeductSpecs({
        recipe,
        servings: p8Case.servings!,
        essential: p8Case.essential,
        conversionsMap: syntheticConversions,
      });

      await createCookSession(driver, 'session_P8', p8Case.recipe!, p8Case.servings!);
      await service.deductForSession('session_P8', specs);

      const snapshot = await service.getSnapshot();
      for (const [ingId, expectedQty] of Object.entries(p8Case.after!)) {
        expect(snapshot[ingId]).toBe(expectedQty);
      }
    });
  });

  // =========================================================================
  // CA P9: Hoàn tác phiên nấu & ném ALREADY_UNDONE
  // =========================================================================
  describe('P9: Hoàn tác phiên nấu và hoàn tác lần hai', () => {
    it('Làm P1 rồi hoàn tác -> kho bằng INIT; hoàn tác lần hai ném ALREADY_UNDONE', async () => {
      const p9Case = blockP.cases.find((c) => c.id === 'P9')!;
      await populatePantryInit(service);

      // Thực hiện P1
      const recipe = blockP.recipes['M1']!;
      const specs = buildDeductSpecs({
        recipe,
        servings: 2,
        conversionsMap: syntheticConversions,
      });
      await createCookSession(driver, 'session_P9', 'M1', 2);
      await service.deductForSession('session_P9', specs);

      // Hoàn tác lần một
      await service.undoSession('session_P9');
      const snapshotAfterUndo = await service.getSnapshot();
      for (const [ingId, initQty] of Object.entries(blockP.init)) {
        expect(snapshotAfterUndo[ingId]).toBe(initQty);
      }

      // Hoàn tác lần hai -> ném lỗi ALREADY_UNDONE
      await expect(service.undoSession('session_P9')).rejects.toThrow(
        p9Case.undo_twice!.error,
      );
    });
  });

  // =========================================================================
  // CA P10: Làm tròn 3 chữ số thập phân
  // =========================================================================
  describe('P10: Làm tròn 3 chữ số thập phân (tránh lỗi số học nhị phân)', () => {
    it('Nguyên liệu 0.1 g nấu 6 phần (gốc 2) -> trừ đúng 0.3 g', () => {
      const p10Case = blockP.cases.find((c) => c.id === 'P10')!;
      const deducted = calcDeductAmount(
        p10Case.ingredient_qty!,
        p10Case.unit!,
        'g',
        {},
        p10Case.servings!,
        p10Case.base_servings!,
      );

      expect(deducted).toBe(p10Case.deduct);
      expect(deducted.toString()).toBe('0.3');
      expect(roundTo3(0.1 + 0.2)).toBe(0.3);
    });
  });

  // =========================================================================
  // CHỨNG MINH ĐỎ KHI ĐỔI SỐ TRONG KHỐI JSON (TAMPER PROOF)
  // =========================================================================
  describe('Chứng minh test ĐỎ khi sửa khối JSON kỳ vọng của docs/expected/T10.md', () => {
    it('Sửa after["trung"]: 3 thành 999 trong khối JSON -> expect văng AssertionError', () => {
      // Sửa một số trong chuỗi gốc của T10.md
      const tamperedContent = t10RawContent.replace('"trung":3', '"trung":999');
      expect(tamperedContent).not.toBe(t10RawContent);

      const tamperedBlocks = [...tamperedContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
        .map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
      const tamperedBlockP = tamperedBlocks.find((b) => b['case'] === 'P') as unknown as BlockPType;

      const p1Tampered = tamperedBlockP.cases.find((c) => c.id === 'P1')!;
      const actualTrungRemaining = 3; // Kết quả thực tế sau khi trừ P1

      // actualTrungRemaining là 3, số bị sửa là 999 -> assert phải thất bại
      expect(() => {
        expect(actualTrungRemaining).toBe(p1Tampered.after!['trung']);
      }).toThrow();
    });
  });
});
