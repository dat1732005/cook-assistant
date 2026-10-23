/**
 * File: packages/core/src/scheduler/replan.ts
 * Module: @cook/core/scheduler
 *
 * File này triển khai thuật toán tính lại lịch trình (replan) khi người dùng hoàn thành bước sớm hoặc muộn.
 * Nhận vào: công thức món ăn, trạng thái phiên nấu hiện tại (các bước đã xong, các bước passive đang chạy),
 *           thời điểm thực tế (now) và tiêu chí tối ưu.
 * Trả ra: danh sách lịch trình mới cho các bước chưa thực hiện từ thời điểm now trở đi.
 * Bám theo mục "Xếp lịch nấu" trong docs/plan.md:L267 và ca kiểm thử Ca G trong docs/expected/T04.md.
 * Được gọi bởi controller phiên nấu khi người dùng bấm hoàn thành một bước.
 */

import type { RecipeStep } from '../schemas/recipe.js';
import { computeTails } from './tail.js';
import type {
  OptimizationMode,
  RecipeOrSteps,
  ReplanSessionState,
  ScheduledStep,
  ScheduleReason,
} from './types.js';

/**
 * Tính lại lịch trình nấu cho các bước còn lại từ thời điểm thực tế (now).
 *
 * - Làm gì: Giữ nguyên endsAt của các bước passive đang chạy nền; xếp lại lịch các bước chưa chạy từ mốc now.
 * - Vào:
 *   + `recipeOrSteps`: Công thức món ăn hoặc đối tượng chứa mảng RecipeStep[].
 *   + `sessionState`: Trạng thái phiên hiện tại (done: Map/Record các bước đã xong kèm giờ xong; running_passive: các bước passive đang đếm).
 *   + `now`: Thời điểm thực tế hiện tại tính bằng giây (ví dụ: 90, 40, 400).
 *   + `mode`: Tiêu chí tối ưu ('fastest' | 'fewest_tools').
 * - Ra: Mảng ScheduledStep[] cho các bước chưa thực hiện từ thời điểm now trở đi.
 * - Ví dụ: Kịch bản G1: B xong muộn lúc 90s, A đang chạy giữ nguyên endsAt = 300s -> C chạy 90-150s, D chạy 300-330s.
 * - Gọi bởi: Logic điều khiển phiên nấu CookSession khi người dùng bấm Xong.
 * - Gọi tới: `computeTails()`.
 */
export function replan(
  recipeOrSteps: RecipeOrSteps,
  sessionState: ReplanSessionState,
  now: number,
  mode: OptimizationMode = 'fastest'
): ScheduledStep[] {
  const steps: RecipeStep[] = 'steps' in recipeOrSteps ? recipeOrSteps.steps : [];
  if (steps.length === 0) {
    return [];
  }

  // Bước 1: Tính tail cho toàn bộ đồ thị bước
  const tails = computeTails(steps);

  // Bước 2: Khởi tạo trạng thái mô phỏng bắt đầu từ thời điểm thực tế now
  let currentTime = now;
  const completedSteps = new Map<string, number>();

  // Nạp danh sách các bước đã hoàn thành trong quá khứ
  if (sessionState.done) {
    for (const [id, finishTime] of Object.entries(sessionState.done)) {
      completedSteps.set(id, finishTime);
    }
  }

  // Nạp danh sách các bước passive đang chạy (giữ nguyên endsAt tuyệt đối theo yêu cầu)
  const runningPassive: Array<{
    step: RecipeStep;
    start_at: number;
    end_at: number;
    reason: ScheduleReason;
  }> = [];

  const initialRunningPassiveIds = new Set<string>();

  if (sessionState.running_passive) {
    for (const [id, pInfo] of Object.entries(sessionState.running_passive)) {
      const stepObj = steps.find((s) => s.id === id);
      if (stepObj) {
        initialRunningPassiveIds.add(id);
        // Nếu bước passive này đã hoàn thành tại hoặc trước now thì ghi nhận đã xong
        if (pInfo.endsAt <= now) {
          completedSteps.set(id, pInfo.endsAt);
        } else {
          runningPassive.push({
            step: stepObj,
            start_at: pInfo.start,
            end_at: pInfo.endsAt, // Giữ nguyên endsAt
            reason: 'passive_starts_immediately',
          });
        }
      }
    }
  }

  let runningActive: {
    step: RecipeStep;
    start_at: number;
    end_at: number;
    reason: ScheduleReason;
  } | null = null;

  let lastActiveResources = new Set<string>();
  const newlyScheduledSteps: ScheduledStep[] = [];

  // Vòng lặp mô phỏng xếp lịch từ currentTime = now
  while (completedSteps.size < steps.length) {
    // ------------------------------------------------------------------------
    // Giai đoạn 1: Cập nhật các bước vừa kết thúc tại currentTime
    // ------------------------------------------------------------------------
    if (runningActive !== null && runningActive.end_at <= currentTime) {
      completedSteps.set(runningActive.step.id, runningActive.end_at);
      lastActiveResources = new Set(runningActive.step.resources || []);
      runningActive = null;
    }

    for (let i = runningPassive.length - 1; i >= 0; i--) {
      const p = runningPassive[i];
      if (p && p.end_at <= currentTime) {
        completedSteps.set(p.step.id, p.end_at);
        runningPassive.splice(i, 1);
      }
    }

    if (completedSteps.size === steps.length) {
      break;
    }

    // ------------------------------------------------------------------------
    // Giai đoạn 2: Tập hợp dụng cụ đang bị chiếm dụng
    // ------------------------------------------------------------------------
    const occupiedTools = new Set<string>();
    if (runningActive !== null) {
      for (const tool of runningActive.step.resources || []) {
        occupiedTools.add(tool);
      }
    }
    for (const p of runningPassive) {
      for (const tool of p.step.resources || []) {
        occupiedTools.add(tool);
      }
    }

    // ------------------------------------------------------------------------
    // Giai đoạn 3: Bắt đầu các bước passive mới sẵn sàng
    // ------------------------------------------------------------------------
    for (const step of steps) {
      if (
        step.kind === 'passive' &&
        !completedSteps.has(step.id) &&
        !runningPassive.some((p) => p.step.id === step.id) &&
        !initialRunningPassiveIds.has(step.id)
      ) {
        const isDependencyMet = (step.after || []).every((depId: string) =>
          completedSteps.has(depId)
        );

        if (isDependencyMet) {
          const isToolFree = (step.resources || []).every(
            (tool: string) => !occupiedTools.has(tool)
          );

          if (isToolFree) {
            const startAt = currentTime;
            const endAt = currentTime + step.seconds;
            const reason: ScheduleReason = 'passive_starts_immediately';

            runningPassive.push({
              step,
              start_at: startAt,
              end_at: endAt,
              reason,
            });

            newlyScheduledSteps.push({
              step_id: step.id,
              start_at: startAt,
              end_at: endAt,
              reason,
            });

            for (const tool of step.resources || []) {
              occupiedTools.add(tool);
            }
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // Giai đoạn 4: Bắt đầu bước active nếu người nấu đang rảnh
    // ------------------------------------------------------------------------
    if (runningActive === null) {
      const activeCandidates: RecipeStep[] = [];

      for (const step of steps) {
        if (
          step.kind === 'active' &&
          !completedSteps.has(step.id)
        ) {
          const isDependencyMet = (step.after || []).every((depId: string) =>
            completedSteps.has(depId)
          );

          if (isDependencyMet) {
            const isToolFree = (step.resources || []).every(
              (tool: string) => !occupiedTools.has(tool)
            );

            if (isToolFree) {
              activeCandidates.push(step);
            }
          }
        }
      }

      if (activeCandidates.length > 0) {
        let chosenStep: RecipeStep;
        let chosenReason: ScheduleReason;

        if (activeCandidates.length === 1 && activeCandidates[0]) {
          chosenStep = activeCandidates[0];
          chosenReason = 'only_candidate';
        } else {
          let eligiblePool = activeCandidates;
          let isSharesToolSelected = false;

          if (mode === 'fewest_tools' && lastActiveResources.size > 0) {
            const sharingCandidates = activeCandidates.filter((cand) =>
              (cand.resources || []).some((tool: string) => lastActiveResources.has(tool))
            );

            if (sharingCandidates.length > 0) {
              eligiblePool = sharingCandidates;
              isSharesToolSelected = true;
            }
          }

          let maxTail = -1;
          for (const cand of eligiblePool) {
            const tailValue = tails.get(cand.id) || 0;
            if (tailValue > maxTail) {
              maxTail = tailValue;
            }
          }

          const topCandidates = eligiblePool.filter(
            (cand) => (tails.get(cand.id) || 0) === maxTail
          );

          chosenStep = topCandidates[0]!;

          if (isSharesToolSelected) {
            chosenReason = 'shares_tool';
          } else if (topCandidates.length > 1) {
            chosenReason = 'tie_by_order';
          } else {
            chosenReason = 'largest_tail';
          }
        }

        const startAt = currentTime;
        const endAt = currentTime + chosenStep.seconds;

        runningActive = {
          step: chosenStep,
          start_at: startAt,
          end_at: endAt,
          reason: chosenReason,
        };

        newlyScheduledSteps.push({
          step_id: chosenStep.id,
          start_at: startAt,
          end_at: endAt,
          reason: chosenReason,
        });

        for (const tool of chosenStep.resources || []) {
          occupiedTools.add(tool);
        }
      }
    }

    // ------------------------------------------------------------------------
    // Giai đoạn 5: Nhảy currentTime đến mốc kết thúc kế tiếp
    // ------------------------------------------------------------------------
    if (completedSteps.size < steps.length) {
      const futureEndTimes: number[] = [];

      if (runningActive !== null && runningActive.end_at > currentTime) {
        futureEndTimes.push(runningActive.end_at);
      }

      for (const p of runningPassive) {
        if (p.end_at > currentTime) {
          futureEndTimes.push(p.end_at);
        }
      }

      if (futureEndTimes.length > 0) {
        currentTime = Math.min(...futureEndTimes);
      } else {
        break;
      }
    }
  }

  return newlyScheduledSteps;
}
