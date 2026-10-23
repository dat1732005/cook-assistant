/**
 * File: packages/core/src/schemas/profile.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho hồ sơ sở thích người dùng (UserProfile).
 * Nhận vào: Dữ liệu hồ sơ người dùng từ SQLite/PostgreSQL hoặc màn hình Chào mừng (T06).
 * Trả ra: Đối tượng UserProfile đã kiểm tra tính hợp lệ theo docs/plan.md dòng 174.
 * Ai gọi: Màn Chào mừng (T06), Bộ lọc món ăn (T06, T16), Gợi ý món (T12).
 * Bám theo: docs/plan.md dòng 174 và Mục T02, T06 trong docs/tasks.md.
 */

import { z } from 'zod';
import { AllergenCodeEnum } from '../enums.js';

/**
 * Schema hồ sơ người dùng (docs/plan.md dòng 174).
 * Các trường:
 * - id: Khớp (kế hoạch ghi `id`)
 * - display_name: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "tên hiển thị")
 * - servings: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "số người ăn")
 * - allergies: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "dị ứng (danh sách mã)")
 * - dietary_preference: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "chế độ ăn")
 * - essential_spices: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "gia vị cơ bản đang có (danh sách `ingredient_id`)")
 * - available_equipment: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "dụng cụ đang có")
 */
export const UserProfileSchema = z.object({
  // Mã định danh người dùng (thường là "default" hoặc UUID trên SQLite)
  id: z.string().min(1, 'Mã người dùng không được để trống'),
  // Tên hiển thị của người dùng (tùy chọn)
  display_name: z.string().optional(),
  // Số người ăn mặc định mỗi bữa (thường là 2)
  servings: z
    .number()
    .int()
    .positive('Số người ăn mặc định phải lớn hơn hoặc bằng 1')
    .default(2),
  // Danh sách các mã dị ứng của người dùng: AllergenCode[] | null (null là chưa khai, [] là đã khai không có)
  allergies: z.array(AllergenCodeEnum).nullable().default(null),
  // Chế độ ăn uống riêng (ví dụ: "chay", "eat_clean", "binh_thuong")
  dietary_preference: z.string().optional(),
  // Danh sách ingredient_id của các gia vị cơ bản đang có trong nhà (muối, tiêu, đường...)
  essential_spices: z.array(z.string().min(1)).default([]),
  // Danh sách dụng cụ nấu bếp đang có sẵn (ví dụ: ["chao", "noi", "bep-ga"])
  available_equipment: z.array(z.string().min(1)).default([]),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
