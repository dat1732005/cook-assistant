/**
 * File: packages/core/src/schemas/safety.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho quy tắc bảo quản (StorageRule) và quy tắc an toàn (SafetyRule).
 * Nhận vào: Dữ liệu thô từ database hoặc JSON.
 * Trả ra: Đối tượng StorageRule và SafetyRule đã qua kiểm định schema theo docs/plan.md dòng 183.
 * Ai gọi: Module kiểm tra an toàn (T16), Quản lý kho (T10), và ứng dụng di động.
 * Bám theo: docs/plan.md dòng 183 và Mục T02, T16 trong docs/tasks.md.
 */

import { z } from 'zod';
import {
  SafetyCategoryEnum,
  StorageLocationEnum,
  StorageStateEnum,
} from '../enums.js';

/**
 * Schema quy tắc bảo quản thực phẩm (docs/plan.md dòng 183).
 * Các trường:
 * - id: Khớp (kế hoạch ghi `id`)
 * - target_id_or_group: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "ingredient_id hoặc nhóm")
 * - state: TÊN DO DỰ ÁN ĐẶT cho khóa, giá trị tiếng Anh snake_case (kế hoạch ghi "trạng thái (tươi, đã mở, đã nấu)")
 * - location: TÊN DO DỰ ÁN ĐẶT cho khóa, giá trị tiếng Anh snake_case (kế hoạch ghi "vị trí (ngăn mát, ngăn đá, nhiệt độ phòng)")
 * - max_days: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "số ngày tối đa")
 * - source_name: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "tên nguồn")
 * - source_url: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "đường dẫn nguồn")
 */
export const StorageRuleSchema = z.object({
  // Mã định danh duy nhất của quy tắc bảo quản
  id: z.string().min(1, 'Mã quy tắc bảo quản không được để trống'),
  // Mã nguyên liệu (ingredient_id) hoặc tên nhóm nguyên liệu (ví dụ: "thit-bo" hoặc "nhom-thit")
  target_id_or_group: z
    .string()
    .min(1, 'Mã nguyên liệu hoặc nhóm không được để trống'),
  // Trạng thái thực phẩm: 'fresh' (tươi) | 'opened' (đã mở) | 'cooked' (đã nấu)
  state: StorageStateEnum,
  // Vị trí lưu trữ: 'fridge' (ngăn mát) | 'freezer' (ngăn đá) | 'room_temperature' (nhiệt độ phòng)
  location: StorageLocationEnum,
  // Số ngày bảo quản an toàn tối đa
  max_days: z.number().nonnegative('Số ngày tối đa không được âm'),
  // Tên nguồn tài liệu y tế / an toàn thực phẩm chính thức
  source_name: z.string().min(1, 'Tên nguồn không được để trống'),
  // Đường dẫn tra cứu tài liệu y tế chính thức (URL)
  source_url: z.string().min(1, 'Đường dẫn nguồn không được để trống'),
});

export type StorageRule = z.infer<typeof StorageRuleSchema>;

/**
 * Schema quy tắc an toàn thực phẩm khi chế biến (docs/plan.md dòng 178, 236).
 * Ví dụ: Nhiệt độ chín an toàn, chống nhiễm khuẩn chéo dao thớt.
 */
export const SafetyRuleSchema = z.object({
  // Mã định danh duy nhất của quy tắc an toàn (ví dụ: "SAFE_POULTRY_COOK_TEMP")
  id: z.string().min(1, 'Mã quy tắc an toàn không được rỗng'),
  // Tiêu đề ngắn gọn hiển thị cảnh báo
  title: z.string().min(1, 'Tiêu đề quy tắc an toàn không được rỗng'),
  // Phân loại quy tắc an toàn
  category: SafetyCategoryEnum,
  // Nội dung chi tiết hướng dẫn thao tác an toàn
  description: z.string().min(1, 'Mô tả an toàn không được rỗng'),
  // Bước này có bắt buộc người dùng bấm xác nhận trên màn hình mới cho qua không
  requires_confirmation: z.boolean().default(false),
  // Tên nguồn tài liệu trích dẫn chính thức
  source_name: z.string().optional(),
  // Đường dẫn tài liệu trích dẫn
  source_url: z.string().optional(),
  // Người kiểm duyệt nội dung an toàn
  confirmed_by: z.string().optional(),
});

export type SafetyRule = z.infer<typeof SafetyRuleSchema>;
