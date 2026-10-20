/**
 * File: packages/core/src/schemas/ingredient.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho nguyên liệu nấu ăn (Ingredient).
 * Nhận vào: Dữ liệu thô từ data/ingredients.json hoặc database SQLite.
 * Trả ra: Đối tượng Ingredient đã qua kiểm định tính hợp lệ.
 * Ai gọi: validate-data (T03), RecipeRepo (T05), Chi tiết món (T06), Trừ kho (T10).
 * Bám theo: Mục T02.1, T02.4, T02.5 và T03.1 trong docs/tasks.md.
 */

import { z } from 'zod';
import { AllergenCodeEnum, BaseUnitEnum } from '../enums.js';
import { StorageRuleSchema } from './safety.js';

/**
 * Schema giá tham khảo của nguyên liệu (Mục T12, R1).
 */
export const ReferencePriceSchema = z.object({
  // Mức giá bằng Việt Nam Đồng (VND), không được âm
  price: z.number().nonnegative('Giá tham khảo không được âm'),
  // Đơn vị áp dụng mức giá (ví dụ: "kg", "g", "quả", "hộp")
  unit: z.string().min(1, 'Đơn vị tính giá không được rỗng'),
  // Ngày khảo sát giá (định dạng YYYY-MM-DD)
  date: z.string().optional(),
  // Nguồn khảo sát (ví dụ: "Siêu thị Co.opmart 10/2026")
  source: z.string().optional(),
});

export type ReferencePrice = z.infer<typeof ReferencePriceSchema>;

/**
 * Schema nguyên liệu chuẩn trong từ điển hệ thống (Mục T02.1).
 */
export const IngredientSchema = z.object({
  // Mã định danh chuẩn của nguyên liệu (kebab-case, ví dụ: "trung_ga", "ca_chua")
  id: z.string().min(1, 'Mã nguyên liệu không được để trống'),
  // Tên chuẩn tiếng Việt
  name: z.string().min(1, 'Tên nguyên liệu không được để trống'),
  // Danh sách tên gọi khác theo vùng miền (Bắc/Trung/Nam, ví dụ: "trứng gà", "hột gà")
  aliases: z.array(z.string().min(1)).default([]),
  // Đơn vị gốc bắt buộc chuẩn hóa: "g", "ml", hoặc "cái"
  baseUnit: BaseUnitEnum,
  // Bảng quy đổi riêng của nguyên liệu: đơn vị đời thường -> số lượng đơn vị gốc
  conversions: z.record(z.string(), z.number().positive('Hệ số quy đổi phải lớn hơn 0')).default({}),
  // Danh sách mã dị ứng có trong nguyên liệu này (nếu có)
  allergens: z.array(AllergenCodeEnum).default([]),
  // Giá tham khảo để ước tính chi phí nấu ăn
  referencePrice: ReferencePriceSchema.nullable().optional(),
  // Quy tắc bảo quản trong kho thực phẩm
  storageRule: StorageRuleSchema.optional(),
  // Nguồn dữ liệu (bắt buộc theo R3 với dữ liệu chính thức)
  source: z.string().optional(),
  // Người xác nhận dữ liệu
  confirmedBy: z.string().optional(),
});

export type Ingredient = z.infer<typeof IngredientSchema>;
