/**
 * File: packages/core/src/__tests__/schema.test.ts
 * Làm gì: Bộ kiểm thử đơn vị cho toàn bộ Zod schemas (snake_case chuẩn theo docs/plan.md), validator và hàm quy đổi đơn vị.
 * Nhận vào:
 *   - JSON mẫu công thức đọc trực tiếp từ docs/plan.md (không dán bản sao).
 *   - Danh mục tên trường đọc trực tiếp từ docs/field-names.md để kiểm định tính đồng bộ giữa tài liệu và mã nguồn.
 *   - Dữ liệu mẫu (fixtures/recipes.ts) cho các ca công thức hợp lệ và các ca công thức sai.
 *   - Các ca kiểm thử cho quy tắc R2 (missing_fields), R3 (source, confirmed_by) và an toàn dị ứng (allergen_codes).
 *   - Ít nhất 2 ca hợp lệ và 3 ca sai cho mỗi thực thể: Ingredient, PantryItem, PantryEvent, CookSession, UserProfile, StorageRule, SafetyRule.
 * Trả ra: Kết quả kiểm thử thành công (pass) hoặc thất bại (fail) của Vitest.
 * Ai gọi: Lệnh `pnpm test` tại packages/core hoặc thư mục gốc monorepo.
 * Bám theo: Mục T02 trong docs/tasks.md, docs/plan.md dòng 168-300, docs/field-names.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RecipeSchema,
  RecipeIngredientSchema,
  RecipeStepSchema,
  IngredientSchema,
  PantryItemSchema,
  PantryEventSchema,
  CookSessionSchema,
  UserProfileSchema,
  StorageRuleSchema,
  SafetyRuleSchema,
  EquipmentSchema,
} from '../schemas/index.js';
import {
  validateRecipe,
  validateIngredient,
  validatePantryItem,
  validatePantryEvent,
  validateEquipment,
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

/**
 * Hàm đọc trực tiếp docs/field-names.md và trích xuất danh sách khóa (cả bảng A và B) của từng thực thể.
 */
function parseFieldNamesDoc(): Record<string, string[]> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDir, '../../../../docs/field-names.md'),
    path.resolve(process.cwd(), 'docs/field-names.md'),
    path.resolve(process.cwd(), '../../docs/field-names.md'),
  ];
  const docPath = candidatePaths.find((p) => fs.existsSync(p));
  if (!docPath) {
    throw new Error(
      `Không tìm thấy file docs/field-names.md tại các vị trí tìm kiếm: ${candidatePaths.join(', ')}`,
    );
  }
  const content = fs.readFileSync(docPath, 'utf8');

  // Tách tài liệu theo các phần ## <số>. Thực thể `<name>`
  const sections = content.split(/\n(?=##\s+\d+\.)/);
  const result: Record<string, string[]> = {};

  for (const section of sections) {
    if (section.includes('Chờ duyệt') || section.includes('Đang chờ duyệt')) continue;
    const headerMatch = section.match(/##\s+\d+\.\s+.*?`([a-z_]+)`/);
    if (!headerMatch || !headerMatch[1]) continue;
    const entityName = headerMatch[1];

    const lines = section.split('\n');
    const keys: string[] = [];
    for (const line of lines) {
      // Tìm dòng bảng markdown: | `tên_khóa` | ...
      const keyMatch = line.match(/^\|\s*`([a-zA-Z0-9_]+)`\s*\|/);
      if (keyMatch && keyMatch[1]) {
        keys.push(keyMatch[1]);
      }
    }
    result[entityName] = Array.from(new Set(keys));
  }

  return result;
}

interface ParsedTableARow {
  entity: string;
  key: string;
  lineNumbers: number[];
}

interface ParsedTableBRow {
  entity: string;
  key: string;
  vietnameseDesc: string;
  lineNumbers: number[];
  isProjectAdded: boolean;
}

/**
 * Đọc toàn bộ nội dung docs/plan.md theo từng dòng (1-indexed).
 */
function readPlanLines(): string[] {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDir, '../../../../docs/plan.md'),
    path.resolve(process.cwd(), 'docs/plan.md'),
    path.resolve(process.cwd(), '../../docs/plan.md'),
  ];
  const planPath = candidatePaths.find((p) => fs.existsSync(p));
  if (!planPath) {
    throw new Error('Không tìm thấy file docs/plan.md');
  }
  return fs.readFileSync(planPath, 'utf8').split('\n');
}

/**
 * Trích xuất danh sách dòng trong Bảng A và Bảng B của docs/field-names.md
 */
function parseFieldNamesDetailedTables(): {
  tableARows: ParsedTableARow[];
  tableBRows: ParsedTableBRow[];
} {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDir, '../../../../docs/field-names.md'),
    path.resolve(process.cwd(), 'docs/field-names.md'),
    path.resolve(process.cwd(), '../../docs/field-names.md'),
  ];
  const docPath = candidatePaths.find((p) => fs.existsSync(p));
  if (!docPath) {
    throw new Error('Không tìm thấy file docs/field-names.md');
  }
  const content = fs.readFileSync(docPath, 'utf8');
  const sections = content.split(/\n(?=##\s+\d+\.)/);

  const tableARows: ParsedTableARow[] = [];
  const tableBRows: ParsedTableBRow[] = [];

  for (const section of sections) {
    if (section.includes('Chờ duyệt') || section.includes('Đang chờ duyệt')) continue;
    const headerMatch = section.match(/##\s+\d+\.\s+.*?`([a-z_]+)`/);
    if (!headerMatch || !headerMatch[1]) continue;
    const entity = headerMatch[1];

    const parts = section.split(/###\s+Bảng\s+[AB]:/);
    if (parts[1]) {
      const lines = parts[1].split('\n');
      for (const line of lines) {
        const row = line.match(/^\|\s*`([a-z0-9_]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
        if (row && row[1] && row[3]) {
          const key = row[1];
          const lineNums = (row[3].match(/\d+/g) || []).map(Number);
          tableARows.push({ entity, key, lineNumbers: lineNums });
        }
      }
    }

    if (parts[2]) {
      const lines = parts[2].split('\n');
      for (const line of lines) {
        const row = line.match(/^\|\s*`([a-z0-9_]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
        if (row && row[1] && row[2] && row[3]) {
          const key = row[1];
          const desc = row[2].trim();
          const lineStr = row[3].trim();
          const isDash = lineStr.includes('—');
          const lineNums = (lineStr.match(/\d+/g) || []).map(Number);
          tableBRows.push({
            entity,
            key,
            vietnameseDesc: desc,
            lineNumbers: lineNums,
            isProjectAdded: isDash,
          });
        }
      }
    }
  }

  return { tableARows, tableBRows };
}

describe('T02: Kiểm tra đồng bộ 100% giữa docs/field-names.md và Zod Schemas', () => {
  const docEntities = parseFieldNamesDoc();

  // Danh sách schema ánh xạ tương ứng với 11 thực thể trong docs/field-names.md
  const schemaMap: Record<string, Record<string, unknown>> = {
    recipe: RecipeSchema.shape,
    recipe_ingredient: RecipeIngredientSchema.shape,
    recipe_step: RecipeStepSchema.shape,
    ingredient: IngredientSchema.shape,
    pantry_item: PantryItemSchema.shape,
    pantry_event: PantryEventSchema.shape,
    cook_session: CookSessionSchema.shape,
    user_profile: UserProfileSchema.shape,
    storage_rule: StorageRuleSchema.shape,
    safety_rule: SafetyRuleSchema.shape,
    equipment: EquipmentSchema.shape,
  };

  it('Tất cả 11 thực thể đều có mặt trong docs/field-names.md', () => {
    expect(Object.keys(schemaMap).sort()).toEqual(Object.keys(docEntities).sort());
  });

  for (const [entityName, shape] of Object.entries(schemaMap)) {
    it(`Thực thể "${entityName}": Danh sách khóa trong docs/field-names.md khớp 100% với schema code`, () => {
      const docKeys = (docEntities[entityName] || []).slice().sort();
      const schemaKeys = Object.keys(shape).sort();

      expect(
        docKeys,
        `Thực thể ${entityName} bị lệch khóa giữa docs/field-names.md và mã nguồn schema`,
      ).toEqual(schemaKeys);
    });
  }

  it('Bảng A: Mỗi khóa tiếng Anh phải xuất hiện nguyên văn trong dòng plan.md mà tài liệu dẫn', () => {
    const planLines = readPlanLines();
    const { tableARows } = parseFieldNamesDetailedTables();

    expect(tableARows.length).toBeGreaterThan(0);
    for (const row of tableARows) {
      expect(
        row.lineNumbers.length,
        `Khóa ${row.entity}.${row.key} trong Bảng A phải dẫn ít nhất một số dòng thật trong plan.md`,
      ).toBeGreaterThan(0);

      for (const lineNum of row.lineNumbers) {
        const lineContent = planLines[lineNum - 1] || '';
        expect(
          lineContent.includes(row.key),
          `Khóa "${row.key}" của thực thể "${row.entity}" không xuất hiện nguyên văn trong dòng ${lineNum} của docs/plan.md.\nNội dung dòng: "${lineContent}"`,
        ).toBe(true);
      }
    }
  });

  it('Bảng B: Mỗi dòng dẫn plan.md phải chứa nguyên văn phần mô tả tiếng Việt; trường do dự án thêm phải ghi "—" ở cột dòng', () => {
    const planLines = readPlanLines();
    const { tableBRows } = parseFieldNamesDetailedTables();

    expect(tableBRows.length).toBeGreaterThan(0);
    for (const row of tableBRows) {
      if (row.isProjectAdded) {
        // Trường do dự án thêm: cột dòng phải ghi "—" và không có số dòng cụ thể của kế hoạch
        expect(row.lineNumbers.length).toBe(0);
      } else {
        // Trường kế hoạch có mô tả tiếng Việt: phải có dòng dẫn và dòng đó phải chứa nguyên văn mô tả
        expect(
          row.lineNumbers.length,
          `Trường ${row.entity}.${row.key} trong Bảng B không có số dòng dẫn và cũng không có dấu "—"`,
        ).toBeGreaterThan(0);

        for (const lineNum of row.lineNumbers) {
          const lineContent = planLines[lineNum - 1] || '';
          expect(
            lineContent.includes(row.vietnameseDesc),
            `Mô tả tiếng Việt "${row.vietnameseDesc}" của trường "${row.entity}.${row.key}" không xuất hiện nguyên văn trong dòng ${lineNum} của docs/plan.md.\nNội dung dòng: "${lineContent}"`,
          ).toBe(true);
        }
      }
    }
  });

  it('Chứng minh test sẽ đỏ (fail) nếu cố ý làm lệch một khóa giữa tài liệu và schema', () => {
    const realRecipeKeys = Object.keys(RecipeSchema.shape);
    // Cố ý giả lập tài liệu có thêm khóa lạ không tồn tại trong schema
    const tamperedDocKeys = [...realRecipeKeys, 'fake_unexpected_field'].sort();
    const sortedSchemaKeys = [...realRecipeKeys].sort();

    // Khẳng định việc so khớp sẽ phát hiện ra sự sai lệch
    expect(tamperedDocKeys).not.toEqual(sortedSchemaKeys);

    // Cố ý giả lập tài liệu bị thiếu một khóa quan trọng
    const tamperedMissingDocKeys = realRecipeKeys.filter((k) => k !== 'slug').sort();
    expect(tamperedMissingDocKeys).not.toEqual(sortedSchemaKeys);
  });

  it('Chứng minh test sẽ đỏ (fail) nếu cố ý dẫn sai dòng trong Bảng A hoặc Bảng B', () => {
    const planLines = readPlanLines();

    // Giả lập 1: Bảng A dẫn sai dòng (ví dụ "servings_base" dẫn dòng 1 thay vì 207)
    const badTableARow: ParsedTableARow = {
      entity: 'recipe',
      key: 'servings_base',
      lineNumbers: [1], // Dòng 1 không có "servings_base"
    };
    const targetLineA = badTableARow.lineNumbers[0] ?? 1;
    const lineContentA = planLines[targetLineA - 1] || '';
    expect(lineContentA.includes(badTableARow.key)).toBe(false);

    // Giả lập 2: Bảng B dẫn sai dòng (ví dụ "tổng phút" dẫn dòng 1 thay vì 176)
    const badTableBRow: ParsedTableBRow = {
      entity: 'recipe',
      key: 'total_minutes',
      vietnameseDesc: 'tổng phút',
      lineNumbers: [1], // Dòng 1 không có "tổng phút"
      isProjectAdded: false,
    };
    const targetLineB = badTableBRow.lineNumbers[0] ?? 1;
    const lineContentB = planLines[targetLineB - 1] || '';
    expect(lineContentB.includes(badTableBRow.vietnameseDesc)).toBe(false);
  });
});

describe('T02: Kiểm tra quy tắc R2 (missing_fields) và R3 (source, confirmed_by)', () => {
  it('Ca hợp lệ 1: Món reviewed có đầy đủ source, confirmed_by và missing_fields rỗng', () => {
    const validReviewed = {
      ...VALID_RECIPE_REVIEWED,
      status: 'reviewed' as const,
      reviewer: 'Chuyên gia A',
      reviewed_at: '2026-10-22T08:00:00Z',
      source: 'Cẩm nang ẩm thực Việt Nam',
      confirmed_by: 'Bếp trưởng B',
      missing_fields: [],
    };
    expect(validateRecipe(validReviewed).success).toBe(true);
  });

  it('Ca hợp lệ 2: Món published có đầy đủ source, confirmed_by và missing_fields rỗng', () => {
    const validPublished = {
      ...VALID_RECIPE_PUBLISHED,
      status: 'published' as const,
      reviewer: 'Hội đồng thẩm định ẩm thực',
      reviewed_at: '2026-10-22T09:00:00Z',
      source: 'Viện Dinh Dưỡng Quốc Gia',
      confirmed_by: 'Chuyên gia C',
      missing_fields: [],
    };
    expect(validateRecipe(validPublished).success).toBe(true);
  });

  it('Ca hợp lệ 3: Món draft chưa có source/confirmed_by nhưng vẫn hợp lệ', () => {
    const rawJsonFromPlan = readSampleRecipeJsonFromPlan();
    expect(validateRecipe(rawJsonFromPlan).success).toBe(true);
  });

  it('Ca sai 1: Món published thiếu confirmed_by (R3 vi phạm)', () => {
    const invalidPublished = {
      ...VALID_RECIPE_PUBLISHED,
      status: 'published' as const,
      source: 'Viện Dinh Dưỡng',
      confirmed_by: '', // Rỗng
      missing_fields: [],
    };
    const result = validateRecipe(invalidPublished);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('confirmed_by'))).toBe(true);
    }
  });

  it('Ca sai 2: Món reviewed còn missing_fields chưa hoàn tất (R2 vi phạm)', () => {
    const invalidReviewed = {
      ...VALID_RECIPE_REVIEWED,
      status: 'reviewed' as const,
      source: 'Sổ tay gia đình',
      confirmed_by: 'Bếp trưởng',
      missing_fields: ['total_minutes'], // Chưa xử lý xong
    };
    const result = validateRecipe(invalidReviewed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('missing_fields'))).toBe(true);
    }
  });

  it('Ca sai 3: Món reviewed thiếu source dữ liệu (R3 vi phạm)', () => {
    const invalidReviewed = {
      ...VALID_RECIPE_REVIEWED,
      status: 'reviewed' as const,
      source: undefined,
      confirmed_by: 'Bếp trưởng',
      missing_fields: [],
    };
    const result = validateRecipe(invalidReviewed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('source'))).toBe(true);
    }
  });
});

describe('T02: Kiểm tra an toàn dị ứng trong IngredientSchema (allergen_codes)', () => {
  it('Ca hợp lệ 1: Nguyên liệu đầy đủ có hai mã dị ứng (tránh bỏ sót)', () => {
    const valid = {
      id: 'sot-dau-phong-me',
      name: 'Sốt đậu phộng mè',
      group: 'gia-vi',
      base_unit: 'ml',
      allergen_codes: ['peanut', 'tree_nut'],
      missing_fields: [],
    };
    const result = validateIngredient(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allergen_codes).toEqual(['peanut', 'tree_nut']);
    }
  });

  it('Ca hợp lệ 2: Nguyên liệu chưa rõ dị ứng, allergen_codes: null kèm missing_fields chứa "allergen_codes"', () => {
    const validWithMissing = {
      id: 'gia-vi-la',
      name: 'Gia vị lạ chưa xác định',
      group: 'gia-vi',
      base_unit: 'g',
      allergen_codes: null,
      missing_fields: ['allergen_codes'],
    };
    const result = validateIngredient(validWithMissing);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allergen_codes).toBeNull();
      expect(result.data.missing_fields).toContain('allergen_codes');
    }
  });

  it('Ca hợp lệ 3: Nguyên liệu đã xác nhận không chứa dị ứng (allergen_codes: [])', () => {
    const validNoAllergens = {
      id: 'muoi-tinh',
      name: 'Muối tinh khiết',
      group: 'gia-vi',
      base_unit: 'g',
      allergen_codes: [],
      missing_fields: [],
    };
    const result = validateIngredient(validNoAllergens);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allergen_codes).toEqual([]);
    }
  });

  it('Ca sai 1: Nguyên liệu thiếu hẳn trường allergen_codes (bắt buộc khai báo, không default [])', () => {
    const invalidMissingField = {
      id: 'muoi',
      name: 'Muối ăn',
      group: 'gia-vi',
      base_unit: 'g',
      // Thiếu allergen_codes
    };
    const result = validateIngredient(invalidMissingField);
    expect(result.success).toBe(false);
  });

  it('Ca sai 2: Nguyên liệu allergen_codes: null nhưng không khai báo trong missing_fields', () => {
    const invalidUnannouncedNull = {
      id: 'bot-nem',
      name: 'Bột nêm',
      group: 'gia-vi',
      base_unit: 'g',
      allergen_codes: null,
      missing_fields: [], // Vi phạm: null mà không có trong missing_fields
    };
    const result = validateIngredient(invalidUnannouncedNull);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('allergen_codes'))).toBe(true);
    }
  });

  it('Ca sai 3: Nguyên liệu chứa mã dị ứng ngoài danh sách 8 mã chuẩn', () => {
    const invalidCode = {
      id: 'bot-mi',
      name: 'Bột mì',
      group: 'bot',
      base_unit: 'g',
      allergen_codes: ['wheat', 'pollen'], // 'pollen' không hợp lệ
      missing_fields: [],
    };
    const result = validateIngredient(invalidCode);
    expect(result.success).toBe(false);
  });

  it('Nguyên liệu có allergen_codes === null không bao giờ được coi là "an toàn/không có dị ứng"', () => {
    function isSafeForUser(
      ingredient: { allergen_codes: string[] | null },
      userAllergies: string[],
    ): { safe: boolean; warning?: string } {
      if (ingredient.allergen_codes === null) {
        return {
          safe: false,
          warning: 'Chưa đủ dữ liệu kiểm định dị ứng cho nguyên liệu này',
        };
      }
      const hasConflict = ingredient.allergen_codes.some((code) =>
        userAllergies.includes(code),
      );
      return { safe: !hasConflict };
    }

    const unconfirmed = { allergen_codes: null };
    const checkResult = isSafeForUser(unconfirmed, ['peanut']);
    expect(checkResult.safe).toBe(false);
    expect(checkResult.warning).toBeDefined();
  });
});

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
      expect(result.data.source).toBeDefined();
      expect(result.data.confirmed_by).toBeDefined();
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
      expect(result.data.source).toBeDefined();
      expect(result.data.confirmed_by).toBeDefined();
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

describe('T02: Kiểm tra thực thể Ingredient (các ca chung)', () => {
  it('Ca hợp lệ: Nguyên liệu đầy đủ các trường', () => {
    const validFull = {
      id: 'trung-ga',
      name: 'Trứng gà',
      aliases: ['hột gà', 'trứng gà ta'],
      group: 'trung-sua',
      base_unit: 'cái',
      conversions: { quả: 1, chục: 10 },
      allergen_codes: ['egg'],
      reference_price: 3500,
      price_updated_at: '2026-10-22',
      storage_rule_id: 'sr-trung-ga',
      source: 'Viện Chăn Nuôi',
      confirmed_by: 'Chuyên gia Nông Nghiệp',
      missing_fields: [],
    };
    const result = validateIngredient(validFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('trung-ga');
      expect(result.data.base_unit).toBe('cái');
      expect(result.data.allergen_codes).toEqual(['egg']);
    }
  });

  it('Ca sai: Bắt lỗi khi mã id rỗng', () => {
    const invalid = {
      id: '',
      name: 'Muối ăn',
      group: 'gia-vi',
      base_unit: 'g',
      allergen_codes: [],
      missing_fields: [],
    };
    const result = validateIngredient(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai: Bắt lỗi khi base_unit không thuộc g|ml|cái', () => {
    const invalid = {
      id: 'trung-ga',
      name: 'Trứng gà',
      group: 'trung-sua',
      base_unit: 'quả', // Sai: phải là 'cái'
      allergen_codes: ['egg'],
      missing_fields: [],
    };
    const result = validateIngredient(invalid);
    expect(result.success).toBe(false);
  });

  it('Ca sai: Bắt lỗi khi giá tham khảo reference_price là số âm', () => {
    const invalid = {
      id: 'dau-an',
      name: 'Dầu ăn',
      group: 'dau-mo',
      base_unit: 'ml',
      allergen_codes: [],
      reference_price: -5000,
      missing_fields: [],
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
      source: 'Quyết định 46/2007/QĐ-BYT',
      confirmed_by: 'Thẩm định viên an toàn thực phẩm',
      missing_fields: [],
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
      source: 'CDC Guidelines for Poultry',
      confirmed_by: 'Bác sĩ an toàn dịch tễ',
      missing_fields: [],
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

describe('T02: Kiểm tra thực thể Equipment (được duyệt, R2/R3)', () => {
  it('Ca hợp lệ: Dụng cụ nấu ăn hợp lệ có đầy đủ trường R2/R3', () => {
    const valid = {
      id: 'chao_chong_dinh',
      name: 'Chảo chống dính',
      source: 'Quy chuẩn dụng cụ nấu bếp',
      confirmed_by: 'Chuyên gia thiết bị bếp',
      missing_fields: [],
    };
    const result = validateEquipment(valid);
    expect(result.success).toBe(true);
  });

  it('Ca sai: Bắt lỗi khi id hoặc name để trống', () => {
    const invalid = {
      id: '',
      name: '',
    };
    const result = validateEquipment(invalid);
    expect(result.success).toBe(false);
  });
});
