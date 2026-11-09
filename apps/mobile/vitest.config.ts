/**
 * File: apps/mobile/vitest.config.ts
 * Làm gì: Cấu hình Vitest cho workspace @cook/mobile, gắn alias expo-constants sang mock nhẹ
 *         để chạy test logic cấu hình T20 trên Node mà không phụ thuộc runtime native React Native.
 * Nhận vào: Không có.
 * Trả ra: Cấu hình Vitest chuẩn cho toàn bộ unit test trong apps/mobile/src/.
 * Ai gọi: Lệnh `pnpm test`, `pnpm verify` và Vitest runner.
 * Bám theo: docs/tasks.md mục T06, T17-T20.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'expo-constants': path.resolve(currentDir, 'src/test-mocks/expo-constants.ts'),
      'expo-keep-awake': path.resolve(currentDir, 'src/test-mocks/expo-keep-awake.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    poolOptions: {
      forks: {
        execArgv: ['--disable-warning=ExperimentalWarning'],
      },
      threads: {
        execArgv: ['--disable-warning=ExperimentalWarning'],
      },
    },
  },
});
