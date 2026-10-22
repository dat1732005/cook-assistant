/**
 * File: packages/core/src/__tests__/schema.test.ts
 * Làm gì: Bộ kiểm thử đơn vị cho toàn bộ Zod schemas (snake_case chuẩn theo docs/plan.md), validator và hàm quy đổi đơn vị.
 * Nhận vào:
 *   - JSON mẫu công thức đọc trực tiếp từ docs/plan.md (không dán bản sao).
 *   - Dữ liệu mẫu (fixtures/recipes.ts) cho 4 ca công thức hợp lệ còn lại và 15 ca công thức sai.
 *   - Ít nhất 2 ca hợp lệ và 3 ca sai cho mỗi thực thể mới: Ingredient, PantryItem, PantryEvent, CookSession, UserProfile, StorageRule.
 * Trả ra: Kết quả kiểm thử thành công (pass) hoặc thất bại (fail) của Vitest.
 * Ai gọi: Lệnh `pnpm test` tại packages/core hoặc thư mục gốc monorepo.
 * Bám theo: Mục T02 trong docs/tasks.md, docs/plan.md dòng 168-300.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  validateRecipe,
  validateIngredient,
  validatePantryItem,
  validatePantryEvent,
  validateCookSession,
  validateUserProfile,
  validateStorageRule,
  validateSafetyRule,
} from '../validators/index.js';
import {
  convertToBaseUnit,
  convertUnit,
  isBaseUnit,
} from '../units/conversions.js';
import {
  VALID_RECIPE_RAU_MUONG_LUOC,
  VALID_RECIPE_REVIEWED,
  VALID_RECIPE_PUBLISHED,
  VALID_RECIPE_SINH_TO,
  INVALID_RECIPE_CASES,
} from '../fixtures/recipes.js';

/**
 * Hàm đọc trực tiếp khối JSON mẫu "trung-chien-ca-chua" từ file docs/plan.md.
 * Không dán bản sao tĩnh; nạp nội dung thực tế từ tài liệu kế hoạch.
 */
function readSampleRecipeJsonFromPlan(): Record<string, unknown> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDir, '../../../../docs/plan.md'),
    path.resolve(process.cwd(), 'docs/plan.md'),
    path.resolve(process.cwd(), '../../docs/plan.md'),
  ];
  const planPath = candidatePaths.find((p) => fs.existsSync(p));
  if (!planPath) {
    throw new Error(
      `Không tìm thấy file docs/plan.md tại các vị trí tìm kiếm: ${candidatePaths.join(', ')}`,
    );
  }
  const content = fs.readFileSync(planPath, 'utf8');
  const match = content.match(
    /```json\s*(\{[\s\S]*?"slug"\s*:\s*"trung-chien-ca-chua"[\s\S]*?\})\s*```/,
  );
  if (!match || !match[1]) {
    throw new Error(
      'Không tìm thấy khối JSON mẫu món "trung-chien-ca-chua" trong docs/plan.md',
    );
  }
  return JSON.parse(match[1]) as Record<string, unknown>;
}

describe('T02: Kiểm tra công thức nấu ăn đọc trực tiếp từ docs/plan.md và fixtures', () => {
  it('Ca 1: Validator chấp nhận khối JSON gốc đọc TRỰC TIẾP từ docs/plan.md', () => {
    const rawJsonFromPlan = readSampleRecipeJsonFromPlan();
    expect(rawJsonFromPlan).toBeDefined();

    const result = validateRecipe(rawJsonFromPlan);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('trung-chien-ca-chua');
      expect(result.data.name).toBe('Trứng chiên cà chua');
      expect(result.data.servings_base).toBe(2);
      expect(result.data.difficulty).toBe(1);
      expect(result.data.equipment).toEqual(['chao', 'to', 'dao-thot']);
      expect(result.data.ingredients).toHaveLength(6);
      expect(result.data.steps).toHaveLength(5);
      expect(result.data.status).toBe('draft');
      expect(result.data.version).toBe(1);
    }
  });

  it('Chứng minh nếu khối JSON gốc trong docs/plan.md bị đổi sai thì test sẽ đỏ (fail)', () => {
    const rawJsonFromPlan = readSampleRecipeJsonFromPlan();

    // 1. Giả lập đổi số phần gốc thành số âm
    const tamperedServings = {
      ...rawJsonFromPlan,
      servings_base: -2,
    };
    const resultServings = validateRecipe(tamperedServings);
    expect(resultServings.success).toBe(false);
    if (!resultServings.success) {
      expect(resultServings.errors.some((e) => e.includes('servings_base'))).toBe(true);
    }

    // 2. Giả lập xóa bỏ slug
    const tamperedSlug = {
      ...rawJsonFromPlan,
      slug: '',
    };
    const resultSlug = validateRecipe(tamperedSlug);
    expect(resultSlug.success).toBe(false);

    // 3. Giả lập đổi độ khó ngoài khoảng 1-3
    const tamperedDifficulty = {
      ...rawJsonFromPlan,
      difficulty: 99,
    };
    const resultDiff = validateRecipe(tamperedDifficulty);
    expect(resultDiff.success).toBe(false);
  });

  it('Ca 2: Món "Rau muống luộc" có bước passive tự đun', () => {
    const result = validateRecipe(VALID_RECIPE_RAU_MUONG_LUOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('rau-muong-luoc');
      expect(result.data.steps.some((s) => s.kind === 'passive')).toBe(true);
      expect(result.data.total_minutes).toBe(15);
      expect(result.data.tags).toContain('luoc');
    }
  });

  it('Ca 3: Món đã kiểm duyệt "Canh mây cà chua" (reviewed)', () => {
    const result = validateRecipe(VALID_RECIPE_REVIEWED);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('reviewed');
      expect(result.data.reviewer).toBe('Chuyên gia ẩm thực Nguyễn Văn A');
      expect(result.data.reviewed_at).toBe('2026-10-20T08:00:00Z');
    }
  });

  it('Ca 4: Món đã phát hành "Thịt kho trứng" (published)', () => {
    const result = validateRecipe(VALID_RECIPE_PUBLISHED);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('published');
      expect(result.data.version).toBe(2);
      expect(result.data.reviewer).toBe('Hội đồng thẩm định ẩm thực');
      expect(result.data.reviewed_at).toBe('2026-10-20T09:00:00Z');
    }
  });

  it('Ca 5: Món ăn nhanh "Sinh tố bơ" có ghi chú lượng amount_note', () => {
    const result = validateRecipe(VALID_RECIPE_SINH_TO);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servings_base).toBe(1);
      expect(result.data.ingredients[1]?.amount_note).toBe('khoảng 2 thìa vừa ngọt');
    }
  });
});

describe('T02: Bắt lỗi 15 ca sai bắt buộc của công thức', () => {
  INVALID_RECIPE_CASES.forEach((testCase, index) => {
    it(`Ca sai ${index + 1}: ${testCase.name}`, () => {
      const result = validateRecipe(testCase.data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        const hasMatchingError = result.errors.some((err) =>
          err.toLowerCase().includes(testCase.expectedErrorSubstring.toLowerCase()),
        );
        expect(
          hasMatchingError,
          `Mong đợi lỗi chứa từ khóa "${testCase.expectedErrorSubstring}", nhưng danh sách lỗi thực tế là: ${result.errors.join('; ')}`,
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
    const conversions = { quả: 55 };
    const result = convertToBaseUnit(3, 'quả', 'g', conversions);
    expect(result).toBe(165);
  });

  it('Đổi theo thể tích chuẩn mặc định cho chất lỏng (thìa cà phê -> ml, thìa canh -> ml)', () => {
    expect(convertToBaseUnit(3, 'thìa cà phê', 'ml')).toBe(15);
    expect(convertToBaseUnit(2, 'thìa canh', 'ml')).toBe(30);
  });

  it('Dùng chén khi chưa có quy đổi trong bảng conversions riêng phải ném lỗi (MISSING)', () => {
    expect(() => convertToBaseUnit(1, 'chén', 'ml', null)).toThrow(
      /Không thể quy đổi đơn vị "chén" sang đơn vị gốc "ml" do đơn vị "chén" đang ở trạng thái MISSING/,
    );
  });

  it('Quy đổi giữa hai đơn vị không phải gốc (g -> quả qua bảng conversions)', () => {
    const conversions = { quả: 50 };
    expect(convertUnit(150, 'g', 'quả', 'g', conversions)).toBe(3);
  });

  it('Ném lỗi khi đơn vị lạ không có quy tắc chuyển đổi', () => {
    expect(() => convertToBaseUnit(2, 'bó', 'g', {})).toThrow(
      /Không thể quy đổi đơn vị/,
    );
  });

  it('Thìa kèm nguyên liệu dạng rắn (baseUnit: g) mà không có quy đổi riêng phải ném lỗi', () => {
    expect(() => convertToBaseUnit(2, 'thìa cà phê', 'g', null)).toThrow(
      /Không thể quy đổi đơn vị "thìa cà phê" sang đơn vị gốc "g"/,
    );
  });
});

describe('T02: Kiểm tra thực thể Ingredient (ít nhất 2 ca hợp lệ, 3 ca sai)', () => {
  it('Ca hợp lệ 1: Nguyên liệu đầy đủ các trường theo docs/plan.md dòng 175', () => {
    const validFull = {
      id: 'trung-ga',
      name: 'Trứng gà',
      aliases: ['hột gà', 'trứng gà ta'],
      group: 'trung-sua',
      base_unit: 'cái',
      conversions: { quả: 1, chục: 10 },
      allergen_code: 'egg',
      reference_price: 3500,
      price_updated_at: '2026-10-22',
      storage_rule_id: 'sr-trung-ga',
    };
    const result = validateIngredient(validFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('trung-ga');
      expect(result.data.base_unit).toBe('cái');
      expect(result.data.allergen_code).toBe('egg');
    }
  });

  it('Ca hợp lệ 2: Nguyên liệu tối giản chỉ có các trường bắt buộc', () => {
    const validMinimal = {
      id: 'muoi',
      name: 'Muối ăn',
      group: 'gia-vi',
      base_unit: 'g',
    };
    const result = validateIngredient(validMinimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aliases).toEqual([]);
      expect(result.data.conversions).toEqual({});
    }
  });

  it('Ca sai 1: Bắt lỗi khi mã id rỗng', () => {
    const invalid = {
      id: '',
      name: 'Muối ăn',
      group: 'gia-vi',
      base_unit: 'g',
    };
    const result = validateIngredient(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 2: Bắt lỗi khi base_unit không thuộc g|ml|cái', () => {
    const invalid = {
      id: 'trung-ga',
      name: 'Trứng gà',
      group: 'trung-sua',
      base_unit: 'quả', // Sai: phải là 'cái'
    };
    const result = validateIngredient(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 3: Bắt lỗi khi giá tham khảo reference_price là số âm', () => {
    const invalid = {
      id: 'dau-an',
      name: 'Dầu ăn',
      group: 'dau-mo',
      base_unit: 'ml',
      reference_price: -5000,
    };
    const result = validateIngredient(invalid);
    expect(result.success).toBe(false);
  });
});

describe('T02: Kiểm tra thực thể PantryItem (ít nhất 2 ca hợp lệ, 3 ca sai)', () => {
  it('Ca hợp lệ 1: Mục kho đầy đủ các trường theo docs/plan.md dòng 179', () => {
    const validFull = {
      id: 'pantry-item-01',
      ingredient_id: 'trung-ga',
      quantity: 6,
      base_unit: 'cái',
      storage_location: 'fridge',
      added_at: '2026-10-22',
      opened_at: '2026-10-22',
      expiry_date: '2026-11-05',
      source: 'shopping',
    };
    const result = validatePantryItem(validFull);
    expect(result.success).toBe(true);
  });

  it('Ca hợp lệ 2: Mục kho tối giản nhập từ manual', () => {
    const validMinimal = {
      id: 'pantry-item-02',
      ingredient_id: 'dau-an',
      quantity: 500,
      base_unit: 'ml',
      storage_location: 'pantry',
      added_at: '2026-10-20',
      source: 'manual',
    };
    const result = validatePantryItem(validMinimal);
    expect(result.success).toBe(true);
  });

  it('Ca sai 1: Bắt lỗi khi số lượng tồn kho quantity bị âm', () => {
    const invalid = {
      id: 'pantry-item-03',
      ingredient_id: 'muoi',
      quantity: -10,
      base_unit: 'g',
      storage_location: 'pantry',
      added_at: '2026-10-20',
      source: 'manual',
    };
    const result = validatePantryItem(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 2: Bắt lỗi khi đơn vị gốc base_unit không thuộc g|ml|cái', () => {
    const invalid = {
      id: 'pantry-item-04',
      ingredient_id: 'dau-an',
      quantity: 2,
      base_unit: 'chai',
      storage_location: 'pantry',
      added_at: '2026-10-20',
      source: 'manual',
    };
    const result = validatePantryItem(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 3: Bắt lỗi khi source không thuộc manual|cook|shopping|photo', () => {
    const invalid = {
      id: 'pantry-item-05',
      ingredient_id: 'trung-ga',
      quantity: 5,
      base_unit: 'cái',
      storage_location: 'fridge',
      added_at: '2026-10-20',
      source: 'gift', // Không hợp lệ
    };
    const result = validatePantryItem(invalid);
    expect(result.success).toBe(false);
  });
});

describe('T02: Kiểm tra thực thể PantryEvent (ít nhất 2 ca hợp lệ, 3 ca sai)', () => {
  it('Ca hợp lệ 1: Sự kiện xuất kho khi nấu ăn (reason = "cook", delta âm)', () => {
    const validCook = {
      id: 'event-01',
      pantry_item_id: 'pantry-item-01',
      delta: -3,
      reason: 'cook',
      cook_session_id: 'session-01',
      created_at: '2026-10-22T10:00:00Z',
    };
    const result = validatePantryEvent(validCook);
    expect(result.success).toBe(true);
  });

  it('Ca hợp lệ 2: Sự kiện nhập kho khi mua sắm (reason = "buy", delta dương)', () => {
    const validBuy = {
      id: 'event-02',
      pantry_item_id: 'pantry-item-01',
      delta: 10,
      reason: 'buy',
      created_at: '2026-10-22T08:30:00Z',
    };
    const result = validatePantryEvent(validBuy);
    expect(result.success).toBe(true);
  });

  it('Ca sai 1: Bắt lỗi khi lý do biến động reason không thuộc cook|adjust|discard|buy', () => {
    const invalid = {
      id: 'event-03',
      pantry_item_id: 'pantry-item-01',
      delta: -1,
      reason: 'borrow', // Sai enum
      created_at: '2026-10-22T10:00:00Z',
    };
    const result = validatePantryEvent(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 2: Bắt lỗi khi thiếu pantry_item_id', () => {
    const invalid = {
      id: 'event-04',
      pantry_item_id: '',
      delta: -2,
      reason: 'discard',
      created_at: '2026-10-22T10:00:00Z',
    };
    const result = validatePantryEvent(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 3: Bắt lỗi khi delta không phải là số hợp lệ', () => {
    const invalid = {
      id: 'event-05',
      pantry_item_id: 'pantry-item-01',
      delta: 'hai-qua', // Sai kiểu dữ liệu
      reason: 'adjust',
      created_at: '2026-10-22T10:00:00Z',
    };
    const result = validatePantryEvent(invalid);
    expect(result.success).toBe(false);
  });
});

describe('T02: Kiểm tra thực thể CookSession (ít nhất 2 ca hợp lệ, 3 ca sai)', () => {
  it('Ca hợp lệ 1: Phiên nấu đang diễn ra có running_timers với trường endsAt chuẩn camelCase', () => {
    const validCooking = {
      id: 'session-01',
      recipe_id: 'trung-chien-ca-chua',
      recipe_version: 1,
      servings: 2,
      optimization_mode: 'fastest',
      started_at: '2026-10-22T10:00:00Z',
      status: 'cooking',
      step_states: { s1: 'completed', s2: 'active' },
      removed_or_substituted: {},
      running_timers: [
        {
          id: 'timer-01',
          step_id: 's2',
          label: 'Chiên trứng',
          endsAt: '2026-10-22T10:03:00Z', // Bắt buộc giữ camelCase theo kế hoạch!
        },
      ],
    };
    const result = validateCookSession(validCooking);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('cooking');
      expect(result.data.running_timers[0]?.endsAt).toBe('2026-10-22T10:03:00Z');
    }
  });

  it('Ca hợp lệ 2: Phiên nấu hoàn thành (status = "done") với nguyên liệu bị bỏ bớt', () => {
    const validDone = {
      id: 'session-02',
      recipe_id: 'trung-chien-ca-chua',
      recipe_version: 1,
      servings: 4,
      optimization_mode: 'fewest_tools',
      started_at: '2026-10-22T09:00:00Z',
      completed_at: '2026-10-22T09:25:00Z',
      status: 'done',
      step_states: { s1: 'completed', s2: 'completed', s3: 'completed' },
      removed_or_substituted: { 'hanh-la': null },
      running_timers: [],
    };
    const result = validateCookSession(validDone);
    expect(result.success).toBe(true);
  });

  it('Ca sai 1: Bắt lỗi khi status không thuộc cooking|done|abandoned', () => {
    const invalid = {
      id: 'session-03',
      recipe_id: 'trung-chien-ca-chua',
      recipe_version: 1,
      servings: 2,
      optimization_mode: 'fastest',
      started_at: '2026-10-22T10:00:00Z',
      status: 'completed', // Sai: phải là 'done' theo kế hoạch dòng 181
    };
    const result = validateCookSession(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 2: Bắt lỗi khi số phần ăn servings <= 0', () => {
    const invalid = {
      id: 'session-04',
      recipe_id: 'trung-chien-ca-chua',
      recipe_version: 1,
      servings: 0,
      optimization_mode: 'fastest',
      started_at: '2026-10-22T10:00:00Z',
      status: 'cooking',
    };
    const result = validateCookSession(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 3: Bắt lỗi khi timer trong running_timers thiếu trường endsAt', () => {
    const invalid = {
      id: 'session-05',
      recipe_id: 'trung-chien-ca-chua',
      recipe_version: 1,
      servings: 2,
      optimization_mode: 'fastest',
      started_at: '2026-10-22T10:00:00Z',
      status: 'cooking',
      running_timers: [
        {
          id: 'timer-broken',
          step_id: 's1',
          // Thiếu endsAt
        },
      ],
    };
    const result = validateCookSession(invalid);
    expect(result.success).toBe(false);
  });
});

describe('T02: Kiểm tra thực thể UserProfile (ít nhất 2 ca hợp lệ, 3 ca sai)', () => {
  it('Ca hợp lệ 1: Hồ sơ người dùng đầy đủ các trường theo docs/plan.md dòng 174', () => {
    const validFull = {
      id: 'user-01',
      display_name: 'Người nấu tại gia',
      servings: 3,
      allergies: ['peanut', 'egg'],
      dietary_preference: 'eat_clean',
      essential_spices: ['muoi', 'duong', 'nuoc-mam', 'tieu'],
      available_equipment: ['chao', 'noi', 'dao-thot'],
    };
    const result = validateUserProfile(validFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servings).toBe(3);
      expect(result.data.allergies).toEqual(['peanut', 'egg']);
    }
  });

  it('Ca hợp lệ 2: Hồ sơ người dùng tối giản nhận các giá trị mặc định', () => {
    const validMinimal = {
      id: 'user-default',
    };
    const result = validateUserProfile(validMinimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servings).toBe(2);
      expect(result.data.allergies).toEqual([]);
      expect(result.data.essential_spices).toEqual([]);
      expect(result.data.available_equipment).toEqual([]);
    }
  });

  it('Ca sai 1: Bắt lỗi khi mã dị ứng không nằm trong 8 mã chuẩn', () => {
    const invalid = {
      id: 'user-02',
      allergies: ['pollen'], // Sai mã
    };
    const result = validateUserProfile(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 2: Bắt lỗi khi số người ăn servings <= 0', () => {
    const invalid = {
      id: 'user-03',
      servings: -1,
    };
    const result = validateUserProfile(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 3: Bắt lỗi khi mã người dùng id rỗng', () => {
    const invalid = {
      id: '',
    };
    const result = validateUserProfile(invalid);
    expect(result.success).toBe(false);
  });
});

describe('T02: Kiểm tra thực thể StorageRule (ít nhất 2 ca hợp lệ, 3 ca sai)', () => {
  it('Ca hợp lệ 1: Quy tắc bảo quản đồ tươi trong ngăn mát theo docs/plan.md dòng 183', () => {
    const validFridge = {
      id: 'sr-thit-bo-tuoi',
      target_id_or_group: 'thit-bo',
      state: 'fresh',
      location: 'fridge',
      max_days: 3,
      source_name: 'Cục An toàn thực phẩm - Bộ Y Tế',
      source_url: 'https://vfa.gov.vn/huong-dan-bao-quan-thit-tuoi',
    };
    const result = validateStorageRule(validFridge);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toBe('fresh');
      expect(result.data.location).toBe('fridge');
      expect(result.data.max_days).toBe(3);
    }
  });

  it('Ca hợp lệ 2: Quy tắc bảo quản đồ đã nấu chín trong ngăn đông', () => {
    const validFreezer = {
      id: 'sr-thit-kho-da-nau',
      target_id_or_group: 'nhom-thit',
      state: 'cooked',
      location: 'freezer',
      max_days: 60,
      source_name: 'USDA Food Safety Guidelines',
      source_url: 'https://www.fsis.usda.gov/food-safety/safe-food-storage',
    };
    const result = validateStorageRule(validFreezer);
    expect(result.success).toBe(true);
  });

  it('Ca sai 1: Bắt lỗi khi trạng thái state không thuộc fresh|opened|cooked', () => {
    const invalid = {
      id: 'sr-invalid-state',
      target_id_or_group: 'thit-bo',
      state: 'raw', // Sai: phải là 'fresh'
      location: 'fridge',
      max_days: 3,
      source_name: 'Cục An toàn thực phẩm',
      source_url: 'https://vfa.gov.vn',
    };
    const result = validateStorageRule(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 2: Bắt lỗi khi vị trí location không thuộc fridge|freezer|room_temperature', () => {
    const invalid = {
      id: 'sr-invalid-loc',
      target_id_or_group: 'thit-bo',
      state: 'fresh',
      location: 'outdoor', // Sai vị trí
      max_days: 3,
      source_name: 'Cục An toàn thực phẩm',
      source_url: 'https://vfa.gov.vn',
    };
    const result = validateStorageRule(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai 3: Bắt lỗi khi max_days là số âm', () => {
    const invalid = {
      id: 'sr-negative-days',
      target_id_or_group: 'thit-bo',
      state: 'fresh',
      location: 'fridge',
      max_days: -5,
      source_name: 'Cục An toàn thực phẩm',
      source_url: 'https://vfa.gov.vn',
    };
    const result = validateStorageRule(invalid);
    expect(result.success).toBe(false);
  });
});

describe('T02: Kiểm tra thực thể SafetyRule (quy tắc an toàn theo docs/plan.md dòng 178, 236)', () => {
  it('Ca hợp lệ: Quy tắc an toàn khi chế biến thịt gia cầm', () => {
    const valid = {
      id: 'SAFE_POULTRY_COOK_TEMP',
      title: 'Nhiệt độ an toàn khi nấu thịt gà',
      category: 'temperature',
      description: 'Thịt gia cầm cần đạt nhiệt độ tâm tối thiểu 74°C để tiêu diệt vi khuẩn Salmonella.',
      requires_confirmation: true,
      source_name: 'Bộ Y Tế & CDC',
      source_url: 'https://www.cdc.gov/foodsafety/communication/chicken.html',
    };
    const result = validateSafetyRule(valid);
    expect(result.success).toBe(true);
  });

  it('Ca sai: Bắt lỗi khi thiếu tiêu đề và phân loại sai', () => {
    const invalid = {
      id: 'SAFE_BROKEN',
      title: '',
      category: 'alien_category',
      description: 'Mô tả',
    };
    const result = validateSafetyRule(invalid);
    expect(result.success).toBe(false);
  });
});
