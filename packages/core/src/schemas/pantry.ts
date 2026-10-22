/**
 * File: packages/core/src/schemas/pantry.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho quản lý kho thực phẩm (PantryItem, PantryEvent).
 * Nhận vào: Dữ liệu kho từ database SQLite/PostgreSQL hoặc giao diện người dùng.
 * Trả ra: Đối tượng PantryItem và PantryEvent đã kiểm tra tính hợp lệ theo docs/plan.md dòng 179-180.
 * Ai gọi: Module trừ kho (T10), Thêm nhanh nguyên liệu (T11), và Gợi ý món (T12).
 * Bám theo: docs/plan.md dòng 179-180 và Mục T02, T10 trong docs/tasks.md.
 */

import { z } from 'zod';
import {
  BaseUnitEnum,
  PantryEventReasonEnum,
  PantryItemSourceEnum,
} from '../enums.js';

/**
 * Schema một mục thực phẩm có trong kho (docs/plan.md dòng 179).
 * Các trường:
 * - id: Khớp (kế hoạch ghi `id`)
 * - ingredient_id: Khớp (kế hoạch ghi `ingredient_id`)
 * - quantity: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "lượng")
 * - base_unit: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "đơn vị gốc")
 * - storage_location: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "vị trí bảo quản")
 * - added_at: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "ngày thêm")
 * - opened_at: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "ngày mở")
 * - expiry_date: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "hạn dùng")
 * - source: TÊN DO DỰ ÁN ĐẶT cho khóa, giá trị enum Khớp (kế hoạch ghi `nguồn (manual, cook, shopping, photo)`)
 */
export const PantryItemSchema = z.object({
  // Mã định danh duy nhất của mục kho
  id: z.string().min(1, 'Mã mục kho không được để trống'),
  // Mã nguyên liệu tham chiếu tới ingredient.id
  ingredient_id: z.string().min(1, 'Mã nguyên liệu không được để trống'),
  // Số lượng thực tế hiện có trong kho (không được âm)
  quantity: z.number().nonnegative('Lượng tồn kho không được âm'),
  // Đơn vị gốc chuẩn hóa: 'g' | 'ml' | 'cái'
  base_unit: BaseUnitEnum,
  // Vị trí bảo quản (ngăn mát, ngăn đá, nhiệt độ phòng, v.v.)
  storage_location: z.string().min(1, 'Vị trí bảo quản không được để trống'),
  // Ngày nhập/thêm vào kho (định dạng YYYY-MM-DD hoặc ISO datetime)
  added_at: z.string().min(1, 'Ngày thêm không được để trống'),
  // Ngày mở bao bì (null nếu chưa mở)
  opened_at: z.string().nullable().optional(),
  // Hạn sử dụng (YYYY-MM-DD hoặc null nếu không rõ)
  expiry_date: z.string().nullable().optional(),
  // Nguồn nhập kho: 'manual' | 'cook' | 'shopping' | 'photo'
  source: PantryItemSourceEnum,
});

export type PantryItem = z.infer<typeof PantryItemSchema>;

/**
 * Schema ghi nhận một sự kiện biến động kho thực phẩm (docs/plan.md dòng 180).
 * Các trường:
 * - id: Khớp (kế hoạch ghi `id`)
 * - pantry_item_id: Khớp (kế hoạch ghi `pantry_item_id`)
 * - delta: Khớp (kế hoạch ghi `thay đổi (delta)`)
 * - reason: TÊN DO DỰ ÁN ĐẶT cho khóa, giá trị enum Khớp (kế hoạch ghi `lý do (cook, adjust, discard, buy)`)
 * - cook_session_id: Khớp (kế hoạch ghi `cook_session_id`)
 * - created_at: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "thời điểm")
 */
export const PantryEventSchema = z.object({
  // Mã định danh của sự kiện biến động kho
  id: z.string().min(1, 'Mã sự kiện kho không được để trống'),
  // Mã mục kho bị biến động
  pantry_item_id: z.string().min(1, 'Mã mục kho không được để trống'),
  // Độ thay đổi số lượng: số âm là xuất kho (nấu, bỏ), số dương là nhập kho (mua, điều chỉnh tăng)
  delta: z.number(),
  // Lý do biến động: 'cook' | 'adjust' | 'discard' | 'buy'
  reason: PantryEventReasonEnum,
  // Mã phiên nấu ăn liên quan (nếu biến động từ việc nấu - reason === 'cook')
  cook_session_id: z.string().nullable().optional(),
  // Thời điểm xảy ra sự kiện biến động (ISO datetime)
  created_at: z.string().min(1, 'Thời điểm sự kiện không được để trống'),
});

export type PantryEvent = z.infer<typeof PantryEventSchema>;
