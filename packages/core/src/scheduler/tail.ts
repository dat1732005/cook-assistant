/**
 * File: packages/core/src/scheduler/tail.ts
 * Module: @cook/core/scheduler
 *
 * File này chịu trách nhiệm kiểm tra tính hợp lệ của đồ thị bước nấu (phát hiện chu trình, phụ thuộc lạ)
 * và tính toán giá trị đường găng (tail) cho từng bước nấu bằng quy hoạch động.
 * Nhận vào: mảng các bước nấu (RecipeStep[]).
 * Trả ra: Map ánh xạ từ mã bước (step_id) sang giá trị tail tính bằng giây.
 * Bám theo mục "Xếp lịch nấu" trong docs/plan.md:L255 và tài liệu docs/expected/T04.md.
 * Được gọi bởi scheduler/plan.ts và scheduler/replan.ts.
 */

import type { RecipeStep } from '../schemas/recipe.js';
import { SchedulerError } from './types.js';

/**
 * Kiểm tra tính hợp lệ của đồ thị và tính giá trị tail (đường dài nhất từ bước s đến cuối) cho mọi bước.
 *
 * - Làm gì: Duyệt đồ thị phụ thuộc giữa các bước, từ chối công thức có lỗi cấu trúc, và tính tail(s).
 * - Vào: `steps` (mảng RecipeStep[]) - danh sách các bước nấu của công thức.
 * - Ra: Map<string, number> - ánh xạ từ mã bước sang tổng thời lượng đường găng dài nhất từ bước đó tới cuối (giây).
 * - Ném lỗi:
 *   + `SchedulerError('UNKNOWN_DEPENDENCY')`: nếu một bước tham chiếu mã bước không tồn tại trong `after`.
 *   + `SchedulerError('CYCLE')`: nếu có vòng lặp phụ thuộc chu trình giữa các bước.
 * - Ví dụ: Bước A (60s) -> Bước B (30s). tail(B) = 30s; tail(A) = 60s + 30s = 90s.
 * - Gọi bởi: hàm `plan()` và hàm `replan()`.
 * - Gọi tới: các hàm phụ nội bộ kiểm tra chu trình và đệ quy quy hoạch động.
 */
export function computeTails(steps: RecipeStep[]): Map<string, number> {
  // Bước 1: Khởi tạo tập hợp mã bước để tra cứu nhanh sự tồn tại
  const stepIdSet = new Set<string>();
  const stepMap = new Map<string, RecipeStep>();

  // Duyệt qua từng bước để gom danh sách mã định danh
  for (const step of steps) {
    stepIdSet.add(step.id);
    stepMap.set(step.id, step);
  }

  // Bước 2: Kiểm tra lỗi UNKNOWN_DEPENDENCY (phụ thuộc vào bước không tồn tại)
  for (const step of steps) {
    const dependencies = step.after || [];
    // Kiểm tra từng mã phụ thuộc trong after
    for (const depId of dependencies) {
      // Nếu mã phụ thuộc không có trong danh sách bước thì từ chối ngay lập tức
      if (!stepIdSet.has(depId)) {
        throw new SchedulerError(
          'UNKNOWN_DEPENDENCY',
          `Bước "${step.id}" phụ thuộc vào bước không tồn tại: "${depId}".`
        );
      }
    }
  }

  // Bước 3: Xây dựng danh sách kề kế tiếp: successorMap[s] = danh sách các bước t mà t phụ thuộc vào s (t.after chứa s)
  const successorMap = new Map<string, string[]>();
  for (const step of steps) {
    successorMap.set(step.id, []);
  }

  // Duyệt qua các bước để ghi nhận quan hệ xuôi (t đứng sau s)
  for (const step of steps) {
    const dependencies = step.after || [];
    for (const depId of dependencies) {
      // depId là bước đứng trước, step.id là bước đứng sau (kế tiếp)
      const list = successorMap.get(depId);
      if (list) {
        list.push(step.id);
      }
    }
  }

  // Bước 4: Kiểm tra CYCLE (chu trình lặp phụ thuộc) bằng thuật toán DFS 3 màu
  // 0: chưa thăm (WHITE), 1: đang duyệt trong ngăn xếp (GRAY), 2: đã duyệt xong (BLACK)
  const visitState = new Map<string, number>();
  for (const step of steps) {
    visitState.set(step.id, 0);
  }

  // Hàm đệ quy duyệt theo chiều sâu phát hiện cạnh ngược
  function detectCycleDfs(currentId: string): void {
    // Đánh dấu đỉnh hiện tại đang được duyệt trong nhánh DFS
    visitState.set(currentId, 1);

    const successors = successorMap.get(currentId) || [];
    for (const nextId of successors) {
      const state = visitState.get(nextId) || 0;
      // Nếu gặp lại đỉnh đang trong ngăn xếp duyệt -> phát hiện chu trình lặp
      if (state === 1) {
        throw new SchedulerError(
          'CYCLE',
          `Phát hiện chu trình phụ thuộc lặp vô tận liên quan đến bước "${currentId}" và "${nextId}".`
        );
      }
      // Nếu đỉnh chưa được thăm thì duyệt tiếp theo chiều sâu
      if (state === 0) {
        detectCycleDfs(nextId);
      }
    }

    // Hoàn tất nhánh duyệt, đánh dấu đỉnh đã duyệt xong an toàn
    visitState.set(currentId, 2);
  }

  // Duyệt qua toàn bộ các bước để đảm bảo không bỏ sót thành phần liên thông nào
  for (const step of steps) {
    if (visitState.get(step.id) === 0) {
      detectCycleDfs(step.id);
    }
  }

  // Bước 5: Tính tail(s) bằng quy hoạch động có nhớ (Memoization)
  // Công thức: tail(s) = seconds(s) + max(tail(t) với t là các bước đứng sau s)
  const memoTail = new Map<string, number>();

  function getTail(stepId: string): number {
    // Trả về kết quả đã ghi nhớ nếu đã tính trước đó
    if (memoTail.has(stepId)) {
      return memoTail.get(stepId)!;
    }

    const currentStep = stepMap.get(stepId)!;
    const successors = successorMap.get(stepId) || [];

    // Nếu không có bước nào đứng sau thì tail chính bằng thời lượng của bước đó
    if (successors.length === 0) {
      memoTail.set(stepId, currentStep.seconds);
      return currentStep.seconds;
    }

    // Tìm giá trị tail lớn nhất trong các bước kế tiếp đứng sau
    let maxSuccessorTail = 0;
    for (const nextId of successors) {
      const nextTail = getTail(nextId);
      if (nextTail > maxSuccessorTail) {
        maxSuccessorTail = nextTail;
      }
    }

    const totalTail = currentStep.seconds + maxSuccessorTail;
    memoTail.set(stepId, totalTail);
    return totalTail;
  }

  // Tính toán tail cho toàn bộ các bước
  for (const step of steps) {
    getTail(step.id);
  }

  return memoTail;
}
