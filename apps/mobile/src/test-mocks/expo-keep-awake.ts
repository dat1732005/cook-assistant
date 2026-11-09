/**
 * File: apps/mobile/src/test-mocks/expo-keep-awake.ts
 * Làm gì: Mock nhẹ thư viện expo-keep-awake phục vụ kiểm thử Vitest trên Node (T20b),
 *         ghi nhận đầy đủ các lượt gọi activateKeepAwakeAsync và deactivateKeepAwake theo tag.
 * Nhận vào: Tag tùy chọn (mặc định ExpoKeepAwakeDefaultTag).
 * Trả ra: Trạng thái bật/tắt giữ sáng màn hình và nhật ký lệnh gọi cho unit test đối chiếu.
 * Ai gọi: vitest.config.ts alias khi chạy test trong apps/mobile/src/.
 * Bám theo: Yêu cầu T20b tích hợp expo-keep-awake và kiểm thử bằng bản giả.
 */

export const ExpoKeepAwakeTag = 'ExpoKeepAwakeDefaultTag';

export interface KeepAwakeCallRecord {
  action: 'activate' | 'deactivate';
  tag: string;
}

const activeTags = new Set<string>();
const callHistory: KeepAwakeCallRecord[] = [];

/**
 * Làm gì: Cho biết tính năng giữ sáng màn hình khả dụng trên nền tảng giả lập.
 * Vào: Không có.
 * Ra: Promise<boolean> luôn trả về true.
 * Gọi bởi: Mã ứng dụng hoặc unit test.
 */
export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

/**
 * Làm gì: Mô phỏng kích hoạt giữ sáng màn hình với tag chỉ định.
 * Vào: tag (tùy chọn, mặc định ExpoKeepAwakeTag).
 * Ra: Promise<void>.
 * Gọi bởi: keep-awake-service.ts và CookScreen khi vào phiên nấu.
 */
export async function activateKeepAwakeAsync(tag: string = ExpoKeepAwakeTag): Promise<void> {
  activeTags.add(tag);
  callHistory.push({ action: 'activate', tag });
}

/**
 * Làm gì: Hàm tương thích ngược mô phỏng activateKeepAwake.
 * Vào: tag (tùy chọn).
 * Ra: Promise<void>.
 * Gọi bởi: Mã gọi bản API cũ (nếu có).
 */
export async function activateKeepAwake(tag: string = ExpoKeepAwakeTag): Promise<void> {
  await activateKeepAwakeAsync(tag);
}

/**
 * Làm gì: Mô phỏng tắt giữ sáng màn hình cho tag chỉ định.
 * Vào: tag (tùy chọn, mặc định ExpoKeepAwakeTag).
 * Ra: Promise<void>.
 * Gọi bởi: keep-awake-service.ts và CookScreen khi hoàn tất hoặc thoát phiên nấu.
 */
export async function deactivateKeepAwake(tag: string = ExpoKeepAwakeTag): Promise<void> {
  activeTags.delete(tag);
  callHistory.push({ action: 'deactivate', tag });
}

/**
 * Làm gì: Hook giả lập useKeepAwake trong môi trường kiểm thử Node.
 * Vào: _tag (tùy chọn).
 * Ra: Không có.
 * Gọi bởi: Kiểm thử đơn vị.
 */
export function useKeepAwake(_tag: string = ExpoKeepAwakeTag): void {
  // No-op trong môi trường mock Vitest Node
}

/**
 * Làm gì: Xóa toàn bộ trạng thái và lịch sử gọi keep-awake giả giữa các test case.
 * Vào: Không có.
 * Ra: Không có.
 * Gọi bởi: Bộ kiểm thử t20b-keep-awake-feedback.test.ts.
 */
export function resetKeepAwakeMock(): void {
  activeTags.clear();
  callHistory.length = 0;
}

/**
 * Làm gì: Kiểm tra một tag giữ sáng màn hình hiện đang bật hay đã tắt trong bản giả.
 * Vào: tag (mặc định ExpoKeepAwakeTag).
 * Ra: true nếu tag đang được giữ sáng, false nếu đã tắt.
 * Gọi bởi: Bộ kiểm thử T20b.
 */
export function isKeepAwakeActiveForTest(tag: string = ExpoKeepAwakeTag): boolean {
  return activeTags.has(tag);
}

/**
 * Làm gì: Lấy bản sao nhật ký các lần bật/tắt giữ sáng để đối chiếu thứ tự vòng đời.
 * Vào: Không có.
 * Ra: Mảng KeepAwakeCallRecord theo đúng thứ tự thời gian gọi.
 * Gọi bởi: Bộ kiểm thử T20b.
 */
export function getKeepAwakeHistoryForTest(): KeepAwakeCallRecord[] {
  return [...callHistory];
}

