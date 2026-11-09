import { describe, it, expect } from 'vitest';
import {
  check,
  allergyConflicts,
  canStartRecipe,
  formatSafetyWarning,
  DEFAULT_SAFETY_RULES,
} from '../safety/safety-service.js';
import { Recipe, RecipeStep } from '../schemas/recipe.js';
import { SafetyRule } from '../schemas/safety.js';

describe('T16: SafetyRules trong app', () => {
  const sampleStepWithPoultry: RecipeStep = {
    id: 's-poultry',
    kind: 'active',
    seconds: 300,
    text: 'Nướng gà đến khi chín kỹ',
    safety_rule: 'SAFE_POULTRY_COOK_TEMP',
    after: [],
    resources: ['chao'],
  };

  const sampleStepWithoutRule: RecipeStep = {
    id: 's-normal',
    kind: 'active',
    seconds: 60,
    text: 'Rửa rau muống dưới vòi nước',
    after: [],
    resources: [],
  };

  const sampleStepMissing: RecipeStep = {
    id: 's-missing',
    kind: 'active',
    seconds: 120,
    text: 'Thao tác cần quy tắc an toàn',
    safety_rule: 'MISSING',
    after: [],
    resources: [],
  };

  const sampleRecipe: Recipe = {
    slug: 'ga-xao-sa-ot',
    name: 'Gà xào sả ớt',
    status: 'published',
    servings_base: 2,
    total_minutes: 25,
    equipment: ['chao'],
    tags: ['mon-chinh'],
    version: 1,
    missing_fields: [],
    ingredients: [
      {
        ingredient: 'thit-ga',
        qty: 300,
        unit: 'g',
        role: 'structure',
        flavor_group: 'none',
        optional: false,
      },
      {
        ingredient: 'dau-phong',
        qty: 50,
        unit: 'g',
        role: 'flavor',
        flavor_group: 'fat',
        optional: false,
      },
      {
        ingredient: 'nuoc-mam',
        qty: 20,
        unit: 'ml',
        role: 'flavor',
        flavor_group: 'salt',
        optional: false,
      },
    ],
    steps: [sampleStepWithPoultry, sampleStepWithoutRule],
  };

  describe('1. check(step)', () => {
    it('Bước có safety_rule hợp lệ -> trả về đúng SafetyRule tương ứng', () => {
      const rule = check(sampleStepWithPoultry);
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe('SAFE_POULTRY_COOK_TEMP');
      expect(rule?.category).toBe('temperature');
      expect(rule?.source_name).toContain('Bộ Y tế');
    });

    it('Bước không có safety_rule -> trả về null', () => {
      const rule = check(sampleStepWithoutRule);
      expect(rule).toBeNull();
    });

    it('Bước có safety_rule không tồn tại -> trả về null', () => {
      const rule = check({ ...sampleStepWithoutRule, safety_rule: 'NON_EXISTENT' });
      expect(rule).toBeNull();
    });
  });

  describe('2. allergyConflicts(recipe, profile)', () => {
    const allergenMap: Record<string, string[]> = {
      'dau-phong': ['peanut'],
      'thit-ga': [],
      'nuoc-mam': ['fish'],
    };

    it('Người dùng dị ứng đậu phộng (peanut) -> phát hiện đúng xung đột với dau-phong', () => {
      const conflicts = allergyConflicts(sampleRecipe, { allergies: ['peanut'] }, allergenMap);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toEqual({
        ingredient: 'dau-phong',
        allergen: 'peanut',
      });
    });

    it('Người dùng dị ứng cá (fish) và đậu phộng (peanut) -> phát hiện 2 xung đột', () => {
      const conflicts = allergyConflicts(sampleRecipe, { allergies: ['peanut', 'fish'] }, allergenMap);
      expect(conflicts).toHaveLength(2);
      expect(conflicts.map((c) => c.allergen)).toContain('peanut');
      expect(conflicts.map((c) => c.allergen)).toContain('fish');
    });

    it('Người dùng không khai dị ứng hoặc rỗng -> trả về mảng rỗng []', () => {
      const c1 = allergyConflicts(sampleRecipe, { allergies: [] }, allergenMap);
      const c2 = allergyConflicts(sampleRecipe, null, allergenMap);
      const c3 = allergyConflicts(sampleRecipe, { allergies: ['egg'] }, allergenMap);
      expect(c1).toEqual([]);
      expect(c2).toEqual([]);
      expect(c3).toEqual([]);
    });
  });

  describe('3. Cảnh báo luôn hiển thị nguồn (formatSafetyWarning)', () => {
    it('Cảnh báo an toàn bắt buộc phải chứa tên nguồn và đường dẫn', () => {
      const rule: SafetyRule = DEFAULT_SAFETY_RULES[0]!;
      const warning = formatSafetyWarning(rule);
      expect(warning).toContain('[CẢNH BÁO AN TOÀN]');
      expect(warning).toContain(rule.title);
      expect(warning).toContain('Nguồn:');
      expect(warning).toContain(rule.source_name!);
      expect(warning).toContain(rule.source_url!);
    });
  });

  describe('4. canStartRecipe: quy tắc MISSING chặn bắt đầu món', () => {
    it('Công thức hoàn chỉnh với quy tắc chuẩn -> cho phép bắt đầu món', () => {
      const result = canStartRecipe(sampleRecipe);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('Bước nấu có safety_rule là "MISSING" -> chặn bắt đầu món ngay lập tức', () => {
      const badRecipe: Recipe = {
        ...sampleRecipe,
        steps: [sampleStepWithPoultry, sampleStepMissing],
      };
      const result = canStartRecipe(badRecipe);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Chặn bắt đầu món');
      expect(result.missingRuleId).toBe('MISSING');
    });

    it('Bước nấu tham chiếu quy tắc không tồn tại trong danh mục -> chặn bắt đầu món', () => {
      const invalidRecipe: Recipe = {
        ...sampleRecipe,
        steps: [{ ...sampleStepWithoutRule, safety_rule: 'UNKNOWN_SAFETY_CODE' }],
      };
      const result = canStartRecipe(invalidRecipe);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('không tồn tại');
    });

    it('Quy tắc an toàn còn missing_fields -> chặn bắt đầu món', () => {
      const customRules: SafetyRule[] = [
        {
          ...DEFAULT_SAFETY_RULES[0]!,
          missing_fields: ['confirmed_by', 'safe_temp_threshold'],
        },
      ];
      const result = canStartRecipe(sampleRecipe, customRules);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('còn thiếu các trường dữ liệu');
    });
  });
});
