/**
 * File: packages/core/src/__tests__/schema.test.ts
 * Mục đích: Bộ kiểm thử đơn vị cho toàn bộ Zod schemas, validator và hàm quy đổi đơn vị.
 * Nhận vào: Dữ liệu mẫu (fixtures/recipes.ts) gồm 5 ca hợp lệ và 10 ca cố tình tạo sai.
 * Trả ra: Kết quả kiểm thử thành công (pass) hoặc thất bại (fail) của Vitest.
 * Ai gọi: Lệnh `pnpm test` tại packages/core hoặc thư mục gốc monorepo.
 * Bám theo: Mục T02 Nghiệm thu và Bảng bằng chứng trong docs/tasks.md.
 */

import { describe, expect, it } from 'vitest';
import {
  validateRecipe,
  validateIngredient,
  validatePantryItem,
  validatePantryEvent,
  validateCookSession,
  validateUserProfile,
  validateSafetyRule,
} from '../validators/index.js';
import {
  convertToBaseUnit,
  convertUnit,
  isBaseUnit,
} from '../units/conversions.js';
import {
  VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
  VALID_RECIPE_RAU_MUONG_LUOC,
  VALID_RECIPE_REVIEWED,
  VALID_RECIPE_PUBLISHED,
  VALID_RECIPE_SINH_TO,
  INVALID_RECIPE_CASES,
} from '../fixtures/recipes.js';

describe('T02: Kiểm tra tính hợp lệ của các công thức mẫu (5 ca hợp lệ)', () => {
  it('Ca 1: Validator chấp nhận món mẫu chuẩn "Trứng chiên cà chua"', () => {
    const result = validateRecipe(VALID_RECIPE_TRUNG_CHIEN_CA_CHUA);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Trứng chiên cà chua');
      expect(result.data.servings).toBe(2);
      expect(result.data.ingredients).toHaveLength(5);
      expect(result.data.steps).toHaveLength(5);
    }
  });

  it('Ca 2: Validator chấp nhận món "Rau muống luộc" (có bước passive tự đun)', () => {
    const result = validateRecipe(VALID_RECIPE_RAU_MUONG_LUOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('rau-muong-luoc');
      expect(result.data.steps.some((s) => s.type === 'passive')).toBe(true);
    }
  });

  it('Ca 3: Validator chấp nhận món đã kiểm duyệt "Canh mây cà chua" (reviewed)', () => {
    const result = validateRecipe(VALID_RECIPE_REVIEWED);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('reviewed');
      expect(result.data.reviewedBy).toBe('Chuyên gia ẩm thực Nguyễn Văn A');
    }
  });

  it('Ca 4: Validator chấp nhận món đã phát hành "Thịt kho trứng" (published)', () => {
    const result = validateRecipe(VALID_RECIPE_PUBLISHED);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('published');
      expect(result.data.version).toBe(2);
    }
  });

  it('Ca 5: Validator chấp nhận món ăn nhanh "Sinh tố bơ"', () => {
    const result = validateRecipe(VALID_RECIPE_SINH_TO);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servings).toBe(1);
    }
  });
});

describe('T02: Bắt lỗi các ca sai bắt buộc (Ít nhất 8 ca sai theo tiêu chí nghiệm thu)', () => {
  // Duyệt qua từng ca kiểm thử tiêu cực trong danh sách INVALID_RECIPE_CASES
  INVALID_RECIPE_CASES.forEach((testCase, index) => {
    it(`Ca sai ${index + 1}: ${testCase.name}`, () => {
      const result = validateRecipe(testCase.data);
      // Kết quả bắt buộc phải thất bại (không được nhận dữ liệu sai)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        const hasMatchingError = result.errors.some((err) =>
          err.toLowerCase().includes(testCase.expectedErrorSubstring.toLowerCase()),
        );
        expect(
          hasMatchingError,
          `Mong đợi lỗi chứa từ khóa "${testCase.expectedErrorSubstring}", nhưng danh sách lỗi là: ${result.errors.join('; ')}`,
        ).toBe(true);
      }
    });
  });
});

describe('T02: Kiểm tra quy đổi đơn vị (conversions)', () => {
  it('isBaseUnit nhận biết đúng đơn vị gốc', () => {
    expect(isBaseUnit('g')).toBe(true);
    expect(isBaseUnit('ml')).toBe(true);
    expect(isBaseUnit('cái')).toBe(true);
    expect(isBaseUnit('thìa canh')).toBe(false);
  });

  it('Đổi số lượng khi đơn vị đã là đơn vị gốc thì giữ nguyên', () => {
    expect(convertToBaseUnit(100, 'g', 'g')).toBe(100);
    expect(convertToBaseUnit(250, 'ml', 'ml')).toBe(250);
  });

  it('Đổi theo bảng conversions riêng của nguyên liệu (quả -> g)', () => {
    // 55g/quả là dữ liệu giả (synthetic mock data) dùng riêng cho test case, không phải dữ liệu thật theo quy tắc R3
    const conversions = { quả: 55 /* dữ liệu giả (synthetic mock data) */ };
    const result = convertToBaseUnit(3, 'quả', 'g', conversions);
    expect(result).toBe(165); // 3 * 55 = 165 gam
  });

  it('Đổi theo thể tích chuẩn mặc định cho chất lỏng (thìa cà phê -> ml, thìa canh -> ml)', () => {
    // 3 thìa cà phê nước mắm = 15 ml (quy ước tạm, chờ xác nhận)
    expect(convertToBaseUnit(3, 'thìa cà phê', 'ml')).toBe(15);
    // 2 thìa canh dầu ăn = 30 ml (quy ước tạm, chờ xác nhận)
    expect(convertToBaseUnit(2, 'thìa canh', 'ml')).toBe(30);
  });

  it('Dùng chén khi chưa có quy đổi trong bảng conversions riêng phải ném lỗi rõ ràng (MISSING)', () => {
    // Không có conversions riêng cho chén đối với nguyên liệu lỏng (baseUnit: ml) -> phải ném lỗi rõ ràng
    expect(() => convertToBaseUnit(1, 'chén', 'ml', null)).toThrow(
      /Không thể quy đổi đơn vị "chén" sang đơn vị gốc "ml" do đơn vị "chén" đang ở trạng thái MISSING/,
    );
    // Không có conversions riêng cho chén đối với nguyên liệu rắn (baseUnit: g) -> phải ném lỗi rõ ràng
    expect(() => convertToBaseUnit(2, 'chén', 'g', {})).toThrow(
      /Không thể quy đổi đơn vị "chén" sang đơn vị gốc "g" do đơn vị "chén" đang ở trạng thái MISSING/,
    );
  });

  it('Quy đổi giữa hai đơn vị không phải gốc (g -> quả qua bảng conversions)', () => {
    const conversions = { quả: 50 /* dữ liệu giả (synthetic mock data) */ };
    // 150 gam trứng = 3 quả
    expect(convertUnit(150, 'g', 'quả', 'g', conversions)).toBe(3);
  });

  it('Ném lỗi khi đơn vị lạ không có quy tắc chuyển đổi', () => {
    expect(() => convertToBaseUnit(2, 'bó', 'g', {})).toThrow(
      /Không thể quy đổi đơn vị/,
    );
  });

  it('Thìa kèm nguyên liệu dạng rắn (baseUnit: g) mà không có quy đổi riêng phải ném lỗi, không đoán ra số gam', () => {
    // 2 thìa bột mì/đường (baseUnit: g) không có conversions riêng: bắt buộc ném lỗi, không tự ý đoán ra số gam
    expect(() => convertToBaseUnit(2, 'thìa cà phê', 'g', null)).toThrow(
      /Không thể quy đổi đơn vị "thìa cà phê" sang đơn vị gốc "g"/,
    );
    expect(() => convertToBaseUnit(1, 'thìa canh', 'g', {})).toThrow(
      /Không thể quy đổi đơn vị "thìa canh" sang đơn vị gốc "g"/,
    );
  });
});

describe('T02: Kiểm tra các schema thực thể khác (Ingredient, Pantry, Session, Profile, Safety)', () => {
  it('IngredientSchema hợp lệ và bắt lỗi khi sai baseUnit', () => {
    const validIngredient = {
      id: 'trung_ga',
      name: 'Trứng gà',
      aliases: ['hột gà'],
      baseUnit: 'quả', // sai enum: chỉ nhận 'g', 'ml', 'cái'
      conversions: { quả: 55 /* dữ liệu giả (synthetic mock data) */ },
      allergens: ['egg'],
    };
    const invalidResult = validateIngredient(validIngredient);
    expect(invalidResult.success).toBe(false);

    // Sửa lại baseUnit đúng ('cái')
    const validResult = validateIngredient({
      ...validIngredient,
      baseUnit: 'cái',
    });
    expect(validResult.success).toBe(true);
  });

  it('PantryItemSchema từ chối số lượng âm', () => {
    const invalidItem = {
      id: 'item_1',
      ingredientId: 'muoi',
      quantity: -10,
      unit: 'g',
    };
    const result = validatePantryItem(invalidItem);
    expect(result.success).toBe(false);
  });

  it('PantryEventSchema chấp nhận các lý do biến động hợp lệ', () => {
    const validEvent = {
      id: 'event_1',
      pantryItemId: 'item_1',
      ingredientId: 'trung_ga',
      change: -2,
      reason: 'cook',
      createdAt: '2026-10-20T11:00:00Z',
    };
    expect(validatePantryEvent(validEvent).success).toBe(true);

    // Sai reason
    expect(
      validatePantryEvent({ ...validEvent, reason: 'borrow' }).success,
    ).toBe(false);
  });

  it('CookSessionSchema kiểm tra kế hoạch hợp lệ', () => {
    const validSession = {
      id: 'session_1',
      recipeId: 'recipe_trung_chien_ca_chua',
      recipeVersion: 1,
      servings: 2,
      mode: 'fastest',
      status: 'cooking',
      startedAt: '2026-10-20T11:00:00Z',
      confirmedSafetySteps: [],
      plan: [
        { stepId: 'step_1', startAt: 0, endAt: 180 },
        { stepId: 'step_2', startAt: 180, endAt: 300 },
      ],
    };
    expect(validateCookSession(validSession).success).toBe(true);
  });

  it('UserProfileSchema kiểm tra sở thích và dị ứng', () => {
    const validProfile = {
      id: 'user_default',
      servings: 2,
      allergies: ['peanut', 'egg'],
      availableEquipment: ['chao', 'noi'],
      essentialSpices: ['muoi', 'nuoc_mam'],
    };
    expect(validateUserProfile(validProfile).success).toBe(true);

    // Dị ứng sai mã
    expect(
      validateUserProfile({ ...validProfile, allergies: ['pollen'] }).success,
    ).toBe(false);
  });

  it('SafetyRuleSchema kiểm tra quy tắc an toàn', () => {
    const validRule = {
      id: 'SAFE_RAW_POULTRY',
      title: 'Không rửa thịt gà sống dưới vòi nước',
      category: 'hygiene',
      description: 'Rửa thịt gà sống có thể làm vi khuẩn bắn ra các bề mặt bếp xung quanh.',
      requiresConfirmation: true,
      source: 'CDC - Food Safety Guidelines',
    };
    expect(validateSafetyRule(validRule).success).toBe(true);
  });
});
