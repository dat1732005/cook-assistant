/**
 * File: packages/core/src/__tests__/suggest-service.test.ts
 * Module: @cook/core
 *
 * Kiểm thử toàn diện SuggestService đọc kỳ vọng trực tiếp từ khối JSON Ca K trong docs/expected/T10.md.
 * Bao gồm các ca kiểm thử K1, K4, K5, K6, chế độ ước chừng (T12.3),
 * và 1 test chứng minh đỏ khi đổi một số trong khối JSON.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SuggestService,
  SuggestRecipeInput,
  UnitConversionMap,
} from '../suggest/suggest-service.js';
import { RAW_WEIGHTS, SUGGEST_WEIGHTS, MVP_NORMALIZATION_FACTOR } from '../suggest/weights-config.js';

// ==========================================
// ĐỌC KỲ VỌNG TRỰC TIẾP TỪ docs/expected/T10.md & T12.md
// ==========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const expectedFilePath = path.resolve(__dirname, '../../../../docs/expected/T10.md');
const t10RawContent = fs.readFileSync(expectedFilePath, 'utf-8');

const jsonBlocks = [...t10RawContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
  .map((m) => (m && m[1] ? (JSON.parse(m[1]) as Record<string, unknown>) : null))
  .filter((b): b is Record<string, unknown> => b !== null);

const t12FilePath = path.resolve(__dirname, '../../../../docs/expected/T12.md');
const t12RawContent = fs.readFileSync(t12FilePath, 'utf-8');
const t12Blocks = [...t12RawContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
  .map((m) => (m && m[1] ? (JSON.parse(m[1]) as Record<string, unknown>) : null))
  .filter((b): b is Record<string, unknown> => b !== null);

interface BlockKType {
  case: 'K';
  pantry: Record<string, { qty: number; expires_day: number | null } | number>;
  history: Record<string, number>;
  profile: {
    servings: number;
    equipment: string[];
    allergies: string[];
  };
  equipment: Record<string, string[]>;
  cases: Array<{
    id: string;
    ranking: Array<{ recipe: string; score: number }> | string[];
    tolerance?: number;
    allergies?: string[];
    equipment?: string[];
    extra?: string;
    note?: string;
  }>;
}

interface BlockPType {
  case: 'P';
  recipes: Record<
    string,
    {
      servings_base: number;
      ingredients: Array<{
        i: string;
        qty: number;
        unit: string;
        optional?: boolean;
      }>;
    }
  >;
}

interface BlockEType {
  case: 'E';
  prices: Record<string, number>;
  history: Record<string, number>;
  cases: Array<{
    id: string;
    ranking:
      | Array<{ recipe: string; score: number; cost: number; range: [number, number] }>
      | string[];
    tolerance?: number;
    missing_price?: string[];
    unpriced?: string[];
    cost_scores?: Record<string, number>;
    allergies?: string[];
  }>;
}

const blockK = jsonBlocks.find((b) => b['case'] === 'K') as unknown as BlockKType;
const blockP = jsonBlocks.find((b) => b['case'] === 'P') as unknown as BlockPType;
const blockE = t12Blocks.find((b) => b['case'] === 'E') as unknown as BlockEType;

if (!blockK || !blockP || !blockE) {
  throw new Error('Không tìm thấy khối JSON Ca K, Ca P trong T10.md hoặc Ca E trong T12.md');
}

// Bảng quy đổi giả định theo T10.md
const syntheticConversions: UnitConversionMap = {
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

// Khai báo rõ ràng mã dị ứng cho dữ liệu giả định
const syntheticAllergenMap: Record<string, string[]> = {
  trung: ['egg'],
  'ca-chua': [],
  duong: [],
  muoi: [],
  toi: [],
  'hanh-la': [],
  'nuoc-mam': [],
  'dau-an': [],
  'rau-muong': [],
  'thit-ba-chi': [],
};

// Mã slug chuẩn theo T10.md
const recipeSlugs: Record<string, string> = {
  M1: 'mon-1',
  M2: 'mon-2',
  M3: 'mon-3',
};

/**
 * Tạo danh sách SuggestRecipeInput từ khối blockP và blockK.
 */
function createSyntheticRecipes(): SuggestRecipeInput[] {
  return (['M1', 'M2', 'M3'] as const).map((key) => {
    const raw = blockP.recipes[key]!;
    return {
      id: key,
      slug: recipeSlugs[key] ?? key.toLowerCase(),
      name: `Món ${key}`,
      servings_base: raw.servings_base,
      total_minutes: 30,
      equipment: blockK.equipment[key] ?? [],
      ingredients: raw.ingredients.map((ing) => ({
        ingredientId: ing.i,
        qty: ing.qty,
        unit: ing.unit,
        optional: ing.optional ?? false,
        allergen_codes: syntheticAllergenMap[ing.i] ?? [],
        referencePrice: 20000,
      })),
    };
  });
}

describe('T12: SuggestService & Trọng số gợi ý món (đối chiếu docs/expected/T10.md - Ca K)', () => {
  const suggestService = new SuggestService();

  // =========================================================================
  // KIỂM TRA TRỌNG SỐ CẤU HÌNH (WEIGHTS CONFIG)
  // =========================================================================
  describe('Cấu hình trọng số (weights-config.ts)', () => {
    it('Trọng số thô có tổng đúng 1.0 và ghi chú rõ chưa kiểm chứng', () => {
      const sum =
        RAW_WEIGHTS.phu +
        RAW_WEIGHTS.capBach +
        RAW_WEIGHTS.thoiGian +
        RAW_WEIGHTS.khauVi +
        RAW_WEIGHTS.moi;
      expect(sum).toBeCloseTo(1.0, 5);
      expect(RAW_WEIGHTS.phu).toBe(0.5);
      expect(RAW_WEIGHTS.capBach).toBe(0.2);
      expect(RAW_WEIGHTS.thoiGian).toBe(0.15);
      expect(RAW_WEIGHTS.khauVi).toBe(0.1);
      expect(RAW_WEIGHTS.moi).toBe(0.05);
    });

    it('Trọng số MVP chuẩn hóa chia cho 0.9 (bỏ khẩu vị)', () => {
      expect(MVP_NORMALIZATION_FACTOR).toBe(0.9);
      expect(SUGGEST_WEIGHTS.phu).toBeCloseTo(0.5 / 0.9, 4);
      expect(SUGGEST_WEIGHTS.capBach).toBeCloseTo(0.2 / 0.9, 4);
      expect(SUGGEST_WEIGHTS.thoiGian).toBeCloseTo(0.15 / 0.9, 4);
      expect(SUGGEST_WEIGHTS.moi).toBeCloseTo(0.05 / 0.9, 4);
    });
  });

  // =========================================================================
  // CA K1: Xếp hạng chuẩn theo kho và điểm
  // =========================================================================
  describe('Ca K1: Xếp hạng món theo điểm chuẩn hóa', () => {
    it('K1: Kho K1 -> thứ tự M1 (0.9444), M2 (0.7778), M3 (0.6389) sai số 0.0001', () => {
      const k1Case = blockK.cases.find((c) => c.id === 'K1')!;
      const recipes = createSyntheticRecipes();

      // Chuẩn hóa kho K1 từ JSON
      const pantryInput: Record<string, { totalQuantity: number; earliestExpiryDay?: number | null }> = {};
      for (const [ingId, val] of Object.entries(blockK.pantry)) {
        if (typeof val === 'number') {
          pantryInput[ingId] = { totalQuantity: val, earliestExpiryDay: null };
        } else {
          pantryInput[ingId] = { totalQuantity: val.qty, earliestExpiryDay: val.expires_day };
        }
      }

      const results = suggestService.suggest({
        recipes,
        profile: {
          servings: blockK.profile.servings,
          equipment: blockK.profile.equipment,
          allergies: blockK.profile.allergies,
        },
        pantry: pantryInput,
        cookHistory: blockK.history,
        conversionsMap: syntheticConversions,
      });

      const expectedRankings = k1Case.ranking as Array<{ recipe: string; score: number }>;
      expect(results.length).toBe(expectedRankings.length);

      for (let i = 0; i < expectedRankings.length; i++) {
        const exp = expectedRankings[i]!;
        const act = results[i]!;
        expect(act.recipeId).toBe(exp.recipe);
        expect(Math.abs(act.score - exp.score)).toBeLessThanOrEqual(k1Case.tolerance ?? 0.0001);
      }
    });
  });

  // =========================================================================
  // CA K4: Bộ lọc cứng theo dị ứng
  // =========================================================================
  describe('Ca K4: Lọc dị ứng', () => {
    it('K4: Khai dị ứng trứng allergies = ["egg"] -> loại M1 và M3, chỉ còn M2', () => {
      const k4Case = blockK.cases.find((c) => c.id === 'K4')!;
      const recipes = createSyntheticRecipes();

      const pantryInput: Record<string, { totalQuantity: number; earliestExpiryDay?: number | null }> = {};
      for (const [ingId, val] of Object.entries(blockK.pantry)) {
        if (typeof val === 'number') {
          pantryInput[ingId] = { totalQuantity: val, earliestExpiryDay: null };
        } else {
          pantryInput[ingId] = { totalQuantity: val.qty, earliestExpiryDay: val.expires_day };
        }
      }

      const results = suggestService.suggest({
        recipes,
        profile: {
          servings: blockK.profile.servings,
          equipment: blockK.profile.equipment,
          allergies: k4Case.allergies!,
        },
        pantry: pantryInput,
        cookHistory: blockK.history,
        conversionsMap: syntheticConversions,
      });

      const expectedRankings = k4Case.ranking as string[];
      expect(results.map((r) => r.recipeId)).toEqual(expectedRankings);
    });
  });

  // =========================================================================
  // CA K5: Bộ lọc cứng theo dụng cụ
  // =========================================================================
  describe('Ca K5: Lọc dụng cụ', () => {
    it('K5: Dụng cụ chỉ có ["chao"] -> M2 thiếu noi, M3 thiếu noi, chỉ còn M1', () => {
      const k5Case = blockK.cases.find((c) => c.id === 'K5')!;
      const recipes = createSyntheticRecipes();

      const pantryInput: Record<string, { totalQuantity: number; earliestExpiryDay?: number | null }> = {};
      for (const [ingId, val] of Object.entries(blockK.pantry)) {
        if (typeof val === 'number') {
          pantryInput[ingId] = { totalQuantity: val, earliestExpiryDay: null };
        } else {
          pantryInput[ingId] = { totalQuantity: val.qty, earliestExpiryDay: val.expires_day };
        }
      }

      const results = suggestService.suggest({
        recipes,
        profile: {
          servings: blockK.profile.servings,
          equipment: k5Case.equipment!,
          allergies: blockK.profile.allergies,
        },
        pantry: pantryInput,
        cookHistory: blockK.history,
        conversionsMap: syntheticConversions,
      });

      const expectedRankings = k5Case.ranking as string[];
      expect(results.map((r) => r.recipeId)).toEqual(expectedRankings);
    });
  });

  // =========================================================================
  // CA K6: Hòa điểm sắp theo slug tăng dần
  // =========================================================================
  describe('Ca K6: Hòa điểm sắp theo slug tăng dần', () => {
    it('K6: Thêm mon-2b giống hệt M2 (mon-2) -> mon-2 xếp trước mon-2b theo thứ tự slug', () => {
      const k6Case = blockK.cases.find((c) => c.id === 'K6')!;
      const recipes = createSyntheticRecipes();

      // Thêm bản sao mon-2b của M2
      const m2 = recipes.find((r) => r.id === 'M2')!;
      const mon2b: SuggestRecipeInput = {
        ...m2,
        id: 'mon-2b',
        slug: 'mon-2b',
        name: 'Món 2b (Bản sao)',
      };
      recipes.push(mon2b);

      const pantryInput: Record<string, { totalQuantity: number; earliestExpiryDay?: number | null }> = {};
      for (const [ingId, val] of Object.entries(blockK.pantry)) {
        if (typeof val === 'number') {
          pantryInput[ingId] = { totalQuantity: val, earliestExpiryDay: null };
        } else {
          pantryInput[ingId] = { totalQuantity: val.qty, earliestExpiryDay: val.expires_day };
        }
      }

      const results = suggestService.suggest({
        recipes,
        profile: {
          servings: blockK.profile.servings,
          equipment: blockK.profile.equipment,
          allergies: blockK.profile.allergies,
        },
        pantry: pantryInput,
        cookHistory: blockK.history,
        conversionsMap: syntheticConversions,
      });

      const expectedOrder = k6Case.ranking as string[];
      expect(results.map((r) => r.id ?? r.recipeId)).toEqual(expectedOrder);
    });
  });

  // =========================================
  // CHẾ ĐỘ ƯỚC CHỪNG (ESTIMATION MODE - T12 BỔ SUNG - CA E)
  // =========================================
  describe('Chế độ ước chừng (T12 bổ sung bám docs/expected/T12.md - Ca E)', () => {
    function createRecipesWithPrices(
      overridePrices?: Record<string, number | null>,
    ): SuggestRecipeInput[] {
      return (['M1', 'M2', 'M3'] as const).map((key) => {
        const raw = blockP.recipes[key]!;
        return {
          id: key,
          slug: recipeSlugs[key] ?? key.toLowerCase(),
          name: `Món ${key}`,
          servings_base: raw.servings_base,
          total_minutes: 30,
          equipment: blockK.equipment[key] ?? [],
          ingredients: raw.ingredients.map((ing) => {
            let price: number | null = blockE.prices[ing.i] ?? null;
            if (overridePrices && ing.i in overridePrices) {
              price = overridePrices[ing.i] ?? null;
            }
            return {
              ingredientId: ing.i,
              qty: ing.qty,
              unit: ing.unit,
              optional: ing.optional ?? false,
              allergen_codes: syntheticAllergenMap[ing.i] ?? [],
              referencePrice: price,
            };
          }),
        };
      });
    }

    it('E1: Ba món, kho trống, giá đầy đủ -> thứ tự M2 (0.7778), M1 (0.6181), M3 (0.2222) và khoảng chi phí ±20%', () => {
      const e1Case = blockE.cases.find((c) => c.id === 'E1')!;
      const recipes = createRecipesWithPrices();

      const results = suggestService.suggest({
        recipes,
        profile: {
          servings: 2,
          equipment: ['chao', 'noi'],
          allergies: [],
        },
        pantry: {}, // Kho trống
        cookHistory: blockE.history,
        conversionsMap: syntheticConversions,
        mode: 'estimation',
      });

      const expectedRankings = e1Case.ranking as Array<{
        recipe: string;
        score: number;
        cost: number;
        range: [number, number];
      }>;

      expect(results.length).toBe(expectedRankings.length);

      for (let i = 0; i < expectedRankings.length; i++) {
        const exp = expectedRankings[i]!;
        const act = results[i]!;
        expect(act.recipeId).toBe(exp.recipe);
        expect(Math.abs(act.score - exp.score)).toBeLessThanOrEqual(e1Case.tolerance ?? 0.0001);
        expect(act.cost).toBe(exp.cost);
        expect(act.range).toEqual(exp.range);
        expect(act.estimatedCostRange).toEqual({ min: exp.range[0], max: exp.range[1] });
      }
    });

    it('E2: Thịt ba chỉ chưa có giá -> M3 không xếp hạng, nằm trong unpriced; xếp hạng còn M2, M1; điểm chi phí chuẩn hóa lại M2=1, M1=0', () => {
      const e2Case = blockE.cases.find((c) => c.id === 'E2')!;
      const overridePrices: Record<string, number | null> = {};
      for (const ing of e2Case.missing_price ?? []) {
        overridePrices[ing] = null;
      }

      const recipes = createRecipesWithPrices(overridePrices);

      const results = suggestService.suggest({
        recipes,
        profile: {
          servings: 2,
          equipment: ['chao', 'noi'],
          allergies: [],
        },
        pantry: {},
        cookHistory: blockE.history,
        conversionsMap: syntheticConversions,
        mode: 'estimation',
      });

      expect(results.map((r) => r.recipeId)).toEqual(e2Case.ranking);
      expect(results.unpriced).toEqual(e2Case.unpriced);

      if (e2Case.cost_scores) {
        for (const [rId, expectedDiemChiPhi] of Object.entries(e2Case.cost_scores)) {
          const found = results.find((r) => r.recipeId === rId);
          expect(found?.breakdown.diemChiPhi).toBe(expectedDiemChiPhi);
        }
      }
    });

    it('E3: Người dùng khai dị ứng trứng -> M1 và M3 bị loại, chỉ còn M2 với điểm_chi_phí = 1', () => {
      const e3Case = blockE.cases.find((c) => c.id === 'E3')!;
      const recipes = createRecipesWithPrices();

      const results = suggestService.suggest({
        recipes,
        profile: {
          servings: 2,
          equipment: ['chao', 'noi'],
          allergies: e3Case.allergies ?? [],
        },
        pantry: {},
        cookHistory: blockE.history,
        conversionsMap: syntheticConversions,
        mode: 'estimation',
      });

      expect(results.map((r) => r.recipeId)).toEqual(e3Case.ranking);
      expect(results[0]?.breakdown.diemChiPhi).toBe(1);
    });
  });

  // =========================================================================
  // CHỨNG MINH ĐỎ KHI ĐỔI SỐ TRONG KHỐI JSON (TAMPER PROOF)
  // =========================================================================
  describe('Chứng minh test ĐỎ khi sửa khối JSON kỳ vọng của docs/expected/T10.md & T12.md', () => {
    it('Sửa score M1 từ 0.9444 thành 0.1111 trong T10.md -> expect văng AssertionError', () => {
      const tamperedContent = t10RawContent.replace('"score":0.9444', '"score":0.1111');
      expect(tamperedContent).not.toBe(t10RawContent);

      const tamperedBlocks = [...tamperedContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
        .map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
      const tamperedBlockK = tamperedBlocks.find((b) => b['case'] === 'K') as unknown as BlockKType;

      const k1Tampered = tamperedBlockK.cases.find((c) => c.id === 'K1')!;
      const expTamperedRankings = k1Tampered.ranking as Array<{ recipe: string; score: number }>;
      const actualScoreM1 = 0.9444;

      expect(() => {
        expect(Math.abs(actualScoreM1 - expTamperedRankings[0]!.score)).toBeLessThanOrEqual(0.0001);
      }).toThrow();
    });

    it('Sửa score M2 trong E1 từ 0.7778 thành 0.9999 trong T12.md -> expect văng AssertionError', () => {
      const tamperedContent = t12RawContent.replace('"score":0.7778', '"score":0.9999');
      expect(tamperedContent).not.toBe(t12RawContent);

      const tamperedBlocks = [...tamperedContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
        .map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
      const tamperedBlockE = tamperedBlocks.find((b) => b['case'] === 'E') as unknown as BlockEType;

      const e1Tampered = tamperedBlockE.cases.find((c) => c.id === 'E1')!;
      const expTamperedRankings = e1Tampered.ranking as Array<{ recipe: string; score: number }>;
      const actualScoreM2 = 0.7778;

      expect(() => {
        expect(Math.abs(actualScoreM2 - expTamperedRankings[0]!.score)).toBeLessThanOrEqual(0.0001);
      }).toThrow();
    });
  });
});
