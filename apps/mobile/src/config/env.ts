/**
 * File: apps/mobile/src/config/env.ts
 * Làm gì: Đọc cấu hình môi trường (appEnv, apiBaseUrl, cờ cleartext và debug) duy nhất từ
 *         Constants.expoConfig.extra do apps/mobile/app.config.ts nạp khi build.
 * Nhận vào: Constants.expoConfig.extra từ module expo-constants.
 * Trả ra: AppRuntimeConfig đã chuẩn hóa.
 * Ai gọi: AiClient, TelemetryService, App.tsx và bộ kiểm thử t20-config.test.ts.
 * Bám theo: docs/tasks.md mục T20.1, T20.5.
 */

import Constants from 'expo-constants';

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface AppRuntimeConfig {
  appEnv: AppEnvironment;
  apiBaseUrl: string;
  allowCleartextTraffic: boolean;
  isDebugToolsEnabled: boolean;
}

/** Môi trường mặc định an toàn khi chạy kiểm thử hoặc chưa gắn extra tường minh */
const DEFAULT_APP_ENV: AppEnvironment = 'development';

/**
 * Làm gì: Chuẩn hóa chuỗi môi trường từ extra.appEnv về một trong 3 giá trị hợp lệ.
 * Vào: rawEnv (giá trị thô đọc từ Constants.expoConfig.extra).
 * Ra: 'development' | 'staging' | 'production'.
 * Ví dụ: normalizeAppEnvironment('production') -> 'production'; undefined -> 'development'.
 * Gọi bởi: getAppConfig().
 */
export function normalizeAppEnvironment(rawEnv: unknown): AppEnvironment {
  // Chỉ chấp nhận 3 tên môi trường chuẩn; giá trị lạ hoặc thiếu rơi về development an toàn
  if (rawEnv === 'development' || rawEnv === 'staging' || rawEnv === 'production') {
    return rawEnv;
  }
  return DEFAULT_APP_ENV;
}

/**
 * Làm gì: Đọc toàn bộ cấu hình môi trường lúc chạy app chỉ thông qua Constants.expoConfig.extra (T20.1).
 * Vào: Không có.
 * Ra: Đối tượng AppRuntimeConfig gồm appEnv, apiBaseUrl, allowCleartextTraffic, isDebugToolsEnabled.
 * Ví dụ: Khi extra = { appEnv: 'staging', apiBaseUrl: 'https://api.staging.invalid/' }
 *        -> apiBaseUrl trả về 'https://api.staging.invalid'.
 * Gọi bởi: AiClient, TelemetryService, App.tsx và unit test t20-config.test.ts.
 */
export function getAppConfig(): AppRuntimeConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const appEnv = normalizeAppEnvironment(extra.appEnv);
  const rawBaseUrl = typeof extra.apiBaseUrl === 'string' ? extra.apiBaseUrl.trim() : '';
  const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');

  // Chỉ cho phép HTTP không mã hóa và công cụ debug khi môi trường là development (T20.1, T20.5)
  const allowCleartextTraffic =
    typeof extra.allowCleartextTraffic === 'boolean'
      ? extra.allowCleartextTraffic
      : appEnv === 'development';
  const isDebugToolsEnabled =
    typeof extra.isDebugToolsEnabled === 'boolean'
      ? extra.isDebugToolsEnabled
      : appEnv === 'development';

  return {
    appEnv,
    apiBaseUrl,
    allowCleartextTraffic,
    isDebugToolsEnabled,
  };
}

