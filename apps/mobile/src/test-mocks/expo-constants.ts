/**
 * File: apps/mobile/src/test-mocks/expo-constants.ts
 * Làm gì: Mock nhẹ của expo-constants chỉ dùng trong môi trường kiểm thử Vitest (Node),
 *         tránh nạp react-native Flow runtime đồng thời cho phép kiểm thử đọc Constants.expoConfig.extra.
 * Nhận vào: Không có (dùng setMockExpoExtra cho test).
 * Trả ra: Đối tượng mô phỏng Constants.expoConfig.extra.
 * Ai gọi: Chỉ vitest.config.ts alias khi chạy unit test; mã ứng dụng thật luôn nạp expo-constants thật.
 * Bám theo: docs/tasks.md mục T20.1.
 */

export interface MockExpoConstantsShape {
  expoConfig: {
    extra?: Record<string, unknown>;
  } | null;
}

const mockConstants: MockExpoConstantsShape = {
  expoConfig: {
    extra: {
      appEnv: 'development',
      apiBaseUrl: '',
      allowCleartextTraffic: true,
      isDebugToolsEnabled: true,
    },
  },
};

/**
 * Làm gì: Cập nhật expoConfig.extra giả lập trong bộ test Vitest.
 * Vào: extra (đối tượng extra hoặc null để mô phỏng thiếu cấu hình).
 * Ra: Không có.
 * Ví dụ: setMockExpoExtra({ appEnv: 'staging', apiBaseUrl: 'https://staging.example.invalid' }).
 * Gọi bởi: t20-config.test.ts.
 */
export function setMockExpoExtra(extra: Record<string, unknown> | null): void {
  // Nếu truyền null thì gán expoConfig = null để kiểm tra nhánh rơi về mặc định an toàn
  if (extra === null) {
    mockConstants.expoConfig = null;
    return;
  }
  mockConstants.expoConfig = { extra };
}

export default mockConstants;

