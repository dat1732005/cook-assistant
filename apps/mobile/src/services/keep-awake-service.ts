/**
 * File: apps/mobile/src/services/keep-awake-service.ts
 * Làm gì: Điều phối vòng đời giữ sáng màn hình bằng expo-keep-awake trong suốt phiên nấu ăn (T20b):
 *         bật khi vào phiên nấu đang chạy, và tắt ngay khi hoàn tất, bỏ dở, thoát màn hình hoặc unmount.
 * Nhận vào: Trạng thái phiên nấu (session_status), tùy chọn giữ sáng của người dùng và trạng thái thoát.
 * Trả ra: Trạng thái giữ sáng mong muốn và các hàm gọi activateKeepAwakeAsync / deactivateKeepAwake an toàn.
 * Ai gọi: CookScreen.tsx và bộ kiểm thử t20b-keep-awake-feedback.test.ts.
 * Bám theo: docs/tasks.md mục T09 và yêu cầu tích hợp T20b.
 */

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { CookSessionStatus } from '@cook/core';

/** Nhãn tag định danh riêng cho khóa giữ sáng màn hình trong phiên nấu ăn */
export const COOK_SESSION_KEEP_AWAKE_TAG = 'cook-session-active';

export interface CookKeepAwakeSyncParams {
  sessionStatus?: CookSessionStatus | null;
  userPreferenceEnabled: boolean;
  isExited?: boolean;
  tag?: string;
}

/**
 * Làm gì: Quyết định có nên giữ sáng màn hình tại thời điểm hiện tại của phiên nấu hay không.
 * Vào: params ({ sessionStatus, userPreferenceEnabled, isExited }).
 * Ra: true nếu phiên đang nấu và người dùng chưa thoát/chưa tắt công tắc giữ sáng; ngược lại false.
 * Ví dụ: { sessionStatus: 'cooking', userPreferenceEnabled: true, isExited: false } -> true;
 *         { sessionStatus: 'done', userPreferenceEnabled: true, isExited: false } -> false.
 * Gọi bởi: syncCookKeepAwake() và bộ kiểm thử đơn vị T20b.
 */
export function shouldKeepScreenAwakeForSession(params: CookKeepAwakeSyncParams): boolean {
  // Thoát sớm tắt giữ sáng nếu người dùng đã rời màn hình nấu hoặc tắt công tắc giữ sáng
  if (params.isExited || !params.userPreferenceEnabled) {
    return false;
  }

  // Nếu phiên nấu đã hoàn tất hoặc bị bỏ dở thì tuyệt đối tắt giữ sáng màn hình
  if (params.sessionStatus === 'done' || params.sessionStatus === 'abandoned') {
    return false;
  }

  // Khi vừa vào màn hình (chưa kịp tạo snapshot) hoặc đang cooking -> bật giữ sáng
  return true;
}

/**
 * Làm gì: Bật giữ sáng màn hình qua expo-keep-awake, bắt lỗi an toàn để không làm treo đồng hồ hẹn giờ.
 * Vào: tag (tùy chọn, mặc định COOK_SESSION_KEEP_AWAKE_TAG).
 * Ra: Promise<boolean> trả true nếu gọi thành công, false nếu thiết bị/nền tảng không hỗ trợ.
 * Gọi bởi: syncCookKeepAwake() và CookScreen.tsx.
 */
export async function enableCookKeepAwake(
  tag: string = COOK_SESSION_KEEP_AWAKE_TAG
): Promise<boolean> {
  try {
    await activateKeepAwakeAsync(tag);
    return true;
  } catch {
    return false;
  }
}

/**
 * Làm gì: Tắt giữ sáng màn hình qua expo-keep-awake khi hoàn tất hoặc thoát phiên nấu.
 * Vào: tag (tùy chọn, mặc định COOK_SESSION_KEEP_AWAKE_TAG).
 * Ra: Promise<boolean> trả true nếu giải phóng thành công, false nếu có ngoại lệ hệ điều hành.
 * Gọi bởi: syncCookKeepAwake() và CookScreen.tsx.
 */
export async function disableCookKeepAwake(
  tag: string = COOK_SESSION_KEEP_AWAKE_TAG
): Promise<boolean> {
  try {
    await deactivateKeepAwake(tag);
    return true;
  } catch {
    return false;
  }
}

/**
 * Làm gì: Đồng bộ trạng thái giữ sáng màn hình thực tế khớp với trạng thái phiên nấu hiện tại.
 * Vào: params (CookKeepAwakeSyncParams gồm sessionStatus, userPreferenceEnabled, isExited, tag).
 * Ra: Promise<boolean> cho biết trạng thái giữ sáng cuối cùng đang bật (true) hay tắt (false).
 * Ví dụ: sessionStatus = 'done' -> gọi deactivateKeepAwake và trả về false.
 * Gọi bởi: CookScreen.tsx mỗi khi snapshot.session_status hoặc isKeepAwakeActive thay đổi.
 */
export async function syncCookKeepAwake(params: CookKeepAwakeSyncParams): Promise<boolean> {
  const targetTag = params.tag ?? COOK_SESSION_KEEP_AWAKE_TAG;
  const shouldBeAwake = shouldKeepScreenAwakeForSession(params);

  // Nhánh 1: phiên đang chạy và cho phép giữ sáng -> kích hoạt keep-awake
  if (shouldBeAwake) {
    await enableCookKeepAwake(targetTag);
    return true;
  }

  // Nhánh 2: phiên đã xong / thoát / tắt công tắc -> giải phóng keep-awake ngay
  await disableCookKeepAwake(targetTag);
  return false;
}

