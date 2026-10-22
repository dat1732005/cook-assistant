/**
 * File: packages/core/src/schemas/session.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho phiên nấu ăn (CookSession, RunningTimer).
 * Nhận vào: Dữ liệu phiên nấu từ database SQLite/PostgreSQL hoặc Scheduler.
 * Trả ra: Đối tượng CookSession đã kiểm định tính hợp lệ theo docs/plan.md dòng 181.
 * Ai gọi: Scheduler (T04), Quản lý phiên nấu (T07), Hẹn giờ (T08), Màn hình Nấu (T09).
 * Bám theo: docs/plan.md dòng 181 và Mục T02, T07 trong docs/tasks.md.
 */

import { z } from 'zod';
import { CookSessionStatusEnum, OptimizationModeEnum } from '../enums.js';

/**
 * Schema đồng hồ hẹn giờ đang chạy trong phiên nấu (docs/plan.md dòng 181).
 * Chú ý: Trường endsAt giữ nguyên định dạng camelCase theo yêu cầu kế hoạch.
 */
export const RunningTimerSchema = z.object({
  // Mã định danh của bộ hẹn giờ
  id: z.string().min(1, 'Mã hẹn giờ không được để trống'),
  // Mã bước nấu tương ứng (nếu có)
  step_id: z.string().min(1).optional(),
  // Nhãn hiển thị hẹn giờ (ví dụ: "Chiên mặt dưới trứng")
  label: z.string().optional(),
  // Thời điểm kết thúc hẹn giờ (chuỗi ISO datetime hoặc số timestamp ms / epoch seconds). Giữ nguyên camelCase theo kế hoạch!
  endsAt: z.union([z.string().min(1), z.number()]),
});

export type RunningTimer = z.infer<typeof RunningTimerSchema>;

/**
 * Schema trạng thái một phiên nấu ăn trực tiếp của người dùng (docs/plan.md dòng 181).
 * Các trường:
 * - id: Khớp (kế hoạch ghi `id`)
 * - recipe_id: Khớp (kế hoạch ghi `recipe_id`)
 * - recipe_version: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "phiên bản công thức")
 * - servings: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "số phần")
 * - optimization_mode: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "tiêu chí tối ưu")
 * - started_at: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "bắt đầu")
 * - completed_at: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "kết thúc")
 * - status: TÊN DO DỰ ÁN ĐẶT cho khóa, giá trị enum Khớp (kế hoạch ghi `trạng thái (cooking, done, abandoned)`)
 * - step_states: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "trạng thái từng bước (JSON)")
 * - removed_or_substituted: TÊN DO DỰ ÁN ĐẶT (kế hoạch ghi "nguyên liệu đã bỏ hoặc thay (JSON)")
 * - running_timers: TÊN DO DỰ ÁN ĐẶT cho khóa danh sách, phần tử con chứa khóa `endsAt` Khớp (kế hoạch ghi "hẹn giờ đang chạy (JSON, có `endsAt`)")
 */
export const CookSessionSchema = z.object({
  // Mã định danh duy nhất của phiên nấu
  id: z.string().min(1, 'Mã phiên nấu không được để trống'),
  // Mã công thức đang nấu tham chiếu recipe.id
  recipe_id: z.string().min(1, 'Mã công thức không được để trống'),
  // Phiên bản công thức tại thời điểm nấu
  recipe_version: z
    .number()
    .int()
    .positive('Phiên bản công thức phải lớn hơn hoặc bằng 1'),
  // Số phần ăn nấu thực tế
  servings: z.number().int().positive('Số phần ăn phải lớn hơn hoặc bằng 1'),
  // Tiêu chí tối ưu lịch nấu: 'fastest' | 'fewest_tools'
  optimization_mode: OptimizationModeEnum,
  // Thời điểm bắt đầu phiên nấu (ISO datetime)
  started_at: z.string().min(1, 'Thời điểm bắt đầu không được để trống'),
  // Thời điểm hoàn thành phiên nấu (null nếu chưa xong)
  completed_at: z.string().nullable().optional(),
  // Trạng thái hiện tại: 'cooking' | 'done' | 'abandoned'
  status: CookSessionStatusEnum,
  // Trạng thái từng bước dưới dạng JSON object (ví dụ: { "b1": "completed", "b2": "active" })
  step_states: z.record(z.string(), z.string()).default({}),
  // Ghi nhận nguyên liệu đã bỏ (null) hoặc thay thế (tên nguyên liệu mới) dạng JSON
  removed_or_substituted: z
    .record(z.string(), z.string().nullable())
    .default({}),
  // Hẹn giờ đang chạy dạng JSON array, mỗi mục có trường endsAt
  running_timers: z.array(RunningTimerSchema).default([]),
});

export type CookSession = z.infer<typeof CookSessionSchema>;
