/**
 * File: apps/mobile/app.config.ts
 * Làm gì: Cấu hình động cho ứng dụng Expo / Android theo 3 môi trường (development, staging, production),
 *         khai báo duy nhất applicationId tạm, kiểm soát cleartext HTTP, quyền Android và placeholder branding.
 * Nhận vào: ConfigContext của Expo cùng các biến môi trường EAS_BUILD_PROFILE, APP_ENV, API_BASE_URL.
 * Trả ra: ExpoConfig đầy đủ (bao gồm extra cho Constants.expoConfig.extra và plugins cấu hình Android).
 * Ai gọi: Expo CLI (`expo config`, `expo export`, `expo prebuild`), EAS Build và unit test t20-config.test.ts.
 * Bám theo: docs/tasks.md mục T20.1, T20.2, T20.3, T20.4, T20.5.
 */

import type { ConfigContext, ExpoConfig } from 'expo/config';
import {
  AndroidConfig,
  XML,
  withAndroidManifest,
  withDangerousMod,
  type ConfigPlugin,
} from 'expo/config-plugins';

/** Tên miền gói Android tạm duy nhất trong toàn dự án; buộc phải đổi trước lần phát hành Play đầu tiên (T20). */
export const TEMPORARY_APPLICATION_ID = 'com.cook.app';

export type AppEnvironment = 'development' | 'staging' | 'production';
export type EasBuildProfile = 'development' | 'preview' | 'production';

export interface ResolvedBuildEnvironment {
  appEnv: AppEnvironment;
  apiBaseUrl: string;
  androidPackage: string;
  allowCleartextTraffic: boolean;
  isDebugToolsEnabled: boolean;
}

/** Danh sách quyền Android tối thiểu thực sự cần cho app Trợ lý nấu ăn (T20.4). */
export const REQUIRED_ANDROID_PERMISSIONS: readonly string[] = [
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.VIBRATE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
];

/** Danh sách quyền thừa hoặc nhạy cảm cần chặn bằng tools:node="remove" (T20.4). */
export const BLOCKED_ANDROID_PERMISSIONS: readonly string[] = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.ACCESS_LOCAL_NETWORK',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
];

const PROFILE_TO_ENV_MAP: Record<EasBuildProfile, AppEnvironment> = {
  development: 'development',
  preview: 'staging',
  production: 'production',
};

const VALID_APP_ENVS: readonly AppEnvironment[] = ['development', 'staging', 'production'];
const VALID_EAS_PROFILES: readonly EasBuildProfile[] = ['development', 'preview', 'production'];
const ANDROID_VERSION_CODE_BASE = 1;

/**
 * Làm gì: Chuyển đổi EAS_BUILD_PROFILE (development | preview | production) sang APP_ENV tương ứng.
 * Vào: rawProfile (giá trị chuỗi biến EAS_BUILD_PROFILE hoặc undefined).
 * Ra: AppEnvironment tương ứng hoặc undefined nếu không đặt profile.
 * Ví dụ: mapEasProfileToAppEnv('preview') -> 'staging'.
 * Gọi bởi: resolveBuildEnvironment().
 */
export function mapEasProfileToAppEnv(rawProfile: string | undefined): AppEnvironment | undefined {
  const normalized = rawProfile?.trim();
  // Nếu không có EAS_BUILD_PROFILE thì trả undefined để hàm gọi tự xét APP_ENV hoặc mặc định development
  if (!normalized) {
    return undefined;
  }

  if (!(VALID_EAS_PROFILES as readonly string[]).includes(normalized)) {
    throw new Error(
      `CẤU HÌNH THẤT BẠI: EAS_BUILD_PROFILE="${normalized}" không hợp lệ (chỉ chấp nhận: development, preview, production).`
    );
  }

  return PROFILE_TO_ENV_MAP[normalized as EasBuildProfile];
}

/**
 * Làm gì: Kiểm tra hợp lệ biến APP_ENV, EAS_BUILD_PROFILE, API_BASE_URL và khóa chặn production com.cook.app.
 * Vào: env (từ điển biến môi trường), androidPackageOverride (chỉ dùng trong kiểm thử giả lập tên gói đã chốt).
 * Ra: ResolvedBuildEnvironment đã kiểm tra đầy đủ.
 * Ví dụ: APP_ENV='staging' thiếu API_BASE_URL -> ném Error; APP_ENV='production' còn applicationId tạm -> ném Error.
 * Gọi bởi: buildExpoConfig() và bộ kiểm thử t20-config.test.ts.
 */
export function resolveBuildEnvironment(
  env: Record<string, string | undefined>,
  androidPackageOverride?: string
): ResolvedBuildEnvironment {
  // Bước 1: Ánh xạ profile EAS (nếu có) và đối chiếu với APP_ENV
  const mappedProfileEnv = mapEasProfileToAppEnv(env.EAS_BUILD_PROFILE);
  const rawAppEnv = env.APP_ENV?.trim();

  if (rawAppEnv && !(VALID_APP_ENVS as readonly string[]).includes(rawAppEnv)) {
    throw new Error(
      `CẤU HÌNH THẤT BẠI: APP_ENV="${rawAppEnv}" không hợp lệ (chỉ chấp nhận: development, staging, production).`
    );
  }

  // Chặn trường hợp APP_ENV và EAS_BUILD_PROFILE khai báo mâu thuẫn lẫn nhau
  if (mappedProfileEnv && rawAppEnv && mappedProfileEnv !== rawAppEnv) {
    throw new Error(
      `CẤU HÌNH THẤT BẠI: Xung đột môi trường giữa EAS_BUILD_PROFILE="${env.EAS_BUILD_PROFILE}" (ánh xạ "${mappedProfileEnv}") và APP_ENV="${rawAppEnv}".`
    );
  }

  const appEnv: AppEnvironment = (rawAppEnv as AppEnvironment | undefined) ?? mappedProfileEnv ?? 'development';
  const androidPackage = (androidPackageOverride ?? TEMPORARY_APPLICATION_ID).trim();

  // Bước 2: Chặn build production nếu applicationId vẫn là giá trị tạm com.cook.app
  if (appEnv === 'production' && androidPackage === TEMPORARY_APPLICATION_ID) {
    throw new Error(
      `CẤU HÌNH PRODUCTION THẤT BẠI: applicationId hiện vẫn đang để giá trị tạm "${TEMPORARY_APPLICATION_ID}". Tên gói không đổi được sau khi đăng Google Play — vui lòng thay applicationId chính thức trong apps/mobile/app.config.ts trước khi build production.`
    );
  }

  if (!androidPackage) {
    throw new Error('CẤU HÌNH THẤT BẠI: android.package (applicationId) không được để trống.');
  }

  // Bước 3: Kiểm tra biến API_BASE_URL theo từng môi trường (T20.1)
  const rawApiBaseUrl = (env.API_BASE_URL ?? '').trim().replace(/\/+$/, '');

  // Staging và production bắt buộc có API_BASE_URL từ biến môi trường build
  if ((appEnv === 'staging' || appEnv === 'production') && !rawApiBaseUrl) {
    throw new Error(
      `CẤU HÌNH ${appEnv.toUpperCase()} THẤT BẠI: Thiếu biến môi trường API_BASE_URL. Vui lòng thiết lập URL backend cho môi trường ${appEnv} qua biến môi trường của EAS.`
    );
  }

  let validatedUrl = '';
  if (rawApiBaseUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawApiBaseUrl);
    } catch {
      throw new Error(
        `CẤU HÌNH ${appEnv.toUpperCase()} THẤT BẠI: API_BASE_URL="${rawApiBaseUrl}" không phải URL hợp lệ.`
      );
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `CẤU HÌNH ${appEnv.toUpperCase()} THẤT BẠI: API_BASE_URL="${rawApiBaseUrl}" phải dùng giao thức http:// hoặc https://.`
      );
    }

    // Môi trường production bắt buộc sử dụng HTTPS được mã hóa
    if (appEnv === 'production' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `CẤU HÌNH PRODUCTION THẤT BẠI: API_BASE_URL ở môi trường production bắt buộc phải bắt đầu bằng https:// (nhận được "${rawApiBaseUrl}").`
      );
    }

    validatedUrl = rawApiBaseUrl;
  }

  // Bước 4: Chỉ cho phép cleartext HTTP và công cụ debug khi APP_ENV === 'development'
  const allowCleartextTraffic = appEnv === 'development';
  const isDebugToolsEnabled = appEnv === 'development';

  return {
    appEnv,
    apiBaseUrl: validatedUrl,
    androidPackage,
    allowCleartextTraffic,
    isDebugToolsEnabled,
  };
}

/**
 * Làm gì: Plugin cấu hình AndroidManifest.xml và network_security_config.xml để cho phép cleartext HTTP
 *         duy nhất ở development và chặn hoàn toàn ở staging/production (T20.1).
 * Vào: expoConfig (ExpoConfig đang dựng), props ({ allowCleartextTraffic }).
 * Ra: ExpoConfig đã gắn mod AndroidManifest và dangerousMod ghi XML cấu hình mạng.
 * Gọi bởi: buildExpoConfig().
 */
const withAndroidNetworkSecurity: ConfigPlugin<{ allowCleartextTraffic: boolean }> = (
  expoConfig,
  { allowCleartextTraffic }
) => {
  // Nhánh 1: Ghi thuộc tính usesCleartextTraffic và networkSecurityConfig vào thẻ <application>
  let nextConfig = withAndroidManifest(expoConfig, (modConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    mainApplication.$['android:usesCleartextTraffic'] = allowCleartextTraffic ? 'true' : 'false';
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return modConfig;
  });

  // Nhánh 2: Tạo tệp res/xml/network_security_config.xml khóa cleartext trên Android 9+
  nextConfig = withDangerousMod(nextConfig, [
    'android',
    async (modConfig) => {
      const configXmlPath = `${modConfig.modRequest.platformProjectRoot}/app/src/main/res/xml/network_security_config.xml`;
      const xmlDocument = await XML.parseXMLAsync(
        `<network-security-config><base-config cleartextTrafficPermitted="${allowCleartextTraffic ? 'true' : 'false'}" /></network-security-config>`
      );
      await XML.writeXMLAsync({ path: configXmlPath, xml: xmlDocument });
      return modConfig;
    },
  ]);

  return nextConfig;
};

/**
 * Làm gì: Dựng hoàn chỉnh đối tượng ExpoConfig cho Trợ lý nấu ăn dựa trên biến môi trường build.
 * Vào: options ({ baseConfig, env, androidPackageOverride }).
 * Ra: ExpoConfig hợp lệ dùng cho Expo/EAS và cho kiểm thử cấu hình T20.
 * Gọi bởi: Hàm default export của app.config.ts và t20-config.test.ts.
 */
export function buildExpoConfig(options?: {
  baseConfig?: Partial<ExpoConfig>;
  env?: Record<string, string | undefined>;
  androidPackageOverride?: string;
}): ExpoConfig {
  const envSource = options?.env ?? process.env;
  const resolved = resolveBuildEnvironment(envSource, options?.androidPackageOverride);

  let config: ExpoConfig = {
    ...options?.baseConfig,
    name: 'Trợ lý nấu ăn',
    slug: 'cook-assistant',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    backgroundColor: '#FFFFFF',
    // Tài nguyên branding tạm thời cho T20.3 (sẽ thay bằng thiết kế thật trước khi phát hành)
    icon: './assets/placeholder-icon.png',
    android: {
      ...options?.baseConfig?.android,
      package: resolved.androidPackage,
      versionCode: ANDROID_VERSION_CODE_BASE,
      allowBackup: false,
      adaptiveIcon: {
        foregroundImage: './assets/placeholder-adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      permissions: [...REQUIRED_ANDROID_PERMISSIONS],
      blockedPermissions: [...BLOCKED_ANDROID_PERMISSIONS],
    },
    plugins: [['expo-notifications', { color: '#10B981' }]],
    extra: {
      ...options?.baseConfig?.extra,
      appEnv: resolved.appEnv,
      apiBaseUrl: resolved.apiBaseUrl,
      allowCleartextTraffic: resolved.allowCleartextTraffic,
      isDebugToolsEnabled: resolved.isDebugToolsEnabled,
      brandingPlaceholders: {
        icon: './assets/placeholder-icon.png',
        adaptiveIconForeground: './assets/placeholder-adaptive-icon.png',
        splashIcon: './assets/placeholder-splash-icon.png',
      },
    },
  };

  // Áp dụng cấu hình bảo mật mạng (cho phép cleartext duy nhất ở development)
  config = withAndroidNetworkSecurity(config, {
    allowCleartextTraffic: resolved.allowCleartextTraffic,
  });

  return config;
}

export default ({ config }: ConfigContext): ExpoConfig =>
  buildExpoConfig({
    baseConfig: config,
    env: process.env,
  });
