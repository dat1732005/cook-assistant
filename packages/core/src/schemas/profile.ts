/**
 * File: packages/core/src/schemas/profile.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho hồ sơ sở thích người dùng (UserProfile).
 * Nhận vào: Dữ liệu hồ sơ người dùng từ SQLite hoặc màn hình Chào mừng (T06).
 * Trả ra: Đối tượng UserProfile đã kiểm tra tính hợp lệ.
 * Ai gọi: Màn Chào mừng (T06), Bộ lọc món ăn (T06, T16), Gợi ý món (T12).
 * Bám theo: Mục T02.1, T02.5 và T06.2 trong docs/tasks.md.
 */

import { z } from 'zod';
import { AllergenCodeEnum } from '../enums.js';

/**
 * Schema hồ sơ người dùng lưu trên thiết bị (Mục T02.1, T06.2).
 */
export const UserProfileSchema = z.object({
  // Mã định danh người dùng (thường là "default" hoặc UUID trên SQLite)
  id: z.string().min(1, 'Mã người dùng không được để trống'),
  // Tên hiển thị của người dùng (tùy chọn)
  name: z.string().optional(),
  // Số người ăn mặc định mỗi bữa (thường là 2)
  servings: z
    .number()
    .int()
    .positive('Số người ăn mặc định phải lớn hơn hoặc bằng 1')
    .default(2),
  // Danh sách các mã dị ứng của người dùng (cố định theo T02.5)
  allergies: z.array(AllergenCodeEnum).default([]),
  // Danh sách mã dụng cụ có sẵn trong bếp của người dùng (ví dụ: ["chao", "noi", "bep_ga"])
  availableEquipment: z.array(z.string().min(1)).default([]),
  // Danh sách mã gia vị cơ bản luôn có sẵn trong nhà (ví dụ: ["muoi", "duong", "nuoc_mam"])
  essentialSpices: z.array(z.string().min(1)).default([]),
  // Thời điểm tạo hồ sơ (ISO 8601)
  createdAt: z.string().optional(),
  // Thời điểm cập nhật hồ sơ lần cuối (ISO 8601)
  updatedAt: z.string().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
