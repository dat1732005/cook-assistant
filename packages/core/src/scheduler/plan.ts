/**
 * File: packages/core/src/scheduler/plan.ts
 * Module: @cook/core/scheduler
 *
 * File này triển khai thuật toán xếp lịch nấu ăn (Scheduler) mô phỏng dòng thời gian thực tế.
 * Nhận vào: công thức (Recipe hoặc danh sách steps), số phần ăn (servings) và tiêu chí tối ưu ('fastest' | 'fewest_tools').
 * Trả ra: danh sách các bước đã được ấn định thời gian bắt đầu, kết thúc và lý do chọn (ScheduledStep[]).
 * Bám theo mục "Xếp lịch nấu" trong docs/plan.md:L250-271 và quy ước trong docs/expected/T04.md.
 * Được gọi bởi controller nấu ăn, dịch vụ backend hoặc các bộ test.
 */

import type { RecipeStep } from '../schemas/recipe.js';
import { computeTails } from './tail.js';
import type {
  OptimizationMode,
  RecipeOrSteps,
  ScheduledStep,
  ScheduleReason,
} from './types.js';

/**
 * Xếp lịch trình nấu ăn từ các bước có cấu trúc của công thức theo tiêu chí tối ưu.
 *
 * - Làm gì: Mô phỏng người nấu thao tác theo trục thời gian (t tính bằng giây từ 0).
 *   Tận dụng việc bước passive chạy nền để người nấu làm bước active khác; mỗi dụng cụ chỉ phục vụ một việc tại một thời điểm.
 * - Vào:
 *   + `recipeOrSteps`: Công thức chứa mảng các bước (RecipeStep[]).
 *   + `servings`: Số phần ăn (ở MVP, thời lượng các bước giữ nguyên không đổi theo T04.8).
 *   + `mode`: Tiêu chí tối ưu ('fastest': nhanh nhất, hoặc 'fewest_tools': ít đổi dụng cụ nhất).
 * - Ra: Mảng ScheduledStep[] chứa mốc thời gian bắt đầu, kết thúc và lý do cho từng bước.
 * - Ném lỗi:
 *   + `SchedulerError('CYCLE')`: nếu phát hiện vòng lặp phụ thuộc chu trình.
 *   + `SchedulerError('UNKNOWN_DEPENDENCY')`: nếu bước phụ thuộc vào mã bước không có trong công thức.
 * - Ví dụ: Món trứng chiên cà chua (5 bước active) chạy tuần tự đạt tổng 690s cho cả hai chế độ.
 * - Gọi bởi: Ứng dụng di động khi bắt đầu phiên nấu, bộ kiểm thử tự động.
 * - Gọi tới: `computeTails()` để kiểm tra đồ thị và tính giá trị đường găng tail.
 */
export function plan(
  recipeOrSteps: RecipeOrSteps,
  _servings: number,
  mode: OptimizationMode = 'fastest'
): ScheduledStep[] {
  // Ở phiên bản MVP (T04.8), thời lượng các bước giữ nguyên không phụ thuộc số phần ăn (_servings)
  void _servings;
  // Trích xuất danh sách bước từ công thức hoặc đối tượng chứa steps
  const steps: RecipeStep[] = 'steps' in recipeOrSteps ? recipeOrSteps.steps : [];

  // Trường hợp công thức không có bước nào thì trả về lịch rỗng
  if (steps.length === 0) {
    return [];
  }

  // Bước 1: Xác thực đồ thị và tính giá trị tail cho toàn bộ các bước
  // Hàm computeTails sẽ tự động ném SchedulerError nếu phát hiện CYCLE hoặc UNKNOWN_DEPENDENCY
  const tails = computeTails(steps);

  // Bước 2: Khởi tạo trạng thái mô phỏng theo thời gian
  let currentTime = 0; // Trục thời gian tính bằng giây từ lúc bắt đầu (t = 0)
  const completedSteps = new Map<string, number>(); // stepId -> thời điểm hoàn thành (giây)
  let runningActive: {
    step: RecipeStep;
    start_at: number;
    end_at: number;
    reason: ScheduleReason;
  } | null = null;
  const runningPassive: Array<{
    step: RecipeStep;
    start_at: number;
    end_at: number;
    reason: ScheduleReason;
  }> = [];
  let lastActiveResources = new Set<string>(); // Tập dụng cụ của bước active gần nhất vừa làm xong
  const scheduledResults: ScheduledStep[] = [];

  // Vòng lặp mô phỏng: tiếp tục chừng nào vẫn còn bước chưa hoàn thành
  while (completedSteps.size < steps.length) {
    // ------------------------------------------------------------------------
    // Giai đoạn 1: Cập nhật các bước vừa kết thúc tại thời điểm hiện tại currentTime
    // ------------------------------------------------------------------------
    // Kiểm tra nếu bước active đang chạy đã kết thúc tại hoặc trước currentTime
    if (runningActive !== null && runningActive.end_at <= currentTime) {
      completedSteps.set(runningActive.step.id, runningActive.end_at);
      // Ghi nhận tập dụng cụ vừa sử dụng để phục vụ chế độ fewest_tools
      lastActiveResources = new Set(runningActive.step.resources || []);
      runningActive = null;
    }

    // Kiểm tra và thu hồi các bước passive đã kết thúc tại hoặc trước currentTime
    for (let i = runningPassive.length - 1; i >= 0; i--) {
      const p = runningPassive[i];
      if (p && p.end_at <= currentTime) {
        completedSteps.set(p.step.id, p.end_at);
        runningPassive.splice(i, 1);
      }
    }

    // Nếu toàn bộ các bước đã hoàn thành xong thì dừng mô phỏng
    if (completedSteps.size === steps.length) {
      break;
    }

    // ------------------------------------------------------------------------
    // Giai đoạn 2: Xác định tập hợp dụng cụ đang bị chiếm dụng tại currentTime
    // ------------------------------------------------------------------------
    const occupiedTools = new Set<string>();
    // Dụng cụ bị chiếm bởi bước active đang chạy
    if (runningActive !== null) {
      for (const tool of runningActive.step.resources || []) {
        occupiedTools.add(tool);
      }
    }
    // Dụng cụ bị chiếm bởi các bước passive đang đếm giờ
    for (const p of runningPassive) {
      for (const tool of p.step.resources || []) {
        occupiedTools.add(tool);
      }
    }

    // ------------------------------------------------------------------------
    // Giai đoạn 3: Xử lý các bước PASSIVE sẵn sàng (Quy ước 3a)
    // Bước passive bắt đầu ngay khi sẵn sàng và dụng cụ rảnh, theo thứ tự ban đầu
    // ------------------------------------------------------------------------
    for (const step of steps) {
      // Chỉ xét các bước thuộc loại passive chưa hoàn thành và chưa đang chạy
      if (
        step.kind === 'passive' &&
        !completedSteps.has(step.id) &&
        !runningPassive.some((p) => p.step.id === step.id)
      ) {
        // Kiểm tra điều kiện phụ thuộc: mọi bước trong after đã hoàn thành
        const isDependencyMet = (step.after || []).every((depId: string) =>
          completedSteps.has(depId)
        );

        if (isDependencyMet) {
          // Kiểm tra dụng cụ có hoàn toàn rảnh không
          const isToolFree = (step.resources || []).every(
            (tool: string) => !occupiedTools.has(tool)
          );

          if (isToolFree) {
            // Bước passive đủ điều kiện: khởi chạy ngay tại currentTime
            const startAt = currentTime;
            const endAt = currentTime + step.seconds;
            const reason: ScheduleReason = 'passive_starts_immediately';

            runningPassive.push({
              step,
              start_at: startAt,
              end_at: endAt,
              reason,
            });

            scheduledResults.push({
              step_id: step.id,
              start_at: startAt,
              end_at: endAt,
              reason,
            });

            // Đánh dấu dụng cụ của bước passive này đã bị chiếm ngay lập tức
            for (const tool of step.resources || []) {
              occupiedTools.add(tool);
            }
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // Giai đoạn 4: Xử lý bước ACTIVE nếu người nấu đang rảnh (Quy ước 3b)
    // ------------------------------------------------------------------------
    if (runningActive === null) {
      // Gom danh sách tất cả các bước active sẵn sàng mà toàn bộ dụng cụ đều rảnh
      const activeCandidates: RecipeStep[] = [];

      for (const step of steps) {
        if (
          step.kind === 'active' &&
          !completedSteps.has(step.id)
        ) {
          // Kiểm tra điều kiện phụ thuộc after
          const isDependencyMet = (step.after || []).every((depId: string) =>
            completedSteps.has(depId)
          );

          if (isDependencyMet) {
            // Kiểm tra dụng cụ của bước active có đang rảnh không
            const isToolFree = (step.resources || []).every(
              (tool: string) => !occupiedTools.has(tool)
            );

            if (isToolFree) {
              activeCandidates.push(step);
            }
          }
        }
      }

      // Nếu có ít nhất một bước active có thể thực hiện
      if (activeCandidates.length > 0) {
        let chosenStep: RecipeStep;
        let chosenReason: ScheduleReason;

        // Tình huống 1: Chỉ có đúng 1 ứng viên hợp lệ
        if (activeCandidates.length === 1 && activeCandidates[0]) {
          chosenStep = activeCandidates[0];
          chosenReason = 'only_candidate';
        } else {
          // Tình huống 2: Có nhiều ứng viên tranh chấp lượt làm của người nấu
          let eligiblePool = activeCandidates;
          let isSharesToolSelected = false;

          // Nếu ở chế độ fewest_tools, ưu tiên bước dùng chung dụng cụ với bước active trước
          if (mode === 'fewest_tools' && lastActiveResources.size > 0) {
            const sharingCandidates = activeCandidates.filter((cand) =>
              (cand.resources || []).some((tool: string) => lastActiveResources.has(tool))
            );

            // Nếu có ứng viên dùng chung dụng cụ thì chỉ xét tập này
            if (sharingCandidates.length > 0) {
              eligiblePool = sharingCandidates;
              isSharesToolSelected = true;
            }
          }

          // Tìm giá trị tail lớn nhất trong tập ứng viên được xem xét
          let maxTail = -1;
          for (const cand of eligiblePool) {
            const tailValue = tails.get(cand.id) || 0;
            if (tailValue > maxTail) {
              maxTail = tailValue;
            }
          }

          // Lọc ra các ứng viên cùng đạt giá trị tail lớn nhất
          const topCandidates = eligiblePool.filter(
            (cand) => (tails.get(cand.id) || 0) === maxTail
          );

          // Chọn ứng viên đứng trước trong mảng steps ban đầu
          chosenStep = topCandidates[0]!;

          // Xác định mã lý do chính xác theo quy ước
          if (isSharesToolSelected) {
            chosenReason = 'shares_tool';
          } else if (topCandidates.length > 1) {
            // Có nhiều ứng viên hòa tail -> chọn theo thứ tự ban đầu
            chosenReason = 'tie_by_order';
          } else {
            // Chỉ có 1 ứng viên đạt tail lớn nhất duy nhất
            chosenReason = 'largest_tail';
          }
        }

        // Bắt đầu bước active đã được chọn
        const startAt = currentTime;
        const endAt = currentTime + chosenStep.seconds;

        runningActive = {
          step: chosenStep,
          start_at: startAt,
          end_at: endAt,
          reason: chosenReason,
        };

        scheduledResults.push({
          step_id: chosenStep.id,
          start_at: startAt,
          end_at: endAt,
          reason: chosenReason,
        });

        // Đánh dấu dụng cụ của bước active đã bị chiếm
        for (const tool of chosenStep.resources || []) {
          occupiedTools.add(tool);
        }
      }
    }

    // ------------------------------------------------------------------------
    // Giai đoạn 5: Nhảy trục thời gian currentTime tới mốc kế tiếp (Quy ước 3c)
    // ------------------------------------------------------------------------
    if (completedSteps.size < steps.length) {
      const futureEndTimes: number[] = [];

      // Mốc kết thúc của bước active đang chạy
      if (runningActive !== null && runningActive.end_at > currentTime) {
        futureEndTimes.push(runningActive.end_at);
      }

      // Mốc kết thúc của các bước passive đang chạy
      for (const p of runningPassive) {
        if (p.end_at > currentTime) {
          futureEndTimes.push(p.end_at);
        }
      }

      // Nếu có mốc kết thúc trong tương lai thì nhảy currentTime đến mốc sớm nhất
      if (futureEndTimes.length > 0) {
        currentTime = Math.min(...futureEndTimes);
      } else {
        // Nếu không có bất kỳ bước nào đang chạy mà vẫn còn bước chưa xong
        // Trường hợp này không thể tự giải phóng được (deadlock tài nguyên)
        break;
      }
    }
  }

  return scheduledResults;
}
