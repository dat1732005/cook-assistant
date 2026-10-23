/**
 * File: packages/core/src/scheduler/manual-check.ts
 * Module: @cook/core/scheduler
 *
 * File này triển khai hàm kiểm tra khi người dùng tự ý bấm bắt đầu một bước khác với gợi ý của kế hoạch.
 * Nhận vào: công thức món ăn, mã bước muốn bắt đầu, danh sách các bước đã hoàn thành và trạng thái xác nhận an toàn.
 * Trả ra: kết quả kiểm tra gồm mức độ ('ok', 'warn', 'blocked') kèm danh sách phụ thuộc chưa xong hoặc lý do chặn.
 * Bám theo mục "Xếp lịch nấu" trong docs/plan.md:L268 và ca kiểm thử Ca H trong docs/expected/T04.md.
 * Được gọi bởi giao diện nấu ăn khi người dùng chọn một bước bất kỳ ngoài khối "Bây giờ làm".
 */

import type { RecipeStep } from '../schemas/recipe.js';
import type { CheckManualStartResult, RecipeOrSteps } from './types.js';

/**
 * Kiểm tra xem người dùng có được phép bắt đầu một bước nấu khi làm lệch kế hoạch hay không.
 *
 * - Làm gì:
 *   + (1) Chặn (blocked) nếu bước có quy tắc an toàn (safety_rule) mà người dùng chưa bấm xác nhận.
 *   + (2) Cảnh báo (warn) nếu còn bước phụ thuộc trong `after` chưa hoàn thành, kèm danh sách bước chưa xong theo thứ tự.
 *   + (3) Hợp lệ (ok) nếu mọi phụ thuộc đã xong và không vi phạm an toàn.
 * - Vào:
 *   + `recipeOrSteps`: Công thức món ăn hoặc đối tượng chứa mảng RecipeStep[].
 *   + `stepId`: Mã bước người dùng muốn bắt đầu (ví dụ: 'D', 'C').
 *   + `doneSteps`: Mảng các mã bước đã hoàn thành (string[]) hoặc Set<string>.
 *   + `safetyConfirmed`: Người dùng đã bấm xác nhận quy tắc an toàn cho bước này hay chưa (boolean).
 * - Ra: CheckManualStartResult:
 *   + `{ level: 'ok' }`
 *   + `{ level: 'warn', unmet: string[] }`
 *   + `{ level: 'blocked', reason: 'safety_unconfirmed' }`
 * - Ví dụ: Bước D phụ thuộc A và C. A và C chưa xong -> trả về { level: 'warn', unmet: ['A', 'C'] }.
 *          Nếu D có safety_rule mà safetyConfirmed là false -> trả về { level: 'blocked', reason: 'safety_unconfirmed' }.
 * - Gọi bởi: Màn hình Nấu (Cook screen) khi người dùng bấm vào một bước bất kỳ.
 */
export function checkManualStart(
  recipeOrSteps: RecipeOrSteps,
  stepId: string,
  doneSteps: string[] | Set<string>,
  safetyConfirmed: boolean = false
): CheckManualStartResult {
  const steps: RecipeStep[] = 'steps' in recipeOrSteps ? recipeOrSteps.steps : [];
  const targetStep = steps.find((s) => s.id === stepId);

  // Nếu không tìm thấy bước thì coi như không hợp lệ
  if (!targetStep) {
    return { level: 'warn', unmet: [stepId] };
  }

  // Chuyển danh sách các bước đã xong sang Set để tra cứu O(1)
  const doneSet = doneSteps instanceof Set ? doneSteps : new Set(doneSteps);

  // ------------------------------------------------------------------------
  // Quy tắc 1: Kiểm tra quy tắc an toàn (Bắt buộc chặn nếu chưa xác nhận)
  // ------------------------------------------------------------------------
  // Nếu bước này có gắn mã an toàn mà người dùng chưa bấm xác nhận
  if (targetStep.safety_rule && !safetyConfirmed) {
    return {
      level: 'blocked',
      reason: 'safety_unconfirmed',
    };
  }

  // ------------------------------------------------------------------------
  // Quy tắc 2: Kiểm tra các bước phụ thuộc trong after
  // ------------------------------------------------------------------------
  const unmetDependencies: string[] = [];
  const dependencies = targetStep.after || [];

  // Duyệt qua các bước phụ thuộc theo đúng thứ tự khai báo trong mảng after
  for (const depId of dependencies) {
    // Nếu bước phụ thuộc chưa nằm trong danh sách đã xong
    if (!doneSet.has(depId)) {
      unmetDependencies.push(depId);
    }
  }

  // Nếu còn ít nhất một bước phụ thuộc chưa xong thì phát cảnh báo kèm danh sách
  if (unmetDependencies.length > 0) {
    return {
      level: 'warn',
      unmet: unmetDependencies,
    };
  }

  // ------------------------------------------------------------------------
  // Quy tắc 3: Tất cả điều kiện đều thỏa mãn -> Cho phép thực hiện
  // ------------------------------------------------------------------------
  return {
    level: 'ok',
  };
}
