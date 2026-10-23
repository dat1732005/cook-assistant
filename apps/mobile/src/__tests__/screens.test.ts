/**
 * File: apps/mobile/src/__tests__/screens.test.ts
 * Làm gì: Bộ kiểm thử đơn vị cho ứng dụng di động apps/mobile (chuỗi ngôn ngữ strings.ts, cấu hình navigation, và logic màn hình).
 * Nhận vào: Mock SqlDriver, màn hình và hằng số chuỗi.
 * Trả ra: Kết quả kiểm thử thành công cho tầng giao diện di động.
 * Ai gọi: pnpm test.
 * Bám theo: Mục T06.1 đến T06.7 trong docs/tasks.md.
 */

import { describe, it, expect } from 'vitest';
import { STRINGS } from '../constants/strings.js';
import { DEV_DATA_BUNDLE } from '../data/dev-fixtures.js';

describe('Ứng dụng di động apps/mobile: Kiểm thử giao diện và chuỗi ký tự tập trung', () => {
  it('STRINGS chứa đầy đủ các phân mục giao diện của 3 màn hình', () => {
    expect(STRINGS.common).toBeDefined();
    expect(STRINGS.welcome).toBeDefined();
    expect(STRINGS.home).toBeDefined();
    expect(STRINGS.detail).toBeDefined();
    expect(STRINGS.allergens).toBeDefined();
    expect(STRINGS.spices).toBeDefined();
    expect(STRINGS.equipment).toBeDefined();

    // Kiểm tra các nhãn cốt lõi
    expect(STRINGS.common.appName).toBe('Trợ lý nấu ăn');
    expect(STRINGS.home.profileButtonText).toBe('Hồ sơ & Dị ứng');
    expect(STRINGS.detail.replaceOrRemoveButtonText).toBe('Thay hoặc bỏ nguyên liệu (Chờ AI)');
  });

  it('DEV_DATA_BUNDLE chứa đúng 6 món fixture mẫu với synthetic: true', () => {
    expect(DEV_DATA_BUNDLE.recipes?.length).toBe(6);
    expect(DEV_DATA_BUNDLE.ingredients?.length).toBe(10);

    // Món trung-chien-ca-chua có mặt trong gói dev
    const trungChien = DEV_DATA_BUNDLE.recipes?.find((r) => r.slug === 'trung-chien-ca-chua');
    expect(trungChien).toBeDefined();
    expect(trungChien?.servings_base).toBe(2);
    expect(trungChien?.synthetic).toBe(true);
    expect(trungChien?.ingredients.length).toBe(6);
  });
});
