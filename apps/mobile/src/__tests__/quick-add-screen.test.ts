/**
 * File: apps/mobile/src/__tests__/quick-add-screen.test.ts
 * Module: apps/mobile
 *
 * Kiểm thử nghiệp vụ và chuỗi giao diện cho màn hình Thêm nhanh nguyên liệu vào kho (T11).
 */

import { describe, it, expect } from 'vitest';
import {
  COMMON_15_INGREDIENTS,
  QUICK_ADD_STORAGE_LOCATIONS,
  canSelectPortionLevel,
  resolvePortionQuantity,
  searchIngredients,
} from '@cook/core';

describe('T11: Màn hình QuickAdd (Kiểm thử cấu trúc dữ liệu và quy tắc nghiệp vụ)', () => {
  it('Khởi tạo thành công với đúng 15 nguyên liệu hay dùng và 3 vị trí kho tiêu chuẩn', () => {
    expect(COMMON_15_INGREDIENTS.length).toBe(15);
    expect(QUICK_ADD_STORAGE_LOCATIONS).toEqual(['ngăn mát', 'ngăn đá', 'nhiệt độ phòng']);
  });

  it('Hỗ trợ tìm kiếm theo tên chuẩn và tên gọi khác (alias)', () => {
    const byAlias = searchIngredients('hột gà', [...COMMON_15_INGREDIENTS]);
    expect(byAlias.length).toBe(1);
    expect(byAlias[0]?.id).toBe('trung-ga');

    const byStandard = searchIngredients('Cà chua', [...COMMON_15_INGREDIENTS]);
    expect(byStandard.length).toBe(1);
    expect(byStandard[0]?.id).toBe('ca-chua');
  });

  it('Hỗ trợ kiểm tra MISSING định lượng: cấm chọn mức nếu thiếu dữ liệu', () => {
    expect(canSelectPortionLevel('trung-ga')).toBe(true);
    expect(resolvePortionQuantity('trung-ga', 'medium')).toBe(4);

    expect(canSelectPortionLevel('chua-co-dinh-luong', ['portion_levels'])).toBe(false);
    expect(resolvePortionQuantity('chua-co-dinh-luong', 'medium', ['portion_levels'])).toBeNull();
  });
});
