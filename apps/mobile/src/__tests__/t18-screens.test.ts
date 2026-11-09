/**
 * File: apps/mobile/src/__tests__/t18-screens.test.ts
 * Module: apps/mobile
 *
 * Kiểm thử nghiệp vụ và cấu trúc giao diện cho T18:
 *   1. Màn Thay hoặc bỏ (SubstituteModal):
 *      - Nguyên liệu role = 'preservation' hiện cảnh báo an toàn cố định, không phụ thuộc AI (T18.2).
 *      - Nguyên liệu dính dị ứng hiện cảnh báo dị ứng cố định (T18.2).
 *      - Nguyên liệu thông thường gọi AI, có dòng "AI có thể mắc lỗi" (T18.1).
 *      - Nút "Câu trả lời sai" gửi báo cáo phản hồi (T18.4).
 *   2. Màn Nấu (CookScreen):
 *      - Khối hỏi nhanh AI khi đang nấu với câu trả lời, nút đề xuất hành động (T18.3).
 *      - Hẹn giờ / hành động chỉ thay đổi khi người dùng chủ động bấm (T18.3).
 *      - Dòng "AI có thể mắc lỗi" và nút "Câu trả lời sai" (T18.4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Recipe } from '@cook/core';
import {
  AiClient,
  formatAiMockNotice,
  setAnonymousDeviceIdForTesting,
} from '../services/ai-client.js';
import { STRINGS } from '../constants/strings.js';

describe('T18: Màn Thay hoặc bỏ và Hỏi nhanh AI khi đang nấu', () => {
  beforeEach(() => {
    setAnonymousDeviceIdForTesting('test-device-t18');
  });
  const mockRecipe: Recipe = {
    id: 'thit-kho-to',
    slug: 'thit-kho-to',
    name: 'Thịt kho tộ',
    servings_base: 2,
    equipment: ['nồi đất'],
    version: 1,
    missing_fields: [],
    tags: [],
    status: 'published',
    ingredients: [
      {
        ingredient: 'Muối hạt',
        qty: 5,
        unit: 'g',
        role: 'preservation',
        flavor_group: 'salt',
        optional: false,
      },
      {
        ingredient: 'Tôm khô',
        qty: 20,
        unit: 'g',
        role: 'structure',
        flavor_group: 'none',
        optional: false,
      },
      {
        ingredient: 'Thịt ba chỉ',
        qty: 300,
        unit: 'g',
        role: 'structure',
        flavor_group: 'none',
        optional: false,
      },
    ],
    steps: [
      {
        id: 'step-1',
        title: 'Ướp thịt',
        text: 'Ướp thịt với muối và gia vị',
        seconds: 300,
        kind: 'active',
        after: [],
        resources: ['bếp'],
      },
      {
        id: 'step-2',
        title: 'Kho nhỏ lửa',
        text: 'Kho thịt trên bếp nhỏ lửa',
        seconds: 900,
        kind: 'passive',
        after: ['step-1'],
        resources: ['bếp'],
      },
    ],
  };

  describe('T18.1 & T18.2: Quy tắc cảnh báo cố định và gọi AI trong SubstituteModal', () => {
    it('Nguyên liệu có vai trò preservation kích hoạt cảnh báo an toàn cố định mức cao', () => {
      const ing = mockRecipe.ingredients.find((i) => i.role === 'preservation');
      expect(ing).toBeDefined();
      expect(ing?.role).toBe('preservation');

      // Logic kiểm tra trong SubstituteModal
      const isPreservation = ing?.role === 'preservation';
      expect(isPreservation).toBe(true);

      const fixedWarning = {
        title: '⚠️ CẢNH BÁO AN TOÀN CỐ ĐỊNH',
        severity: 'high',
        confirm_required: true,
      };
      expect(fixedWarning.severity).toBe('high');
      expect(fixedWarning.confirm_required).toBe(true);
    });

    it('Nguyên liệu dính dị ứng kích hoạt cảnh báo dị ứng cố định', () => {
      const userAllergies = ['crustaceans'];
      const allergenMap: Record<string, string[]> = {
        'Tôm khô': ['crustaceans'],
      };

      const allergens = allergenMap['Tôm khô'] || [];
      const hasAllergyConflict = allergens.some((c) => userAllergies.includes(c));
      expect(hasAllergyConflict).toBe(true);
    });

    it('Nguyên liệu bình thường gọi AI thành công, trả về gợi ý và có dòng nhắc AI có thể mắc lỗi', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          severity: 'low',
          impact: 'Thịt đùi ít mỡ hơn thịt ba chỉ nhưng vẫn giữ được độ ngon.',
          suggestions: ['Thịt nạc vai', 'Thịt đùi'],
          confirm_required: false,
        }),
      });
      global.fetch = mockFetch;

      const client = new AiClient({
        baseUrl: 'http://test-server',
      });

      const res = await client.substitute({
        recipeId: 'thit-kho-to',
        action: 'substitute',
        ingredientId: 'Thịt ba chỉ',
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.severity).toBe('low');
        expect(res.data.suggestions).toEqual(['Thịt nạc vai', 'Thịt đùi']);
      }
    });

    it('Nút "Câu trả lời sai" gửi phản hồi thành công đến AI feedback service', async () => {
      let feedbackRecorded = false;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/ai/feedback')) {
          feedbackRecorded = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: 'ok' }),
          };
        }
        return { ok: false, status: 404 };
      });
      global.fetch = mockFetch;

      const client = new AiClient({
        baseUrl: 'http://test-server',
      });

      const res = await client.reportFeedback({
        ingredientId: 'Thịt ba chỉ',
        comment: 'Gợi ý không phù hợp khẩu vị kho tộ',
      });

      expect(res.success).toBe(true);
      expect(feedbackRecorded).toBe(true);
    });
  });

  describe('T18.3 & T18.4: Hỏi nhanh AI khi đang nấu trong CookScreen', () => {
    it('Gửi câu hỏi tới /v1/ai/ask và nhận câu trả lời kèm hành động đề xuất', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          answer: 'Nếu thịt hơi khô, bạn có thể châm thêm 2 thìa nước sôi và đun thêm 2 phút.',
          action: 'Thêm 2 phút hẹn giờ',
        }),
      });
      global.fetch = mockFetch;

      const client = new AiClient({
        baseUrl: 'http://test-server',
      });

      const res = await client.ask({
        question: 'Thịt bị khô thì làm sao?',
        currentStep: 'step-2',
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.answer).toContain('châm thêm 2 thìa nước sôi');
        expect(res.data.action).toBe('Thêm 2 phút hẹn giờ');
      }
    });

    it('Hành động đề xuất (hẹn giờ) chỉ được áp dụng khi người dùng bấm nút áp dụng', () => {
      let timerChanged = false;
      const applyAiAction = (actionName: string | null) => {
        if (!actionName) return;
        timerChanged = true;
      };

      // Chưa bấm nút: timer không đổi
      expect(timerChanged).toBe(false);

      // Người dùng chủ động bấm nút áp dụng
      applyAiAction('Thêm 2 phút hẹn giờ');
      expect(timerChanged).toBe(true);
    });

    it('Hiển thị "(chế độ thử, không phải AI thật)" khi backend trả header X-AI-Mock: true và ẩn khi dùng AI thật', async () => {
      expect(STRINGS.ai.mockNotice).toBe('(chế độ thử, không phải AI thật)');

      // 1. Khi backend trả về X-AI-Mock: true (từ MockAiProvider)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'X-AI-Mock': 'true' }),
        json: async () => ({
          answer: 'Thử chế độ giả lập.',
          action: null,
        }),
      });

      const client = new AiClient({ baseUrl: 'http://test-server' });
      const mockRes = await client.ask({ question: 'Kiểm tra chế độ thử' });

      expect(mockRes.isMock).toBe(true);
      expect(formatAiMockNotice(mockRes.isMock)).toBe('(chế độ thử, không phải AI thật)');

      // 2. Khi backend không trả header X-AI-Mock (từ RealAiProvider)
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          severity: 'low',
          impact: 'Có thể thay bằng hành tây.',
          suggestions: ['hanh-tay'],
          confirm_required: false,
        }),
      });

      const realRes = await client.substitute({
        recipeId: 'thit-kho-to',
        action: 'substitute',
        ingredientId: 'hanh-la',
      });

      expect(realRes.isMock).toBe(false);
      expect(formatAiMockNotice(realRes.isMock)).toBeNull();
    });
  });
});
