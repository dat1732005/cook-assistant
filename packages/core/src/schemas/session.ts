/**
 * File: packages/core/src/schemas/session.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho phiên nấu ăn (CookSession, SessionPlanStep).
 * Nhận vào: Dữ liệu phiên nấu từ database SQLite hoặc Scheduler.
 * Trả ra: Đối tượng CookSession đã kiểm định tính hợp lệ.
 * Ai gọi: Scheduler (T04), Quản lý phiên nấu (T07), Hẹn giờ (T08), Màn hình Nấu (T09).
 * Bám theo: Mục T02.1, T04.1 và T07 trong docs/tasks.md.
 */

import { z } from 'zod';
import { CookSessionStatusEnum, OptimizationModeEnum } from '../enums.js';

/**
 * Schema một bước trong kế hoạch thời gian nấu do Scheduler sinh ra (Mục T04.1).
 */
export const SessionPlanStepSchema = z.object({
  // Mã bước nấu trong công thức (tham chiếu RecipeStep.id)
  stepId: z.string().min(1, 'Mã bước không được để trống'),
  // Thời điểm bắt đầu bước (tính bằng giây từ mốc 0)
  startAt: z.number().int().nonnegative('Thời điểm bắt đầu không được âm'),
  // Thời điểm kết thúc bước (tính bằng giây từ mốc 0)
  endAt: z.number().int().positive('Thời điểm kết thúc phải lớn hơn 0'),
});

export type SessionPlanStep = z.infer<typeof SessionPlanStepSchema>;

/**
 * Schema trạng thái một phiên nấu ăn trực tiếp của người dùng (Mục T02.1, T07).
 */
export const CookSessionSchema = z.object({
  // Mã định danh duy nhất của phiên nấu
  id: z.string().min(1, 'Mã phiên nấu không được để trống'),
  // Mã công thức đang nấu
  recipeId: z.string().min(1, 'Mã công thức không được để trống'),
  // Phiên bản công thức tại thời điểm nấu (để tái hiện chính xác)
  recipeVersion: z.number().int().positive('Phiên bản công thức phải lớn hơn hoặc bằng 1'),
  // Số phần ăn người dùng chọn nấu thực tế
  servings: z.number().int().positive('Số phần ăn phải lớn hơn hoặc bằng 1'),
  // Chế độ tối ưu lịch nấu đã chọn: 'fastest' hoặc 'fewest_tools'
  mode: OptimizationModeEnum,
  // Trạng thái hiện tại của phiên nấu
  status: CookSessionStatusEnum,
  // Thời điểm bắt đầu phiên nấu (ISO 8601)
  startedAt: z.string().min(1, 'Thời điểm bắt đầu không được để trống'),
  // Thời điểm hoàn thành phiên nấu (null nếu chưa xong)
  completedAt: z.string().nullable().optional(),
  // Mã bước hiện tại đang hiển thị trên màn hình
  currentStepId: z.string().nullable().optional(),
  // Danh sách các bước có quy tắc an toàn mà người dùng đã bấm xác nhận
  confirmedSafetySteps: z.array(z.string()).default([]),
  // Bảng ghi nhận nguyên liệu bị bỏ bớt (null) hoặc thay thế (tên nguyên liệu mới)
  removedOrSubstituted: z.record(z.string(), z.string().nullable()).optional(),
  // Toàn bộ kế hoạch thời gian đã được lập lịch
  plan: z.array(SessionPlanStepSchema).default([]),
});

export type CookSession = z.infer<typeof CookSessionSchema>;
