/**
 * File: packages/core/src/suggest/suggest-service.ts
 * Module: @cook/core
 *
 * Dịch vụ gợi ý món ăn (SuggestService) (T12).
 * Thực hiện:
 *   1. Bộ lọc cứng (Hard filter): dị ứng, dụng cụ, thời gian.
 *   2. Chấm điểm theo trọng số cấu hình: 0.5·phủ + 0.2·cấp_bách + 0.15·thời_gian + 0.05·mới (chia 0.9 ở MVP).
 *   3. Sắp xếp thứ tự ưu tiên, hòa điểm xếp theo slug tăng dần.
 *   4. Chế độ ước chừng (Estimation mode): đề xuất công thức chi phí ±20%, chờ duyệt.
 *
 * Bám theo: docs/expected/T10.md mục "Gợi ý món (T12)", docs/tasks.md mục T12.
 */

import {
  RAW_WEIGHTS,
  MVP_NORMALIZATION_FACTOR,
  URGENT_EXPIRY_DAYS,
  SCORE_TOLERANCE,
} from './weights-config.js';
import { calcDeductAmount } from '../db/pantry-service.js';

/**
 * Thông tin một nguyên liệu trong kho phục vụ tính điểm gợi ý.
 */
export interface PantryItemSummary {
  ingredientId?: string;
  totalQuantity: number;
  /** Số ngày tính từ hôm nay tới ngày hết hạn gần nhất (null nếu không có hạn). */
  earliestExpiryDay?: number | null;
}

/**
 * Hồ sơ người dùng cần cho việc lọc và chấm điểm.
 */
export interface SuggestUserProfile {
  servings: number;
  equipment: string[];
  allergies: string[];
  essentialSpices?: string[];
  maxMinutes?: number;
}

/**
 * Dữ liệu món ăn đầu vào cho bộ gợi ý.
 */
export interface SuggestRecipeInput {
  id: string;
  slug: string;
  name: string;
  servings_base: number;
  total_minutes: number;
  equipment: string[];
  ingredients: Array<{
    ingredientId: string;
    qty: number;
    unit: string;
    optional?: boolean;
    allergen_codes?: string[] | null;
    referencePrice?: number | null;
  }>;
}

/**
 * Kết quả chấm điểm một món ăn.
 */
export interface ScoredRecipe {
  id?: string;
  recipeId: string;
  slug: string;
  score: number;
  cost?: number;
  range?: [number, number];
  breakdown: {
    phu: number;
    capBach: number;
    thoiGian: number;
    moi: number;
    diemChiPhi?: number;
  };
  estimatedCost?: number;
  estimatedCostRange?: {
    min: number;
    max: number;
  };
}

export type SuggestResult = ScoredRecipe[] & {
  unpriced?: string[];
  unpricedRecipes?: string[];
};

/**
 * Cấu hình quy đổi đơn vị của nguyên liệu.
 */
export type UnitConversionMap = Record<
  string,
  { baseUnit: 'g' | 'ml' | 'cái'; conversions?: Record<string, number> }
>;

/**
 * Dịch vụ gợi ý món ăn thông minh.
 */
export class SuggestService {
  /**
   * Gợi ý danh sách món ăn đã xếp hạng theo điểm từ cao xuống thấp (T12).
   *
   * Vào:
   *   - recipes: danh sách các món ăn ứng viên.
   *   - profile: hồ sơ người dùng (khẩu vị, dị ứng, dụng cụ, thời gian).
   *   - pantry: trạng thái kho nguyên liệu hiện tại (tổng lượng và hạn dùng).
   *   - cookHistory: lịch sử nấu (recipeId hoặc slug -> số lần đã nấu).
   *   - conversionsMap: bản đồ quy đổi đơn vị của nguyên liệu.
   *   - mode: 'standard' (chuẩn MVP) hoặc 'estimation' (chế độ ước chừng).
   * Ra: Mảng ScoredRecipe[] đã lọc cứng và xếp hạng theo điểm giảm dần (hòa điểm theo slug tăng dần).
   */
  suggest(params: {
    recipes: SuggestRecipeInput[];
    profile: SuggestUserProfile;
    pantry: Record<string, PantryItemSummary | number>;
    cookHistory?: Record<string, number>;
    conversionsMap: UnitConversionMap;
    mode?: 'standard' | 'estimation';
  }): SuggestResult {
    const {
      recipes,
      profile,
      pantry,
      cookHistory = {},
      conversionsMap,
      mode = 'standard',
    } = params;

    // Chuẩn hóa dữ liệu kho
    const normalizedPantry = this.normalizePantry(pantry);

    // Bước 1: Bộ lọc cứng (Hard filter - T12.1)
    const passedRecipes = recipes.filter((recipe) =>
      this.passesHardFilter(recipe, profile),
    );

    // Nếu ở chế độ ước chừng (T12 bổ sung)
    if (mode === 'estimation') {
      return this.runEstimationMode(
        passedRecipes,
        profile,
        normalizedPantry,
        cookHistory,
        conversionsMap,
      );
    }

    // Bước 2: Chấm điểm từng món vượt qua bộ lọc (Chế độ chuẩn - T12.2)
    const scoredList: ScoredRecipe[] = [];

    for (const recipe of passedRecipes) {
      const scored = this.scoreStandardMode(
        recipe,
        profile,
        normalizedPantry,
        cookHistory,
        conversionsMap,
      );
      scoredList.push(scored);
    }

    // Bước 3: Sắp xếp kết quả (Điểm giảm dần; nếu hòa điểm thì theo slug tăng dần)
    scoredList.sort((a, b) => {
      // So sánh điểm với sai số cho phép SCORE_TOLERANCE
      const diff = b.score - a.score;
      if (Math.abs(diff) > SCORE_TOLERANCE) {
        return diff;
      }
      // Hòa điểm: sắp theo slug tiếng Anh tăng dần (A -> Z)
      return a.slug.localeCompare(b.slug);
    });

    const result = scoredList as SuggestResult;
    result.unpriced = [];
    result.unpricedRecipes = [];
    return result;
  }

  // ─────────────────────────────────────────
  // BỘ LỌC CỨNG (HARD FILTER - T12.1)
  // ─────────────────────────────────────────

  /**
   * Kiểm tra một món ăn có vượt qua bộ lọc cứng hay không.
   * Loại bỏ nếu:
   *   1. Món có nguyên liệu chứa mã dị ứng của người dùng.
   *   2. Món cần dụng cụ mà người dùng không có.
   *   3. Món vượt quá thời gian tối đa người dùng yêu cầu.
   */
  passesHardFilter(recipe: SuggestRecipeInput, profile: SuggestUserProfile): boolean {
    // 1. Kiểm tra dị ứng (bắt buộc loại ngay theo quy tắc an toàn)
    if (profile.allergies.length > 0) {
      const userAllergySet = new Set(profile.allergies);
      for (const ing of recipe.ingredients) {
        if (ing.allergen_codes && ing.allergen_codes.length > 0) {
          for (const code of ing.allergen_codes) {
            if (userAllergySet.has(code)) {
              return false; // Món chứa chất gây dị ứng cho người dùng
            }
          }
        }
      }
    }

    // 2. Kiểm tra dụng cụ nấu (chỉ cho phép món mà người dùng có đủ dụng cụ)
    if (recipe.equipment && recipe.equipment.length > 0) {
      const userEquipSet = new Set(profile.equipment);
      for (const eq of recipe.equipment) {
        if (!userEquipSet.has(eq)) {
          return false; // Thiếu dụng cụ cần thiết
        }
      }
    }

    // 3. Kiểm tra giới hạn thời gian (nếu có)
    if (profile.maxMinutes !== undefined && profile.maxMinutes !== null) {
      if (recipe.total_minutes > profile.maxMinutes) {
        return false; // Quá thời gian cho phép
      }
    }

    return true;
  }

  // ─────────────────────────────────────────
  // CHẤM ĐIỂM CHẾ ĐỘ CHUẨN (STANDARD MODE)
  // ─────────────────────────────────────────

  /**
   * Chấm điểm món ăn theo công thức chuẩn của T10.md:
   * Điểm = (0.5·phủ + 0.2·cấp_bách + 0.15·thời_gian + 0.05·mới) / 0.9.
   */
  private scoreStandardMode(
    recipe: SuggestRecipeInput,
    profile: SuggestUserProfile,
    pantry: Record<string, PantryItemSummary>,
    cookHistory: Record<string, number>,
    conversionsMap: UnitConversionMap,
  ): ScoredRecipe {
    const essentialSet = new Set(profile.essentialSpices ?? []);

    // 1. Thành phần "phủ":
    // Số nguyên liệu bắt buộc (không optional, không essential) mà kho đủ lượng / tổng số nguyên liệu bắt buộc
    let mandatoryCount = 0;
    let sufficientCount = 0;
    let hasUrgentExpiring = false;

    for (const ing of recipe.ingredients) {
      // Bỏ qua nguyên liệu tùy chọn (optional)
      if (ing.optional) {
        continue;
      }
      // Bỏ qua gia vị khai "luôn có sẵn" (essential)
      if (essentialSet.has(ing.ingredientId)) {
        continue;
      }

      mandatoryCount++;

      // Tính lượng cần theo khẩu phần
      const convInfo = conversionsMap[ing.ingredientId];
      if (!convInfo) {
        throw new Error(`Thiếu quy đổi cho nguyên liệu: ${ing.ingredientId}`);
      }

      const neededAmount = calcDeductAmount(
        ing.qty,
        ing.unit,
        convInfo.baseUnit,
        convInfo.conversions,
        profile.servings,
        recipe.servings_base,
      );

      // Lấy lượng hiện có trong kho
      const pantryItem = pantry[ing.ingredientId];
      const availableQty = pantryItem?.totalQuantity ?? 0;

      if (availableQty >= neededAmount) {
        sufficientCount++;
      }

      // Kiểm tra thành phần "cấp bách":
      // Bằng 1 nếu món dùng nguyên liệu bắt buộc có lô hết hạn trong vòng 2 ngày (hôm nay là ngày 0)
      if (
        pantryItem?.earliestExpiryDay !== undefined &&
        pantryItem.earliestExpiryDay !== null &&
        pantryItem.earliestExpiryDay <= URGENT_EXPIRY_DAYS
      ) {
        hasUrgentExpiring = true;
      }
    }

    const phu = mandatoryCount > 0 ? sufficientCount / mandatoryCount : 1.0;
    const capBach = hasUrgentExpiring ? 1.0 : 0.0;
    const thoiGian = 1.0; // Đã vượt qua bộ lọc cứng nên luôn = 1

    // Thành phần "mới": bằng 1 nếu chưa từng nấu, ngược lại bằng 0
    const cookCount = cookHistory[recipe.id] ?? cookHistory[recipe.slug] ?? 0;
    const moi = cookCount === 0 ? 1.0 : 0.0;

    // Tính điểm tổng theo trọng số và chia 0.9 (chuẩn hóa MVP)
    const rawTotal =
      RAW_WEIGHTS.phu * phu +
      RAW_WEIGHTS.capBach * capBach +
      RAW_WEIGHTS.thoiGian * thoiGian +
      RAW_WEIGHTS.moi * moi;

    const finalScore = roundTo4(rawTotal / MVP_NORMALIZATION_FACTOR);

    return {
      id: recipe.id,
      recipeId: recipe.id,
      slug: recipe.slug,
      score: finalScore,
      breakdown: {
        phu,
        capBach,
        thoiGian,
        moi,
      },
    };
  }

  // ─────────────────────────────────────────
  // CHẾ ĐỘ ƯỚC CHỪNG (ESTIMATION MODE - T12 BỔ SUNG)
  // ─────────────────────────────────────────

  /**
   * Chế độ ước chừng (T12 bổ sung bám đúng docs/expected/T12.md).
   *
   * Quy tắc đã chốt (không thêm tham số mới):
   *   1. Chi phí món = tổng (lượng quy về đơn vị gốc × giá theo đơn vị gốc) của các nguyên liệu bắt buộc, theo số người ăn.
   *      Nguyên liệu tùy chọn không tính.
   *   2. Món có nguyên liệu bắt buộc chưa có giá không được xếp hạng, đưa vào danh sách riêng "chưa có giá" (unpriced).
   *      Không dùng giá mặc định.
   *   3. điểm_chi_phí chuẩn hóa trong danh sách món đang xét:
   *      (chi_phí_cao_nhất − chi_phí_món) / (chi_phí_cao_nhất − chi_phí_thấp_nhất).
   *      Nếu mọi món cùng chi phí (hoặc chỉ có 1 món) thì bằng 1.
   *   4. điểm = (0,5·điểm_chi_phí + 0,2·cấp_bách + 0,15·thời_gian + 0,05·mới) / 0,9.
   *   5. Hiển thị chi phí dạng khoảng ±20% (chi phí × 0,8 đến chi phí × 1,2).
   */
  private runEstimationMode(
    passedRecipes: SuggestRecipeInput[],
    profile: SuggestUserProfile,
    normalizedPantry: Record<string, PantryItemSummary>,
    cookHistory: Record<string, number>,
    conversionsMap: UnitConversionMap,
  ): SuggestResult {
    const unpriced: string[] = [];
    const pricedItems: Array<{
      recipe: SuggestRecipeInput;
      cost: number;
      range: [number, number];
      capBach: number;
      thoiGian: number;
      moi: number;
    }> = [];

    for (const recipe of passedRecipes) {
      let missingPrice = false;
      let totalCost = 0;

      for (const ing of recipe.ingredients) {
        if (ing.optional) {
          continue;
        }
        if (ing.referencePrice === null || ing.referencePrice === undefined) {
          missingPrice = true;
          break;
        }

        const convInfo = conversionsMap[ing.ingredientId];
        if (!convInfo) {
          throw new Error(`Thiếu quy đổi cho nguyên liệu: ${ing.ingredientId}`);
        }
        const baseAmount = calcDeductAmount(
          ing.qty,
          ing.unit,
          convInfo.baseUnit,
          convInfo.conversions,
          profile.servings,
          recipe.servings_base,
        );
        totalCost += baseAmount * ing.referencePrice;
      }

      if (missingPrice) {
        unpriced.push(recipe.id);
        continue;
      }

      // Thành phần cấp bách: có nguyên liệu bắt buộc có lô hết hạn trong vòng 2 ngày không
      let hasUrgent = false;
      for (const ing of recipe.ingredients) {
        if (ing.optional) continue;
        const p = normalizedPantry[ing.ingredientId];
        if (
          p?.earliestExpiryDay !== undefined &&
          p.earliestExpiryDay !== null &&
          p.earliestExpiryDay >= 0 &&
          p.earliestExpiryDay <= URGENT_EXPIRY_DAYS
        ) {
          hasUrgent = true;
          break;
        }
      }
      const capBach = hasUrgent ? 1.0 : 0.0;
      const thoiGian = 1.0;
      const cookCount = cookHistory[recipe.id] ?? cookHistory[recipe.slug] ?? 0;
      const moi = cookCount === 0 ? 1.0 : 0.0;

      const roundedCost = Math.round(totalCost);
      const minRange = Math.round(roundedCost * 0.8);
      const maxRange = Math.round(roundedCost * 1.2);

      pricedItems.push({
        recipe,
        cost: roundedCost,
        range: [minRange, maxRange],
        capBach,
        thoiGian,
        moi,
      });
    }

    const costs = pricedItems.map((p) => p.cost);
    const maxCost = costs.length > 0 ? Math.max(...costs) : 0;
    const minCost = costs.length > 0 ? Math.min(...costs) : 0;

    const scoredList: ScoredRecipe[] = [];

    for (const item of pricedItems) {
      const diemChiPhi =
        maxCost === minCost
          ? 1.0
          : (maxCost - item.cost) / (maxCost - minCost);

      const rawTotal =
        RAW_WEIGHTS.phu * diemChiPhi +
        RAW_WEIGHTS.capBach * item.capBach +
        RAW_WEIGHTS.thoiGian * item.thoiGian +
        RAW_WEIGHTS.moi * item.moi;

      const finalScore = roundTo4(rawTotal / MVP_NORMALIZATION_FACTOR);

      scoredList.push({
        id: item.recipe.id,
        recipeId: item.recipe.id,
        slug: item.recipe.slug,
        score: finalScore,
        cost: item.cost,
        range: item.range,
        estimatedCost: item.cost,
        estimatedCostRange: {
          min: item.range[0],
          max: item.range[1],
        },
        breakdown: {
          phu: diemChiPhi,
          diemChiPhi: roundTo4(diemChiPhi),
          capBach: item.capBach,
          thoiGian: item.thoiGian,
          moi: item.moi,
        },
      });
    }

    scoredList.sort((a, b) => {
      const diff = b.score - a.score;
      if (Math.abs(diff) > SCORE_TOLERANCE) {
        return diff;
      }
      return a.slug.localeCompare(b.slug);
    });

    const result = scoredList as SuggestResult;
    result.unpriced = unpriced;
    result.unpricedRecipes = unpriced;
    return result;
  }

  // ─────────────────────────────────────────
  // HÀM TIỆN ÍCH NỘI BỘ
  // ─────────────────────────────────────────

  private normalizePantry(
    pantry: Record<string, PantryItemSummary | number>,
  ): Record<string, PantryItemSummary> {
    const result: Record<string, PantryItemSummary> = {};
    for (const [key, value] of Object.entries(pantry)) {
      if (typeof value === 'number') {
        result[key] = {
          ingredientId: key,
          totalQuantity: value,
          earliestExpiryDay: null,
        };
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

/**
 * Làm tròn đến 4 chữ số thập phân cho điểm số gợi ý món ăn.
 */
function roundTo4(val: number): number {
  return Math.round(val * 10000) / 10000;
}
