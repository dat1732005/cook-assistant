/**
 * File: packages/core/src/safety/safety-service.ts
 * Làm gì: Cung cấp các hàm kiểm tra an toàn thực phẩm (T16):
 *         - check(step): trả quy tắc an toàn hiển thị cho bước nấu, kèm nguồn.
 *         - allergyConflicts(recipe, profile): phát hiện xung đột dị ứng.
 *         - canStartRecipe(recipe): chặn bắt đầu món nếu quy tắc an toàn bị MISSING.
 *         - formatSafetyWarning(rule): định dạng cảnh báo luôn có tên nguồn và đường dẫn.
 * Nhận vào: Bước nấu (RecipeStep), Công thức (Recipe), Hồ sơ người dùng (UserProfile).
 * Trả ra: Quy tắc an toàn, danh sách xung đột dị ứng, quyết định cho phép bắt đầu.
 * Ai gọi: Màn Chi tiết món, Màn Nấu, Bộ lập lịch nấu ăn.
 * Bám theo: docs/tasks.md mục T16.
 */

import { Recipe, RecipeStep } from '../schemas/recipe.js';
import { SafetyRule } from '../schemas/safety.js';

export interface AllergyConflict {
  ingredient: string;
  allergen: string;
}

export interface StartRecipeCheckResult {
  allowed: boolean;
  reason?: string;
  missingRuleId?: string;
}

/**
 * Danh mục quy tắc an toàn mặc định theo tiêu chuẩn y tế chính thức.
 */
export const DEFAULT_SAFETY_RULES: SafetyRule[] = [
  {
    id: 'SAFE_POULTRY_COOK_TEMP',
    title: 'Nhiệt độ chín an toàn cho thịt gia cầm',
    category: 'temperature',
    description: 'Thịt gà và gia cầm cần nấu chín kỹ đạt nhiệt độ tâm tối thiểu 75 °C để diệt vi khuẩn Salmonella.',
    requires_confirmation: true,
    source_name: 'Cục An toàn thực phẩm - Bộ Y tế',
    source_url: 'https://vfa.gov.vn/an-toan-thuc-pham/nhiet-do-nau-chin-thuc-pham.html',
    source: 'Cục An toàn thực phẩm - Bộ Y tế',
    missing_fields: [],
  },
  {
    id: 'SAFE_SEAFOOD_COOK_TEMP',
    title: 'Nhiệt độ chín an toàn cho hải sản',
    category: 'temperature',
    description: 'Hải sản cần được nấu chín đạt ít nhất 63 °C để tiêu diệt ký sinh trùng và vi khuẩn biển.',
    requires_confirmation: true,
    source_name: 'Cơ quan Quản lý Thực phẩm & Dược phẩm Hoa Kỳ (FDA)',
    source_url: 'https://www.fda.gov/food/people-risk-foodborne-illness/safe-minimum-internal-temperature-chart',
    source: 'FDA',
    missing_fields: [],
  },
  {
    id: 'SAFE_LEFTOVER_STORAGE',
    title: 'Bảo quản đồ ăn thừa an toàn',
    category: 'storage',
    description: 'Thức ăn thừa sau khi nguội cần cho vào hộp kín để ngăn mát tủ lạnh, dùng trong 3-4 ngày.',
    requires_confirmation: false,
    source_name: 'Cục An toàn thực phẩm - Bộ Y tế',
    source_url: 'https://vfa.gov.vn',
    source: 'Cục An toàn thực phẩm - Bộ Y tế',
    missing_fields: [],
  },
  {
    id: 'CROSS_CONTAMINATION_PREVENTION',
    title: 'Chống nhiễm khuẩn chéo dao thớt',
    category: 'cross_contamination',
    description: 'Dùng thớt và dao riêng cho thực phẩm tươi sống và thực phẩm ăn liền/chín.',
    requires_confirmation: true,
    source_name: 'Tổ chức Y tế Thế giới (WHO)',
    source_url: 'https://www.who.int/news-room/fact-sheets/detail/food-safety',
    source: 'WHO 5 Keys to Safer Food',
    missing_fields: [],
  },
];

/**
 * Tra cứu quy tắc an toàn cho một bước nấu ăn.
 * @param step Bước nấu cần kiểm tra
 * @param rules Danh mục quy tắc (mặc định DEFAULT_SAFETY_RULES)
 * @returns SafetyRule tương ứng hoặc null nếu bước không có quy tắc an toàn
 */
export function check(step: RecipeStep, rules: SafetyRule[] = DEFAULT_SAFETY_RULES): SafetyRule | null {
  if (!step.safety_rule || step.safety_rule.trim() === '') {
    return null;
  }

  const ruleId = step.safety_rule.trim();
  const found = rules.find((r) => r.id === ruleId);
  return found || null;
}

/**
 * Định dạng chuỗi cảnh báo an toàn kèm theo nguồn bắt buộc (T16.4).
 * @param rule Quy tắc an toàn
 * @returns Chuỗi cảnh báo đầy đủ thông tin và nguồn gốc
 */
export function formatSafetyWarning(rule: SafetyRule): string {
  const sourceName = rule.source_name || rule.source || 'Cơ quan Y tế';
  const sourceUrl = rule.source_url ? ` (${rule.source_url})` : '';
  return `[CẢNH BÁO AN TOÀN] ${rule.title}: ${rule.description} [Nguồn: ${sourceName}${sourceUrl}]`;
}

/**
 * Kiểm tra các xung đột dị ứng giữa công thức và người dùng (T16.3).
 * @param recipe Công thức món ăn
 * @param profile Hồ sơ người dùng có danh sách dị ứng
 * @param ingredientAllergenMap Bản đồ mã dị ứng theo từng nguyên liệu
 * @returns Danh sách các xung đột dị ứng phát hiện được
 */
export function allergyConflicts(
  recipe: Recipe,
  profile: { allergies?: string[] | null } | null,
  ingredientAllergenMap: Record<string, string[]> = {}
): AllergyConflict[] {
  if (!profile || !profile.allergies || profile.allergies.length === 0) {
    return [];
  }

  const userAllergies = new Set(profile.allergies);
  const conflicts: AllergyConflict[] = [];

  for (const item of recipe.ingredients) {
    const ingId = item.ingredient;
    const allergens = ingredientAllergenMap[ingId] || [];

    for (const code of allergens) {
      if (userAllergies.has(code)) {
        conflicts.push({
          ingredient: ingId,
          allergen: code,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Kiểm tra món có đủ điều kiện để bắt đầu nấu hay không (T16).
 * Quy tắc: Nếu bất kỳ bước nào gắn quy tắc MISSING hoặc quy tắc chưa hoàn thiện, chặn bắt đầu món.
 * @param recipe Công thức món ăn
 * @param rules Danh mục quy tắc đã nạp
 * @returns Kết quả cho phép hay chặn, kèm lý do
 */
export function canStartRecipe(
  recipe: Recipe,
  rules: SafetyRule[] = DEFAULT_SAFETY_RULES
): StartRecipeCheckResult {
  for (const step of recipe.steps) {
    if (!step.safety_rule) {
      continue;
    }

    const ruleId = step.safety_rule.trim();

    // 1. Nếu gắn trực tiếp chữ 'MISSING'
    if (ruleId === 'MISSING' || ruleId.toUpperCase().includes('MISSING')) {
      return {
        allowed: false,
        reason: `Bước "${step.id}" chứa quy tắc an toàn chưa hoàn thiện (${ruleId}). Chặn bắt đầu món.`,
        missingRuleId: ruleId,
      };
    }

    // 2. Tra cứu quy tắc trong danh mục
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) {
      return {
        allowed: false,
        reason: `Bước "${step.id}" tham chiếu quy tắc an toàn không tồn tại trong hệ thống (${ruleId}).`,
        missingRuleId: ruleId,
      };
    }

    // 3. Quy tắc có missing_fields hoặc thiếu nguồn bắt buộc
    if (rule.missing_fields && rule.missing_fields.length > 0) {
      return {
        allowed: false,
        reason: `Quy tắc an toàn "${rule.id}" còn thiếu các trường dữ liệu (${rule.missing_fields.join(', ')}).`,
        missingRuleId: rule.id,
      };
    }

    if (!rule.source_name && !rule.source) {
      return {
        allowed: false,
        reason: `Quy tắc an toàn "${rule.id}" thiếu nguồn xác thực trích dẫn bắt buộc.`,
        missingRuleId: rule.id,
      };
    }
  }

  return {
    allowed: true,
  };
}
