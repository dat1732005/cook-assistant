/**
 * File: packages/core/src/schemas/safety.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho quy tắc an toàn thực phẩm và bảo quản.
 * Nhận vào: Dữ liệu thô từ database hoặc JSON.
 * Trả ra: Đối tượng StorageRule và SafetyRule đã qua kiểm định schema.
 * Ai gọi: Module kiểm tra an toàn (T16), Quản lý kho (T10), và ứng dụng di động.
 * Bám theo: Mục T02.1, T02.2 và T16 trong docs/tasks.md.
 */

import { z } from 'zod';
import { SafetyCategoryEnum } from '../enums.js';

/**
 * Schema quy tắc bảo quản nguyên liệu theo nhiệt độ và thời gian (Mục T02.1).
 */
export const StorageRuleSchema = z.object({
  // Số ngày bảo quản an toàn ở nhiệt độ phòng (null nếu không nên để ngoài)
  roomTempDays: z.number().nonnegative().nullable().optional(),
  // Số ngày bảo quản trong ngăn mát tủ lạnh (1-4°C)
  fridgeDays: z.number().nonnegative().nullable().optional(),
  // Số ngày bảo quản trong ngăn đông (<= -18°C)
  freezerDays: z.number().nonnegative().nullable().optional(),
  // Ghi chú hoặc điều kiện bảo quản đặc biệt (ví dụ: "đậy kín, tránh ánh sáng")
  note: z.string().optional(),
});

export type StorageRule = z.infer<typeof StorageRuleSchema>;

/**
 * Schema quy tắc an toàn khi nấu nướng (Mục T02.1, T16).
 * Ví dụ: Nhiệt độ chín an toàn của thịt, tránh nhiễm khuẩn chéo thớt dao, dị ứng.
 */
export const SafetyRuleSchema = z.object({
  // Mã định danh duy nhất của quy tắc an toàn (ví dụ: "SAFE_CHICKEN_INTERNAL_TEMP")
  id: z.string().min(1, 'Mã quy tắc an toàn không được rỗng'),
  // Tiêu đề ngắn gọn hiển thị cảnh báo
  title: z.string().min(1, 'Tiêu đề quy tắc an toàn không được rỗng'),
  // Phân loại quy tắc an toàn
  category: SafetyCategoryEnum,
  // Nội dung chi tiết hướng dẫn thao tác an toàn
  description: z.string().min(1, 'Mô tả an toàn không được rỗng'),
  // Bước này có bắt buộc người dùng bấm xác nhận trên màn hình mới cho qua không
  requiresConfirmation: z.boolean().default(false),
  // Nguồn trích dẫn (WHO, Bộ Y Tế, CDC) - bắt buộc theo quy tắc R3 khi đưa vào dữ liệu thật
  source: z.string().optional(),
  // Người kiểm duyệt nội dung an toàn
  confirmedBy: z.string().optional(),
});

export type SafetyRule = z.infer<typeof SafetyRuleSchema>;
