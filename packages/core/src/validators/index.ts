/**
 * File: packages/core/src/validators/index.ts
 * Mục đích: Cung cấp các hàm kiểm định dữ liệu an toàn (safe parse / validate) dựa trên Zod schema.
 * Nhận vào: Dữ liệu thô (unknown) từ file JSON, mạng, hoặc người dùng nhập.
 * Trả ra: Kết quả kiểm tra ({ success: true, data } hoặc { success: false, errors: string[] }).
 * Ai gọi: validate-data script (T03), ứng dụng di động (T05, T06), và các bộ test.
 * Bám theo: Mục T02.3 trong docs/tasks.md.
 */

import { z } from 'zod';
import {
  Ingredient,
  IngredientSchema,
  Recipe,
  RecipeSchema,
  PantryItem,
  PantryItemSchema,
  PantryEvent,
  PantryEventSchema,
  CookSession,
  CookSessionSchema,
  UserProfile,
  UserProfileSchema,
  SafetyRule,
  SafetyRuleSchema,
  StorageRule,
  StorageRuleSchema,
  Equipment,
  EquipmentSchema,
  AiUsageLog,
  AiUsageLogSchema,
} from '../schemas/index.js';

/**
 * Kết quả chuẩn hóa sau khi kiểm định dữ liệu.
 */
export type ValidationResult<T> =
  | { success: true; data: T; errors?: undefined }
  | { success: false; errors: string[]; data?: undefined };

/**
 * Định dạng danh sách lỗi từ ZodError thành danh sách chuỗi thông báo tiếng Việt dễ đọc.
 *
 * Làm gì: Duyệt qua từng issue trong ZodError, lấy đường dẫn thuộc tính và thông báo lỗi tương ứng.
 * Vào: error (ZodError chứa cây lỗi chi tiết).
 * Ra: Mảng các chuỗi mô tả lỗi (string[]).
 *
 * Ví dụ:
 * - Lỗi thiếu "title" tại gốc -> trả về: ['Trường "title": Tên món ăn không được để trống']
 *
 * Gọi bởi: Các hàm validate trong module này.
 */
function formatZodErrors(error: z.ZodError): string[] {
  // Duyệt qua từng lỗi thành phần của Zod
  return error.issues.map((issue) => {
    const pathStr = issue.path.length > 0 ? issue.path.join('.') : 'gốc';
    return `Trường "${pathStr}": ${issue.message}`;
  });
}

/**
 * Kiểm định dữ liệu công thức nấu ăn mà không làm dừng chương trình (Safe Validation).
 *
 * Làm gì: Kiểm tra một đối tượng bất kỳ có đúng chuẩn RecipeSchema hay không.
 * Vào:
 * - data: đối tượng cần kiểm tra (unknown).
 * Ra: ValidationResult<Recipe> chứa dữ liệu đã chuẩn hóa hoặc danh sách lỗi.
 *
 * Ví dụ có số cụ thể:
 * - Đối tượng công thức "trứng chiên cà chua" hợp lệ -> trả về { success: true, data: recipe }.
 * - Đối tượng thiếu "servings" -> trả về { success: false, errors: ['Trường "servings": Required'] }.
 *
 * Gọi bởi: validate-data (T03), màn hình chi tiết món (T06).
 */
export function validateRecipe(data: unknown): ValidationResult<Recipe> {
  const result = RecipeSchema.safeParse(data);
  // Nếu dữ liệu hợp lệ
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Nếu dữ liệu vi phạm schema
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Phân tích và chuyển đổi dữ liệu thành Recipe (ném ngoại lệ nếu sai).
 *
 * Làm gì: Parse dữ liệu nghiêm ngặt, ném lỗi kèm thông điệp rõ ràng nếu dữ liệu sai.
 * Vào: data (unknown).
 * Ra: Recipe hợp lệ. Ném ngoại lệ ZodError nếu sai.
 *
 * Ví dụ:
 * - parseRecipe(validRecipeJson) -> Recipe.
 *
 * Gọi bởi: Bộ nạp công thức ban đầu, các hàm test.
 */
export function parseRecipe(data: unknown): Recipe {
  return RecipeSchema.parse(data);
}

/**
 * Kiểm định dữ liệu nguyên liệu từ điển (Ingredient).
 *
 * Làm gì: Kiểm tra nguyên liệu có đủ tên, đơn vị gốc, bảng quy đổi hợp lệ không.
 * Vào: data (unknown).
 * Ra: ValidationResult<Ingredient>.
 *
 * Ví dụ:
 * - validateIngredient({ id: "trung", name: "Trứng", baseUnit: "quả" }) -> success: false (baseUnit sai enum).
 *
 * Gọi bởi: validate-data (T03), Nạp SQLite (T05).
 */
export function validateIngredient(data: unknown): ValidationResult<Ingredient> {
  const result = IngredientSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Phân tích dữ liệu thành Ingredient (ném ngoại lệ nếu sai).
 */
export function parseIngredient(data: unknown): Ingredient {
  return IngredientSchema.parse(data);
}

/**
 * Kiểm định dữ liệu một mục thực phẩm trong kho (PantryItem).
 */
export function validatePantryItem(data: unknown): ValidationResult<PantryItem> {
  const result = PantryItemSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Kiểm định sự kiện thay đổi kho thực phẩm (PantryEvent).
 */
export function validatePantryEvent(data: unknown): ValidationResult<PantryEvent> {
  const result = PantryEventSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Kiểm định phiên nấu ăn (CookSession).
 */
export function validateCookSession(data: unknown): ValidationResult<CookSession> {
  const result = CookSessionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Kiểm định hồ sơ người dùng (UserProfile).
 */
export function validateUserProfile(data: unknown): ValidationResult<UserProfile> {
  const result = UserProfileSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Kiểm định quy tắc an toàn (SafetyRule).
 */
export function validateSafetyRule(data: unknown): ValidationResult<SafetyRule> {
  const result = SafetyRuleSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Kiểm định quy tắc bảo quản (StorageRule theo docs/plan.md dòng 183).
 */
export function validateStorageRule(data: unknown): ValidationResult<StorageRule> {
  const result = StorageRuleSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Phân tích dữ liệu thành StorageRule (ném ngoại lệ nếu sai).
 */
export function parseStorageRule(data: unknown): StorageRule {
  return StorageRuleSchema.parse(data);
}

/**
 * Kiểm định dụng cụ nấu ăn (Equipment).
 */
export function validateEquipment(data: unknown): ValidationResult<Equipment> {
  const result = EquipmentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Phân tích dữ liệu thành Equipment (ném ngoại lệ nếu sai).
 */
export function parseEquipment(data: unknown): Equipment {
  return EquipmentSchema.parse(data);
}

/**
 * Kiểm định nhật ký sử dụng AI (AiUsageLog).
 */
export function validateAiUsageLog(data: unknown): ValidationResult<AiUsageLog> {
  const result = AiUsageLogSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Phân tích dữ liệu thành AiUsageLog (ném ngoại lệ nếu sai).
 */
export function parseAiUsageLog(data: unknown): AiUsageLog {
  return AiUsageLogSchema.parse(data);
}

