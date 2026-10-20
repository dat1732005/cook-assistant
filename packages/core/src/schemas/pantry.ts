/**
 * File: packages/core/src/schemas/pantry.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho quản lý kho thực phẩm (PantryItem, PantryEvent).
 * Nhận vào: Dữ liệu kho từ database SQLite hoặc giao diện người dùng.
 * Trả ra: Đối tượng PantryItem và PantryEvent đã kiểm tra tính hợp lệ.
 * Ai gọi: Module trừ kho (T10), Thêm nhanh nguyên liệu (T11), và Gợi ý món (T12).
 * Bám theo: Mục T02.1, T02.2 và T10 trong docs/tasks.md.
 */

import { z } from 'zod';
import { PantryEventReasonEnum } from '../enums.js';

/**
 * Các khu vực lưu trữ thực phẩm trong nhà.
 */
export const PANTRY_LOCATIONS = ['pantry', 'fridge', 'freezer'] as const;
export const PantryLocationEnum = z.enum(PANTRY_LOCATIONS);
export type PantryLocation = z.infer<typeof PantryLocationEnum>;

/**
 * Schema một mục thực phẩm có trong kho (Mục T02.1, T10).
 */
export const PantryItemSchema = z.object({
  // Mã định danh duy nhất của mục kho
  id: z.string().min(1, 'Mã mục kho không được để trống'),
  // Mã nguyên liệu tham chiếu tới từ điển nguyên liệu
  ingredientId: z.string().min(1, 'Mã nguyên liệu không được để trống'),
  // Số lượng thực tế hiện có trong kho (không được âm)
  quantity: z.number().nonnegative('Số lượng tồn kho không được âm'),
  // Đơn vị đo lường của số lượng này
  unit: z.string().min(1, 'Đơn vị không được để trống'),
  // Vị trí lưu trữ: tủ bếp (pantry), ngăn mát (fridge), ngăn đông (freezer)
  location: PantryLocationEnum.default('pantry'),
  // Hạn sử dụng (định dạng ISO YYYY-MM-DD hoặc null nếu không rõ)
  expiryDate: z.string().nullable().optional(),
  // Đánh dấu gia vị thiết yếu luôn sẵn có trong nhà (muối, đường, dầu ăn...)
  isEssential: z.boolean().default(false),
  // Thời điểm cập nhật cuối cùng (ISO 8601)
  updatedAt: z.string().optional(),
});

export type PantryItem = z.infer<typeof PantryItemSchema>;

/**
 * Schema ghi nhận một sự kiện biến động kho thực phẩm (Mục T02.1, T10, T13).
 */
export const PantryEventSchema = z.object({
  // Mã định danh của sự kiện
  id: z.string().min(1, 'Mã sự kiện kho không được để trống'),
  // Mã mục kho bị biến động
  pantryItemId: z.string().min(1, 'Mã mục kho không được để trống'),
  // Mã nguyên liệu
  ingredientId: z.string().min(1, 'Mã nguyên liệu không được để trống'),
  // Độ thay đổi số lượng: số âm là xuất kho (nấu, bỏ), số dương là nhập kho (mua)
  change: z.number(),
  // Lý do biến động kho: 'cook' | 'adjust' | 'discard' | 'buy'
  reason: PantryEventReasonEnum,
  // Thời điểm xảy ra sự kiện (ISO 8601)
  createdAt: z.string().min(1, 'Thời điểm sự kiện không được để trống'),
  // Mã phiên nấu ăn liên quan (nếu biến động do nấu ăn - reason === 'cook')
  sessionId: z.string().nullable().optional(),
});

export type PantryEvent = z.infer<typeof PantryEventSchema>;
