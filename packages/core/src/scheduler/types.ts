/**
 * File: packages/core/src/scheduler/types.ts
 * Module: @cook/core/scheduler
 *
 * File này định nghĩa các kiểu dữ liệu, giao diện và mã lỗi cho bộ xếp lịch nấu (Scheduler).
 * Nhận vào các định nghĩa bước công thức, trả ra lịch trình với thời điểm bắt đầu/kết thúc và lý do.
 * Bám sát tài liệu docs/plan.md (mục Thuật toán - Xếp lịch nấu) và docs/expected/T04.md.
 * Được gọi bởi các module scheduler/plan.ts, replan.ts, manual-check.ts và ứng dụng mobile/backend.
 */

import type { OptimizationMode } from '../enums.js';
import type { Recipe, RecipeStep } from '../schemas/recipe.js';

export type { OptimizationMode };

/**
 * Mã lý do giải thích cho việc chọn một bước vào lịch trình tại một thời điểm:
 * - 'passive_starts_immediately': bước passive sẵn sàng và dụng cụ rảnh thì bắt đầu chạy nền ngay.
 * - 'only_candidate': chỉ có đúng 1 bước active đủ điều kiện (sẵn sàng và rảnh dụng cụ).
 * - 'largest_tail': chọn bước có đường găng (tail) lớn nhất trong các ứng viên.
 * - 'shares_tool': chọn bước dùng chung dụng cụ với bước active vừa hoàn thành xong (chế độ fewest_tools).
 * - 'tie_by_order': các ứng viên có tail bằng nhau, ưu tiên bước đứng trước theo thứ tự mảng ban đầu.
 */
export type ScheduleReason =
  | 'passive_starts_immediately'
  | 'only_candidate'
  | 'largest_tail'
  | 'shares_tool'
  | 'tie_by_order';

/**
 * Cấu trúc một bước đã được xếp lịch trong kế hoạch nấu ăn:
 * Sử dụng chuẩn snake_case đồng bộ với toàn bộ schema của hệ thống.
 */
export interface ScheduledStep {
  /** Mã định danh của bước nấu (ví dụ: 's1', 's2') */
  step_id: string;
  /** Thời điểm bắt đầu bước, tính bằng giây từ lúc bắt đầu nấu (t = 0) */
  start_at: number;
  /** Thời điểm kết thúc bước, tính bằng giây từ lúc bắt đầu nấu */
  end_at: number;
  /** Lý do thuật toán chọn xếp bước này tại thời điểm trên */
  reason: ScheduleReason;
}

/**
 * Mã lỗi kỹ thuật khi xác thực cấu trúc đồ thị phụ thuộc của công thức nấu:
 * - 'CYCLE': phát hiện vòng lặp chu trình phụ thuộc (ví dụ s1 sau s2 và s2 sau s1).
 * - 'UNKNOWN_DEPENDENCY': bước khai báo phụ thuộc vào một mã bước không tồn tại trong công thức.
 */
export type SchedulerErrorCode = 'CYCLE' | 'UNKNOWN_DEPENDENCY';

/**
 * Lớp lỗi nghiệp vụ ném ra khi công thức không thể xếp lịch do vi phạm đồ thị.
 */
export class SchedulerError extends Error {
  public readonly code: SchedulerErrorCode;

  constructor(code: SchedulerErrorCode, message: string) {
    super(message);
    this.name = 'SchedulerError';
    this.code = code;
  }
}

/**
 * Dữ liệu trạng thái phiên nấu dùng cho tính năng tính lại lịch trình (replan):
 */
export interface ReplanSessionState {
  /** Danh sách các bước đã hoàn thành kèm mốc thời gian hoàn thành thật (giây) */
  done: Record<string, number>;
  /** Danh sách các bước passive đang chạy nền kèm mốc bắt đầu và mốc kết thúc dự kiến */
  running_passive?: Record<string, { start: number; endsAt: number }>;
}

/**
 * Mức độ phản hồi khi người dùng bấm làm một bước lệch kế hoạch:
 * - 'ok': Hợp lệ, cho phép bắt đầu.
 * - 'warn': Cảnh báo có bước phụ thuộc chưa xong, nhưng vẫn cho phép làm.
 * - 'blocked': Bị chặn không cho làm (do bước có quy tắc an toàn mà chưa xác nhận).
 */
export type ManualCheckLevel = 'ok' | 'warn' | 'blocked';

/**
 * Kết quả kiểm tra thao tác người dùng tự bấm làm bước khác kế hoạch:
 */
export type CheckManualStartResult =
  | { level: 'ok' }
  | { level: 'warn'; unmet: string[] }
  | { level: 'blocked'; reason: 'safety_unconfirmed' };

/**
 * Kiểu đầu vào công thức cho hàm plan: chấp nhận đối tượng Recipe đầy đủ hoặc một đối tượng có danh sách steps.
 */
export type RecipeOrSteps = Recipe | { steps: RecipeStep[] };
