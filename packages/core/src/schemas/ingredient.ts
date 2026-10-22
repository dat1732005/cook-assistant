/**
 * File: packages/core/src/schemas/ingredient.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho nguyên liệu nấu ăn (Ingredient).
 * Nhận vào: Dữ liệu thô từ data/ingredients.json hoặc database SQLite/PostgreSQL.
 * Trả ra: Đối tượng Ingredient đã qua kiểm định tính hợp lệ theo docs/plan.md dòng 175.
 * Ai gọi: validate-data (T03), RecipeRepo (T05), Chi tiết món (T06), Trừ kho (T10).
 * Bám theo: docs/plan.md dòng 175 và Mục T02 trong docs/tasks.md.
 */

import { z } from 'zod';
import { AllergenCodeEnum, BaseUnitEnum } from '../enums.js';

/**
 * Schema nguyên liệu chuẩn trong từ điển hệ thống (docs/plan.md dòng 175).
 * Các trường:
 * - id: slug (kế hoạch ghi `id (slug)`) - Khớp
 * - name: tên chuẩn (kế hoạch ghi "tên chuẩn") - TÊN DO DỰ ÁN ĐẶT
 * - aliases: tên gọi khác (kế hoạch ghi "tên gọi khác (danh sách)") - TÊN DO DỰ ÁN ĐẶT
 * - group: nhóm nguyên liệu (kế hoạch ghi "nhóm") - TÊN DO DỰ ÁN ĐẶT
 * - base_unit: đơn vị gốc (kế hoạch ghi "đơn vị gốc (`g`, `ml` hoặc `cái`)") - TÊN DO DỰ ÁN ĐẶT cho khóa, giá trị enum Khớp
 * - conversions: bảng quy đổi (kế hoạch ghi "bảng quy đổi (ví dụ thìa canh sang `ml`)") - TÊN DO DỰ ÁN ĐẶT
 * - allergen_codes: danh sách mã dị ứng (kế hoạch ghi "mã dị ứng", dự án dùng mảng để tránh bỏ sót) - TÊN DO DỰ ÁN ĐẶT
 * - reference_price: giá tham khảo theo đơn vị gốc (kế hoạch ghi "giá tham khảo theo đơn vị gốc") - TÊN DO DỰ ÁN ĐẶT
 * - price_updated_at: ngày cập nhật giá (kế hoạch ghi "ngày cập nhật giá") - TÊN DO DỰ ÁN ĐẶT
 * - storage_rule_id: mã quy tắc bảo quản (kế hoạch ghi "mã quy tắc bảo quản") - TÊN DO DỰ ÁN ĐẶT
 */
export const IngredientSchema = z.object({
  // Mã định danh chuẩn của nguyên liệu (slug, ví dụ: "trung-ga", "ca-chua")
  id: z.string().min(1, 'Mã nguyên liệu không được để trống'),
  // Tên chuẩn tiếng Việt
  name: z.string().min(1, 'Tên chuẩn không được để trống'),
  // Danh sách tên gọi khác theo vùng miền (Bắc/Trung/Nam, ví dụ: ["hột gà"])
  aliases: z.array(z.string().min(1)).default([]),
  // Nhóm nguyên liệu (ví dụ: "rau-cu", "thit", "gia-vi", "trung-sua")
  group: z.string().min(1, 'Nhóm nguyên liệu không được để trống'),
  // Đơn vị gốc bắt buộc: 'g' | 'ml' | 'cái'
  base_unit: BaseUnitEnum,
  // Bảng quy đổi riêng: tên đơn vị đời thường -> hệ số ra đơn vị gốc
  conversions: z
    .record(z.string(), z.number().positive('Hệ số quy đổi phải lớn hơn 0'))
    .default({}),
  // Danh sách các mã dị ứng (nếu có): mảng các mã AllergenCode chuẩn, mặc định rỗng để tránh bỏ sót cảnh báo an toàn
  allergen_codes: z.array(AllergenCodeEnum).default([]),
  // Giá tham khảo tính theo đơn vị gốc (VND)
  reference_price: z
    .number()
    .nonnegative('Giá tham khảo không được âm')
    .nullable()
    .optional(),
  // Ngày cập nhật giá (định dạng YYYY-MM-DD hoặc ISO datetime)
  price_updated_at: z.string().nullable().optional(),
  // Mã quy tắc bảo quản tham chiếu bảng storage_rule
  storage_rule_id: z.string().nullable().optional(),
});

export type Ingredient = z.infer<typeof IngredientSchema>;
