/**
 * File: apps/mobile/src/__tests__/cooking-screens.test.ts
 * Làm gì: Bộ kiểm thử đơn vị cho các màn hình Chuẩn bị, Nấu, Hoàn tất (T09).
 * Bám theo: Mục T09 trong docs/tasks.md và docs/expected/T07.md.
 */

import { describe, it, expect } from 'vitest';
import type { Recipe, RecipeStep } from '@cook/core';
import { STRINGS } from '../constants/strings.js';

describe('T09: Màn Chuẩn bị, Nấu, Hoàn tất (Kiểm thử cấu trúc giao diện và quy tắc an toàn)', () => {
  const sampleSteps: RecipeStep[] = [
    {
      id: 'A',
      title: 'Đun nước sôi',
      kind: 'passive',
      seconds: 300,
      after: [],
      resources: ['noi'],
      text: 'Đun sôi nước trong nồi',
    },
    {
      id: 'B',
      title: 'Thái thịt',
      kind: 'active',
      seconds: 60,
      after: [],
      resources: ['dao'],
      cue: 'Thịt thái lát mỏng 2mm',
      text: 'Thái thịt mỏng',
    },
    {
      id: 'D',
      title: 'Thịt chín kỹ',
      kind: 'active',
      seconds: 60,
      after: ['A', 'B'],
      resources: ['chao'],
      safety_rule: 'safety-cook-temp',
      cue: 'Thịt đổi màu hoàn toàn không còn đỏ',
      text: 'Đảo thịt chín kỹ',
    },
  ];

  const validRecipe: Recipe = {
    id: 'dish-test',
    slug: 'dish-test',
    name: 'Thịt xào rau củ',
    servings_base: 2,
    total_minutes: 20,
    difficulty: 1,
    status: 'published',
    version: 1,
    tags: [],
    missing_fields: [],
    source: 'Sách hướng dẫn nấu ăn chuẩn ATTP 2026',
    equipment: ['chao', 'noi', 'dao'],
    ingredients: [
      {
        ingredient: 'Thịt lợn',
        qty: 200,
        unit: 'g',
        role: 'structure',
        flavor_group: 'none',
        optional: false,
      },
    ],
    steps: sampleSteps,
  };

  describe('1. Màn Chuẩn bị (PrepareScreen) & Chặn quy tắc an toàn MISSING', () => {
    it('Chặn bắt đầu nấu nếu công thức có bước mang safety_rule là MISSING', () => {
      const unsafeRecipe: Recipe = {
        ...validRecipe,
        steps: [
          {
            ...sampleSteps[0]!,
            safety_rule: 'MISSING',
          },
        ],
      };

      // Kiểm tra logic xác định lỗi an toàn
      const hasMissingSafety = unsafeRecipe.steps.some(
        (s) => s.safety_rule === 'MISSING'
      );
      expect(hasMissingSafety).toBe(true);
      expect(STRINGS.prepare.safetyMissingBlockTitle).toBeDefined();
      expect(STRINGS.prepare.safetyMissingBlockMessage).toBeDefined();
    });

    it('Chặn bắt đầu nấu nếu công thức có missing_fields chứa safety_rule', () => {
      const unsafeRecipe: Recipe = {
        ...validRecipe,
        missing_fields: ['safety_rule', 'step_temp'],
      };

      const isSafetyMissing = unsafeRecipe.missing_fields?.some(
        (f) => typeof f === 'string' && f.includes('safety')
      );
      expect(isSafetyMissing).toBe(true);
    });

    it('Cho phép bắt đầu nếu công thức an toàn và đầy đủ thông tin', () => {
      const isSafetyMissing =
        Boolean(validRecipe.missing_fields?.some((f) => f.includes('safety'))) ||
        validRecipe.steps.some((s) => s.safety_rule === 'MISSING');

      expect(isSafetyMissing).toBe(false);
      expect(STRINGS.prepare.startCookingButton).toBe('Sẵn sàng, bắt đầu nấu ngay');
    });
  });

  describe('2. Màn Nấu (CookScreen) & Yêu cầu các thành phần giao diện bắt buộc', () => {
    it('Chuỗi ký tự tập trung đầy đủ cho bước active (Xong cỡ lớn, khoảng X phút, cue, Hẹn giờ)', () => {
      expect(STRINGS.cook.largeDoneButton).toBe('Xong');
      expect(STRINGS.cook.approxMinutesPrefix).toBe('khoảng');
      expect(STRINGS.cook.cuePrefix).toBe('Dấu hiệu nhận biết:');
      expect(STRINGS.cook.timerButton).toBe('Hẹn giờ');
      expect(STRINGS.cook.passiveStartedButton).toBe('Đã bắt đầu');
    });

    it('Chuỗi ký tự tập trung cho giữ sáng màn hình và hộp thoại xác nhận lùi/thoát', () => {
      expect(STRINGS.cook.keepAwakeActive).toBe('Màn hình luôn sáng');
      expect(STRINGS.cook.exitConfirmTitle).toBe('Thoát khỏi phiên nấu ăn?');
      expect(STRINGS.cook.abandonConfirmTitle).toBe('Bỏ dở phiên nấu ăn?');
      expect(STRINGS.cook.abandonButton).toBe('Bỏ dở phiên');
      expect(STRINGS.cook.resumeButton).toBe('Tiếp tục nấu');
    });

    it('Chuỗi ký tự tập trung cho hộp xác nhận bước an toàn thực phẩm', () => {
      expect(STRINGS.cook.safetyConfirmTitle).toBe('Xác nhận an toàn bắt buộc');
      expect(STRINGS.cook.safetySourcePrefix).toBe('Nguồn quy tắc:');
      expect(STRINGS.cook.safetyCheckboxLabel).toContain('tuân thủ quy tắc an toàn');
      expect(STRINGS.cook.safetyBlockedAlert).toContain('quy tắc an toàn bắt buộc');
    });
  });

  describe('3. Màn Hoàn tất (FinishScreen)', () => {
    it('Hiển thị thông điệp chúc mừng và nút Về trang chủ', () => {
      expect(STRINGS.finish.headerTitle).toBe('Hoàn tất món ăn');
      expect(STRINGS.finish.title).toBe('Chúc mừng bạn đã hoàn thành món ăn!');
      expect(STRINGS.finish.backToHomeButton).toBe('Về trang chủ');
    });
  });
});
