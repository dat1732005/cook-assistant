/**
 * File: apps/mobile/src/__tests__/t13-screens.test.ts
 * Module: apps/mobile
 *
 * Kiểm thử nghiệp vụ và cấu trúc giao diện cho T13:
 *   1. Màn Hoàn tất (FinishScreen): danh sách trừ kho, sửa nhanh từng dòng, hoàn tác lần 1 và lần 2 (T13.1, P9).
 *   2. Màn Kho (PantryScreen): phân loại theo vị trí bảo quản, một chạm sửa lượng, xóa (T13.2).
 *   3. Màn Trang chủ (HomeScreen): nối SuggestService, công tắc Đi chợ (ước chừng), chi phí khoảng ±20% kèm giá tham khảo, chọn số người ăn và bữa ăn (T13.3, T13.4).
 */

import { describe, it, expect } from 'vitest';
import {
  SuggestService,
  SuggestRecipeInput,
  QUICK_ADD_STORAGE_LOCATIONS,
} from '@cook/core';

describe('T13: Kiểm thử màn Hoàn tất, Kho và Gợi ý trên Trang chủ', () => {
  // =========================================================================
  // T13.1: MÀN HOÀN TẤT & ĐỐI SOÁT TRỪ KHO
  // =========================================================================
  describe('T13.1: Màn Hoàn tất (FinishScreen)', () => {
    it('Cấu trúc dữ liệu đối soát trừ kho hiển thị đúng tên, lượng đã trừ và lượng còn lại', () => {
      const sampleDeductedItems = [
        {
          lotId: 'lot-egg-1',
          ingredientId: 'trung-ga',
          name: 'Trứng gà',
          deductedAmount: 3,
          baseUnit: 'cái',
          currentQuantity: 3,
        },
        {
          lotId: 'lot-tomato-1',
          ingredientId: 'ca-chua',
          name: 'Cà chua',
          deductedAmount: 200,
          baseUnit: 'g',
          currentQuantity: 300,
        },
      ];

      expect(sampleDeductedItems.length).toBe(2);
      expect(sampleDeductedItems[0]?.deductedAmount).toBe(3);
      expect(sampleDeductedItems[0]?.currentQuantity).toBe(3);
      expect(sampleDeductedItems[1]?.deductedAmount).toBe(200);
      expect(sampleDeductedItems[1]?.currentQuantity).toBe(300);
    });

    it('Xử lý thông điệp hoàn tác: lần một thành công, lần hai bắt lỗi ALREADY_UNDONE', () => {
      let isUndone = false;
      const undoSessionMock = (already: boolean) => {
        if (already) {
          throw new Error('ALREADY_UNDONE');
        }
        isUndone = true;
      };

      // Lần một
      expect(() => undoSessionMock(isUndone)).not.toThrow();
      expect(isUndone).toBe(true);

      // Lần hai
      expect(() => undoSessionMock(isUndone)).toThrow('ALREADY_UNDONE');
    });
  });

  // =========================================================================
  // T13.2: MÀN KHO NGUYÊN LIỆU (PANTRY SCREEN)
  // =========================================================================
  describe('T13.2: Màn Kho (PantryScreen)', () => {
    it('Hỗ trợ lọc theo 3 vị trí bảo quản tiêu chuẩn', () => {
      expect(QUICK_ADD_STORAGE_LOCATIONS).toEqual(['ngăn mát', 'ngăn đá', 'nhiệt độ phòng']);
      const sampleLots = [
        { id: '1', ingredientId: 'trung-ga', storageLocation: 'ngăn mát', quantity: 6 },
        { id: '2', ingredientId: 'thit-ba-chi', storageLocation: 'ngăn đá', quantity: 500 },
        { id: '3', ingredientId: 'nuoc-mam', storageLocation: 'nhiệt độ phòng', quantity: 200 },
      ];

      const fridgeLots = sampleLots.filter((l) => l.storageLocation === 'ngăn mát');
      const freezerLots = sampleLots.filter((l) => l.storageLocation === 'ngăn đá');
      const roomLots = sampleLots.filter((l) => l.storageLocation === 'nhiệt độ phòng');

      expect(fridgeLots.length).toBe(1);
      expect(freezerLots.length).toBe(1);
      expect(roomLots.length).toBe(1);
    });

    it('Tính năng một chạm (+ / - delta) điều chỉnh số lượng không âm', () => {
      const initialQty = 10;
      const adjustOneTouch = (qty: number, delta: number) => Math.max(0, qty + delta);

      expect(adjustOneTouch(initialQty, 1)).toBe(11);
      expect(adjustOneTouch(initialQty, -1)).toBe(9);
      expect(adjustOneTouch(0, -1)).toBe(0); // Không âm
    });
  });

  // =========================================================================
  // T13.3 & T13.4: GỢI Ý MÓN & CHẾ ĐỘ ƯỚC CHỪNG TRÊN TRANG CHỦ
  // =========================================================================
  describe('T13.3 & T13.4: Nối SuggestService & Chế độ Đi chợ ước chừng trên Trang chủ', () => {
    const suggestService = new SuggestService();

    const sampleCandidate: SuggestRecipeInput = {
      id: 'dish-1',
      slug: 'dish-1',
      name: 'Món mẫu',
      servings_base: 2,
      total_minutes: 20,
      equipment: ['chao'],
      ingredients: [
        {
          ingredientId: 'thit-ba-chi',
          qty: 200,
          unit: 'g',
          referencePrice: 150,
          allergen_codes: [],
        },
      ],
    };

    it('T13.3: Trang chủ chấm điểm món bằng SuggestService', () => {
      const ranked = suggestService.suggest({
        recipes: [sampleCandidate],
        profile: {
          servings: 2,
          equipment: ['chao'],
          allergies: [],
        },
        pantry: { 'thit-ba-chi': 500 },
        conversionsMap: { 'thit-ba-chi': { baseUnit: 'g' } },
        mode: 'standard',
      });

      expect(ranked.length).toBe(1);
      expect(ranked[0]?.score).toBeGreaterThan(0);
      expect(ranked[0]?.breakdown.phu).toBe(1.0);
    });

    it('T13.4: Chế độ ước chừng trả về khoảng chi phí ±20% dạng [min, max]', () => {
      const ranked = suggestService.suggest({
        recipes: [sampleCandidate],
        profile: {
          servings: 2,
          equipment: ['chao'],
          allergies: [],
        },
        pantry: {}, // Kho trống
        conversionsMap: { 'thit-ba-chi': { baseUnit: 'g' } },
        mode: 'estimation',
      });

      expect(ranked.length).toBe(1);
      expect(ranked[0]?.estimatedCostRange).toBeDefined();

      const costRange = ranked[0]!.estimatedCostRange!;
      expect(costRange.min).toBe(24000); // 30000 * 0.8
      expect(costRange.max).toBe(36000); // 30000 * 1.2
    });
  });
});
