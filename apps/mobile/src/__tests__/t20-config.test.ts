/**
 * File: apps/mobile/src/__tests__/t20-config.test.ts
 * Làm gì: Kiểm thử toàn bộ cấu hình build Android T20: 3 môi trường development/staging/production,
 *         quy tắc applicationId tạm, kiểm tra API_BASE_URL, quyền Android, eas.json, placeholder assets
 *         và đọc cấu hình duy nhất qua Constants.expoConfig.extra.
 * Nhận vào: app.config.ts, eas.json, babel.config.js, env.ts, AiClient, TelemetryService và mock expo-constants.
 * Trả ra: Bộ test đơn vị và các ca sai bắt buộc của T20.
 * Ai gọi: Vitest (`pnpm test`, `pnpm verify`).
 * Bám theo: docs/tasks.md mục T20.1 - T20.5.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TEMPORARY_APPLICATION_ID,
  REQUIRED_ANDROID_PERMISSIONS,
  BLOCKED_ANDROID_PERMISSIONS,
  resolveBuildEnvironment,
  buildExpoConfig,
} from '../../app.config.js';
import { getAppConfig } from '../config/env.js';
import { AiClient } from '../services/ai-client.js';
import { TelemetryService } from '../services/telemetry-service.js';
import { setMockExpoExtra } from '../test-mocks/expo-constants.js';

const require = createRequire(import.meta.url);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRootDir = path.resolve(currentDir, '../..');

describe('T20: Cấu hình môi trường, EAS, quyền Android và Constants.expoConfig.extra', () => {
  beforeEach(() => {
    setMockExpoExtra({
      appEnv: 'development',
      apiBaseUrl: '',
      allowCleartextTraffic: true,
      isDebugToolsEnabled: true,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Môi trường development: cho phép chạy với applicationId tạm, không cần API_BASE_URL và bật cleartext/debug', () => {
    const config = buildExpoConfig({ env: {} });

    expect(config.android?.package).toBe(TEMPORARY_APPLICATION_ID);
    expect(config.android?.versionCode).toBe(1);
    expect(config.extra?.appEnv).toBe('development');
    expect(config.extra?.apiBaseUrl).toBe('');
    expect(config.extra?.allowCleartextTraffic).toBe(true);
    expect(config.extra?.isDebugToolsEnabled).toBe(true);

    const devWithLocalBackend = buildExpoConfig({
      env: {
        EAS_BUILD_PROFILE: 'development',
        API_BASE_URL: 'http://localhost:8080/',
      },
    });
    expect(devWithLocalBackend.extra?.appEnv).toBe('development');
    expect(devWithLocalBackend.extra?.apiBaseUrl).toBe('http://localhost:8080');
    expect(devWithLocalBackend.extra?.allowCleartextTraffic).toBe(true);
  });

  it('Ánh xạ EAS_BUILD_PROFILE=preview -> staging, chặn cleartext, cho phép applicationId tạm khi có API_BASE_URL', () => {
    const previewConfig = buildExpoConfig({
      env: {
        EAS_BUILD_PROFILE: 'preview',
        API_BASE_URL: 'https://staging.example.invalid/',
      },
    });

    expect(previewConfig.android?.package).toBe(TEMPORARY_APPLICATION_ID);
    expect(previewConfig.extra?.appEnv).toBe('staging');
    expect(previewConfig.extra?.apiBaseUrl).toBe('https://staging.example.invalid');
    expect(previewConfig.extra?.allowCleartextTraffic).toBe(false);
    expect(previewConfig.extra?.isDebugToolsEnabled).toBe(false);
  });

  it('CA SAI BẮT BUỘC: build production phải THẤT BẠI nếu applicationId vẫn là giá trị tạm', () => {
    expect(() =>
      buildExpoConfig({
        env: {
          EAS_BUILD_PROFILE: 'production',
          APP_ENV: 'production',
          API_BASE_URL: 'https://api.example.invalid',
        },
      })
    ).toThrow(new RegExp(TEMPORARY_APPLICATION_ID));
  });

  it('CA SAI BẮT BUỘC: staging và production đều phải THẤT BẠI nếu thiếu API_BASE_URL; production bắt buộc https://', () => {
    expect(() =>
      buildExpoConfig({
        env: { EAS_BUILD_PROFILE: 'preview' },
      })
    ).toThrow(/API_BASE_URL/);

    expect(() =>
      buildExpoConfig({
        env: { APP_ENV: 'staging', API_BASE_URL: '   ' },
      })
    ).toThrow(/API_BASE_URL/);

    expect(() =>
      buildExpoConfig({
        env: { APP_ENV: 'production' },
        androidPackageOverride: 'vn.example.replaced',
      })
    ).toThrow(/API_BASE_URL/);

    expect(() =>
      buildExpoConfig({
        env: {
          APP_ENV: 'production',
          API_BASE_URL: 'http://insecure.example.invalid',
        },
        androidPackageOverride: 'vn.example.replaced',
      })
    ).toThrow(/https:\/\//);

    const validProd = resolveBuildEnvironment(
      {
        EAS_BUILD_PROFILE: 'production',
        APP_ENV: 'production',
        API_BASE_URL: 'https://api.example.invalid/',
      },
      'vn.example.replaced'
    );
    expect(validProd.appEnv).toBe('production');
    expect(validProd.apiBaseUrl).toBe('https://api.example.invalid');
    expect(validProd.allowCleartextTraffic).toBe(false);
    expect(validProd.isDebugToolsEnabled).toBe(false);
  });

  it('Xung đột giữa EAS_BUILD_PROFILE và APP_ENV hoặc giá trị môi trường lạ phải báo lỗi rõ ràng', () => {
    expect(() =>
      resolveBuildEnvironment({
        EAS_BUILD_PROFILE: 'preview',
        APP_ENV: 'production',
        API_BASE_URL: 'https://example.invalid',
      })
    ).toThrow(/Xung đột môi trường/);

    expect(() =>
      resolveBuildEnvironment({
        APP_ENV: 'qa',
      })
    ).toThrow(/APP_ENV/);
  });

  it('Quyền Android tường minh, không có quyền thừa và placeholder branding tồn tại đúng tên (T20.3, T20.4)', () => {
    const config = buildExpoConfig({ env: {} });

    expect(config.android?.permissions).toEqual([...REQUIRED_ANDROID_PERMISSIONS]);
    expect(config.android?.allowBackup).toBe(false);
    expect(config.android?.permissions).toContain('android.permission.SCHEDULE_EXACT_ALARM');
    expect(config.android?.permissions).not.toContain('android.permission.USE_EXACT_ALARM');

    expect(config.android?.blockedPermissions).toEqual([...BLOCKED_ANDROID_PERMISSIONS]);
    expect(config.android?.blockedPermissions).toContain('android.permission.SYSTEM_ALERT_WINDOW');
    expect(config.android?.blockedPermissions).toContain('android.permission.READ_EXTERNAL_STORAGE');
    expect(config.android?.blockedPermissions).toContain('android.permission.WRITE_EXTERNAL_STORAGE');
    expect(config.android?.blockedPermissions).toContain('android.permission.USE_EXACT_ALARM');

    // Không được trùng lặp quyền giữa danh sách cho phép và danh sách chặn
    for (const perm of REQUIRED_ANDROID_PERMISSIONS) {
      expect(BLOCKED_ANDROID_PERMISSIONS).not.toContain(perm);
    }

    // Kiểm tra tên tệp branding rõ ràng là placeholder và tồn tại trên ổ đĩa
    const brandingPlaceholders = config.extra?.brandingPlaceholders as
      | { icon?: string; adaptiveIconForeground?: string; splashIcon?: string }
      | undefined;
    expect(config.icon).toContain('placeholder');
    expect(config.android?.adaptiveIcon?.foregroundImage).toContain('placeholder');
    expect(brandingPlaceholders?.splashIcon).toContain('placeholder');

    const assetPaths = [
      config.icon as string,
      config.android?.adaptiveIcon?.foregroundImage as string,
      brandingPlaceholders?.splashIcon as string,
    ];
    for (const relPath of assetPaths) {
      const fullPath = path.resolve(mobileRootDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('eas.json khai báo đúng appVersionSource=remote và 3 profile development, preview, production (T20.2, T20.3)', () => {
    const easRaw = fs.readFileSync(path.join(mobileRootDir, 'eas.json'), 'utf-8');
    const eas = JSON.parse(easRaw);

    expect(eas.cli.appVersionSource).toBe('remote');

    expect(eas.build.development.developmentClient).toBe(true);
    expect(eas.build.development.distribution).toBe('internal');
    expect(eas.build.development.android.buildType).toBe('apk');
    expect(eas.build.development.env.APP_ENV).toBe('development');

    expect(eas.build.preview.distribution).toBe('internal');
    expect(eas.build.preview.autoIncrement).toBe(true);
    expect(eas.build.preview.android.buildType).toBe('apk');
    expect(eas.build.preview.env.APP_ENV).toBe('staging');
    expect(eas.build.preview.env.API_BASE_URL).toBeUndefined();

    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.build.production.android.buildType).toBe('app-bundle');
    expect(eas.build.production.env.APP_ENV).toBe('production');
    expect(eas.build.production.env.API_BASE_URL).toBeUndefined();
  });

  it('Mã ứng dụng đọc URL máy chủ duy nhất từ Constants.expoConfig.extra và đổi URL không cần sửa mã (T20.1)', async () => {
    setMockExpoExtra({
      appEnv: 'staging',
      apiBaseUrl: 'https://staging.example.invalid/',
      allowCleartextTraffic: false,
      isDebugToolsEnabled: false,
    });

    const runtimeConfig = getAppConfig();
    expect(runtimeConfig).toEqual({
      appEnv: 'staging',
      apiBaseUrl: 'https://staging.example.invalid',
      allowCleartextTraffic: false,
      isDebugToolsEnabled: false,
    });

    const calledUrls: string[] = [];
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      calledUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ answer: 'OK', action: null, accepted: 1, deduplicated: 0 }),
      } as unknown as Response;
    });

    const aiClient = new AiClient();
    const telemetry = new TelemetryService({ deviceId: 'device-t20' });

    await aiClient.ask({ question: 'Kiểm tra' });
    await telemetry.recordSessionStarted({ sessionId: 'sess-t20', recipeSlug: 'mon-1' });
    await telemetry.flushPendingEvents({ isOnline: true });

    expect(calledUrls).toEqual([
      'https://staging.example.invalid/v1/ai/ask',
      'https://staging.example.invalid/v1/events',
    ]);

    // Khi đổi extra sang URL khác -> client tự dùng URL mới
    setMockExpoExtra({
      appEnv: 'production',
      apiBaseUrl: 'https://prod-new.example.invalid',
      allowCleartextTraffic: false,
      isDebugToolsEnabled: false,
    });
    await aiClient.ask({ question: 'Kiểm tra lần 2' });
    expect(calledUrls[2]).toBe('https://prod-new.example.invalid/v1/ai/ask');
  });

  it('Khi apiBaseUrl rỗng trong Constants.expoConfig.extra: AiClient và TelemetryService thoát an toàn không gọi mạng', async () => {
    setMockExpoExtra({ appEnv: 'development', apiBaseUrl: '' });
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const aiClient = new AiClient();
    const aiRes = await aiClient.ask({ question: 'Hỏi lúc chưa có server' });
    expect(aiRes.success).toBe(false);
    if (!aiRes.success) {
      expect(aiRes.errorCode).toBe('NETWORK_ERROR');
    }

    const telemetry = new TelemetryService({ deviceId: 'device-empty-url' });
    await telemetry.recordSessionStarted({ sessionId: 'sess-empty', recipeSlug: 'mon-1' });
    const flushRes = await telemetry.flushPendingEvents({ isOnline: true });
    expect(flushRes.skippedReason).toBe('network_error');
    expect(flushRes.remaining).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('babel.config.js bật plugin xóa console.log ở production và tắt ở development (T20.5)', () => {
    const babelConfigFn = require('../../babel.config.js') as (api: {
      caller: (cb: (caller?: { isDev?: boolean }) => unknown) => unknown;
      cache: { invalidate: (cb: () => unknown) => void };
    }) => { presets: unknown[]; plugins: unknown[] };

    const devResult = babelConfigFn({
      caller: (cb) => cb({ isDev: true }),
      cache: { invalidate: () => {} },
    });
    expect(devResult.plugins).toHaveLength(0);

    const prodResult = babelConfigFn({
      caller: (cb) => cb({ isDev: false }),
      cache: { invalidate: () => {} },
    });
    expect(prodResult.plugins).toHaveLength(1);
  });
});
