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
  breakdown: {
    phu: number;
    capBach: number;
    thoiGian: number;
    moi: number;
  };
  estimatedCostRange?: {
    min: number;
    max: number;
  };
}

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
  }): ScoredRecipe[] {
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

    // Bước 2: Chấm điểm từng món vượt qua bộ lọc
    const scoredList: ScoredRecipe[] = [];

    for (const recipe of passedRecipes) {
      if (mode === 'estimation') {
        // Chế độ ước chừng (T12.3) – Đề xuất chờ duyệt
        const scored = this.scoreEstimationMode(recipe, profile, cookHistory);
        scoredList.push(scored);
      } else {
        // Chế độ chuẩn (T12.2) – Bám đúng công thức T10.md
        const scored = this.scoreStandardMode(
          recipe,
          profile,
          normalizedPantry,
          cookHistory,
          conversionsMap,
        );
        scoredList.push(scored);
      }
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

    return scoredList;
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
  // CHẾ ĐỘ ƯỚC CHỪNG (ESTIMATION MODE - T12.3)
  // ─────────────────────────────────────────

  /**
   * Chế độ ước chừng (khi kho trống hoặc người dùng muốn đi chợ mua đồ):
   * ĐỀ XUẤT CÔNG THỨC (CHỜ DUYỆT, KHÔNG TỰ QUYẾT THEO R4):
   *   - Bỏ thành phần "phủ" (vì kho đang trống).
   *   - Chi phí ước tính tính theo giá tham khảo của các nguyên liệu trong công thức.
   *   - Hiển thị khoảng giá ±20% [cost * 0.8, cost * 1.2] theo đúng T12.3.
   *   - Điểm đề xuất: ưu tiên món mới và thời gian chuẩn bị ngắn.
   */
  private scoreEstimationMode(
    recipe: SuggestRecipeInput,
    profile: SuggestUserProfile,
    cookHistory: Record<string, number>,
  ): ScoredRecipe {
    let totalCost = 0;
    const scale = profile.servings / recipe.servings_base;

    for (const ing of recipe.ingredients) {
      if (ing.referencePrice) {
        totalCost += ing.referencePrice * scale;
      }
    }

    const cookCount = cookHistory[recipe.id] ?? cookHistory[recipe.slug] ?? 0;
    const moi = cookCount === 0 ? 1.0 : 0.0;
    const thoiGian = 1.0;

    // Đề xuất công thức điểm ước chừng: 0.6 thời gian + 0.4 mới
    const score = roundTo4(0.6 * thoiGian + 0.4 * moi);

    return {
      id: recipe.id,
      recipeId: recipe.id,
      slug: recipe.slug,
      score,
      breakdown: {
        phu: 0,
        capBach: 0,
        thoiGian,
        moi,
      },
      estimatedCostRange: {
        min: Math.round(totalCost * 0.8),
        max: Math.round(totalCost * 1.2),
      },
    };
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
