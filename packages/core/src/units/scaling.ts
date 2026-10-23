/**
 * File: packages/core/src/units/scaling.ts
 * Làm gì: Cung cấp các hàm thuần túy để tính toán lại lượng nguyên liệu theo số phần ăn thực tế, làm tròn sạch tối đa 2 chữ số thập phân và giữ nguyên đơn vị đời thường.
 * Nhận vào: Danh sách nguyên liệu công thức (RecipeIngredient hoặc RecipeIngredientDetail), số phần ăn mục tiêu (servings), số phần ăn gốc (servings_base).
 * Trả ra: Danh sách nguyên liệu đã nhân tỷ lệ (ScaledIngredient) kèm chuỗi hiển thị định lượng sạch.
 * Ai gọi: Màn hình Chi tiết món (RecipeDetailScreen), bộ test T06 mục B.
 * Bám theo: Mục T06.4, T06.5 trong docs/tasks.md và docs/expected/T06.md mục B (B1-B8).
 */

/** Hằng số số phần ăn tối thiểu cho phép trong hệ thống */
export const MIN_SERVINGS = 1;

/** Hằng số số chữ số thập phân tối đa làm tròn để tránh sai số dấu phẩy động */
export const MAX_DECIMAL_PLACES = 2;

/** Hệ số nhân làm tròn 2 chữ số thập phân: 10^2 = 100 */
export const ROUNDING_FACTOR = 100;

/**
 * Interface tối thiểu cần có của một nguyên liệu để có thể quy đổi định lượng.
 */
export interface ScalableIngredientBase {
  ingredient: string;
  unit: string;
  qty?: number | null;
  amount_note?: string | null;
  role?: string;
  flavor_group?: string;
  optional?: boolean;
  group?: string | null;
}

/**
 * Kiểu dữ liệu nguyên liệu đã được nhân tỷ lệ theo số phần ăn.
 * Kế thừa toàn bộ trường của đối tượng nguyên liệu đầu vào và bổ sung display_amount.
 */
export type ScaledIngredient<T = ScalableIngredientBase> = T & {
  display_amount: string;
};

/**
 * Tính toán lại số lượng đơn lẻ theo tỷ lệ số phần ăn và làm tròn sạch sẽ.
 *
 * @param qty Số lượng gốc của nguyên liệu theo servings_base
 * @param servings Số phần ăn thực tế người dùng muốn nấu (nguyên dương >= 1)
 * @param servingsBase Số phần ăn gốc của công thức (nguyên dương >= 1)
 * @returns Số lượng mới đã làm tròn tối đa 2 chữ số thập phân
 *
 * @example
 * // Trứng gà món Trứng chiên cà chua (gốc 3 quả cho 2 người, đổi sang 4 người):
 * scaleQuantity(3, 4, 2); // => 6
 *
 * @example
 * // Đường món Trứng chiên cà chua (gốc 0.5 thìa cho 2 người, đổi sang 1 người):
 * scaleQuantity(0.5, 1, 2); // => 0.25
 *
 * @example
 * // Công thức có servings_base = 3, qty = 1, đổi sang 1 người:
 * scaleQuantity(1, 1, 3); // => 0.33
 */
export function scaleQuantity(
  qty: number,
  servings: number,
  servingsBase: number
): number {
  // Kiểm tra số phần ăn mục tiêu: bắt buộc phải là số nguyên dương >= MIN_SERVINGS (B8)
  if (!Number.isInteger(servings) || servings < MIN_SERVINGS) {
    throw new Error(
      `Số phần ăn mục tiêu phải là số nguyên dương lớn hơn hoặc bằng ${MIN_SERVINGS}, nhận được: ${servings}`
    );
  }

  // Kiểm tra số phần ăn gốc: bắt buộc phải là số nguyên dương >= MIN_SERVINGS (B8)
  if (!Number.isInteger(servingsBase) || servingsBase < MIN_SERVINGS) {
    throw new Error(
      `Số phần ăn gốc phải là số nguyên dương lớn hơn hoặc bằng ${MIN_SERVINGS}, nhận được: ${servingsBase}`
    );
  }

  // Tính tỷ lệ nhân giữa số phần ăn thực tế và số phần ăn gốc
  const ratio = servings / servingsBase;

  // Nhân với tỷ lệ và làm tròn chính xác tối đa 2 chữ số thập phân (B6)
  const scaled = Math.round(qty * ratio * ROUNDING_FACTOR) / ROUNDING_FACTOR;

  return scaled;
}

/**
 * Quy đổi một nguyên liệu thành phần trong công thức theo số phần ăn mong muốn.
 * Giữ nguyên đơn vị đời thường (unit) của công thức (không đổi sang g hay ml).
 *
 * @param ingredient Đối tượng nguyên liệu trong công thức
 * @param servings Số phần ăn muốn tính
 * @param servingsBase Số phần ăn gốc của công thức
 * @returns Đối tượng ScaledIngredient đã cập nhật qty và display_amount
 *
 * @example
 * // Nguyên liệu có số lượng:
 * scaleIngredient({ ingredient: 'trung-ga', qty: 3, unit: 'quả', role: 'structure', flavor_group: 'none', optional: false }, 4, 2);
 * // => { ingredient: 'trung-ga', qty: 6, unit: 'quả', ..., display_amount: '6 quả' }
 *
 * @example
 * // Nguyên liệu mơ hồ không dùng số (B7):
 * scaleIngredient({ ingredient: 'tieu', unit: 'chút', role: 'flavor', flavor_group: 'spice', optional: true, amount_note: 'vừa ăn' }, 4, 2);
 * // => { ingredient: 'tieu', qty: undefined, unit: 'chút', ..., display_amount: 'vừa ăn' }
 */
export function scaleIngredient<T extends ScalableIngredientBase>(
  ingredient: T,
  servings: number,
  servingsBase: number
): ScaledIngredient<T> {
  // Phân nhánh nghiệp vụ: Nếu nguyên liệu có số lượng xác định (qty !== undefined && qty !== null)
  if (ingredient.qty !== undefined && ingredient.qty !== null) {
    const scaledQty = scaleQuantity(ingredient.qty, servings, servingsBase);
    const display_amount = `${scaledQty} ${ingredient.unit}`;

    return {
      ...ingredient,
      qty: scaledQty,
      display_amount,
    };
  } else {
    // Nguyên liệu có lượng mơ hồ (chỉ có amount_note, không có số) (B7)
    // Giữ nguyên chuỗi amount_note, tuyệt đối không sinh NaN hoặc ép số
    const noteText = ingredient.amount_note ?? ingredient.unit;
    return {
      ...ingredient,
      qty: undefined,
      display_amount: noteText,
    };
  }
}

/**
 * Quy đổi danh sách nguyên liệu trong công thức theo số phần ăn mong muốn.
 *
 * @param ingredients Mảng nguyên liệu gốc của món ăn
 * @param servings Số phần ăn thực tế
 * @param servingsBase Số phần ăn gốc của món ăn
 * @returns Mảng nguyên liệu đã quy đổi
 *
 * @example
 * scaleIngredients(recipe.ingredients, 4, recipe.servings_base);
 */
export function scaleIngredients<T extends ScalableIngredientBase>(
  ingredients: T[],
  servings: number,
  servingsBase: number
): ScaledIngredient<T>[] {
  // Lặp qua từng nguyên liệu để nhân tỷ lệ theo số phần ăn
  return ingredients.map((item) => scaleIngredient(item, servings, servingsBase));
}
