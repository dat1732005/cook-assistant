/**
 * File: scripts/validate-data.js
 * Làm gì: Script kiểm tra tính toàn vẹn và hợp lệ của toàn bộ dữ liệu (T03.2),
 *         báo cáo dữ liệu còn thiếu gom theo tệp và trường (T03.3).
 * Nhận vào:
 *   - Thư mục dữ liệu (mặc định: data/, có thể override bằng --data-dir <path>).
 *   - Cờ --strict: mã thoát khác 0 nếu còn bất kỳ MISSING hoặc missing_fields nào.
 *   - Cờ --report-missing: in bảng DANH SÁCH DỮ LIỆU THIẾU gom theo tệp, trường và nguồn cần tìm.
 * Trả ra: Mã thoát 0 (hợp lệ) hoặc 1 (có lỗi vi phạm quy tắc).
 * Ai gọi: Lệnh `pnpm validate-data`, `pnpm validate-data --strict`, `pnpm validate-data --report-missing`.
 * Bám theo: docs/tasks.md mục T03, docs/plan.md, docs/field-names.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Import các schema và hàm quy đổi từ @cook/core
import {
  IngredientSchema,
  RecipeSchema,
  StorageRuleSchema,
  SafetyRuleSchema,
  convertToBaseUnit,
} from '../packages/core/dist/index.js';

/**
 * Xác định loại nguồn cần tìm kiếm dựa vào trường dữ liệu bị thiếu
 * @param {string} field
 * @returns {string}
 */
export function determineSourceType(field) {
  if (field === 'allergen_codes' || field.includes('allergen')) {
    return 'cơ quan y tế / tài liệu khoa học';
  }
  if (field.startsWith('conversions.') || field === 'conversions') {
    return 'cân thử / thực nghiệm';
  }
  if (field === 'safety_rule' || field.includes('safety') || field.includes('storage')) {
    return 'cơ quan y tế / quy chuẩn vệ sinh';
  }
  if (field === 'reference_price') {
    return 'khảo sát giá thị trường';
  }
  return 'người biết nấu / chuyên gia ẩm thực';
}

/**
 * Hàm kiểm tra toàn bộ dữ liệu trong thư mục chỉ định.
 * @param {{ dataDir?: string; strict?: boolean; reportMissing?: boolean }} [options]
 * @returns {{ valid: boolean; errors: string[]; warnings: string[]; missingItems: Array<any> }}
 */
export function validateData(options = {}) {
  const dataDir = path.resolve(process.cwd(), options.dataDir || 'data');
  const strict = Boolean(options.strict);

  const errors = [];
  const warnings = [];
  const missingItems = [];

  // 1. Kiểm tra tồn tại thư mục dữ liệu
  if (!fs.existsSync(dataDir)) {
    errors.push(`Thư mục dữ liệu không tồn tại: ${dataDir}`);
    return { valid: false, errors, warnings, missingItems };
  }

  // 2. Nạp và kiểm định ingredients.json
  const ingredientsPath = path.join(dataDir, 'ingredients.json');
  const ingredientMap = new Map();

  if (fs.existsSync(ingredientsPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(ingredientsPath, 'utf8'));
      if (!Array.isArray(raw)) {
        errors.push(`Tệp ingredients.json phải là một mảng JSON.`);
      } else {
        raw.forEach((item, index) => {
          const parsed = IngredientSchema.safeParse(item);
          if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
            errors.push(`ingredients.json [vị trí ${index}, id: ${item.id ?? 'chưa có'}]: ${issues}`);
          } else {
            ingredientMap.set(parsed.data.id, parsed.data);

            // Ghi nhận missing_fields
            if (Array.isArray(parsed.data.missing_fields)) {
              for (const field of parsed.data.missing_fields) {
                missingItems.push({
                  file: 'ingredients.json',
                  itemId: parsed.data.id,
                  itemName: parsed.data.name,
                  missingField: field,
                  sourceType: determineSourceType(field),
                });
              }
            }

            // Ghi nhận allergen_codes: null
            if (parsed.data.allergen_codes === null) {
              missingItems.push({
                file: 'ingredients.json',
                itemId: parsed.data.id,
                itemName: parsed.data.name,
                missingField: 'allergen_codes',
                sourceType: determineSourceType('allergen_codes'),
                note: 'Thông tin dị ứng chưa được xác nhận',
              });
            }
          }
        });
      }
    } catch (e) {
      errors.push(`Không thể đọc hoặc parse JSON tệp ingredients.json: ${e.message}`);
    }
  }

  // 3. Nạp và kiểm định equipment.json
  const equipmentPath = path.join(dataDir, 'equipment.json');
  const equipmentSet = new Set();

  if (fs.existsSync(equipmentPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(equipmentPath, 'utf8'));
      if (!Array.isArray(raw)) {
        errors.push(`Tệp equipment.json phải là một mảng JSON.`);
      } else {
        raw.forEach((item, index) => {
          if (typeof item === 'string') {
            equipmentSet.add(item);
          } else if (item && typeof item === 'object' && typeof item.id === 'string') {
            equipmentSet.add(item.id);
            if (Array.isArray(item.missing_fields)) {
              for (const field of item.missing_fields) {
                missingItems.push({
                  file: 'equipment.json',
                  itemId: item.id,
                  itemName: item.name ?? item.id,
                  missingField: field,
                  sourceType: determineSourceType(field),
                });
              }
            }
          } else {
            errors.push(`equipment.json [vị trí ${index}]: Mục dụng cụ phải là chuỗi id hoặc đối tượng có trường 'id'`);
          }
        });
      }
    } catch (e) {
      errors.push(`Không thể đọc hoặc parse JSON tệp equipment.json: ${e.message}`);
    }
  }

  // 4. Nạp và kiểm định storage_rules.json
  const storageRulesPath = path.join(dataDir, 'storage_rules.json');
  if (fs.existsSync(storageRulesPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(storageRulesPath, 'utf8'));
      if (!Array.isArray(raw)) {
        errors.push(`Tệp storage_rules.json phải là một mảng JSON.`);
      } else {
        raw.forEach((item, index) => {
          const parsed = StorageRuleSchema.safeParse(item);
          if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
            errors.push(`storage_rules.json [vị trí ${index}, id: ${item.id ?? 'chưa có'}]: ${issues}`);
          } else {
            if (Array.isArray(parsed.data.missing_fields)) {
              for (const field of parsed.data.missing_fields) {
                missingItems.push({
                  file: 'storage_rules.json',
                  itemId: parsed.data.id,
                  missingField: field,
                  sourceType: determineSourceType(field),
                });
              }
            }
          }
        });
      }
    } catch (e) {
      errors.push(`Không thể đọc hoặc parse JSON tệp storage_rules.json: ${e.message}`);
    }
  }

  // 5. Nạp và kiểm định safety_rules.json
  const safetyRulesPath = path.join(dataDir, 'safety_rules.json');
  const safetyRuleSet = new Set();

  if (fs.existsSync(safetyRulesPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(safetyRulesPath, 'utf8'));
      if (!Array.isArray(raw)) {
        errors.push(`Tệp safety_rules.json phải là một mảng JSON.`);
      } else {
        raw.forEach((item, index) => {
          const parsed = SafetyRuleSchema.safeParse(item);
          if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
            errors.push(`safety_rules.json [vị trí ${index}, id: ${item.id ?? 'chưa có'}]: ${issues}`);
          } else {
            safetyRuleSet.add(parsed.data.id);
            if (Array.isArray(parsed.data.missing_fields)) {
              for (const field of parsed.data.missing_fields) {
                missingItems.push({
                  file: 'safety_rules.json',
                  itemId: parsed.data.id,
                  itemName: parsed.data.title,
                  missingField: field,
                  sourceType: determineSourceType(field),
                });
              }
            }
          }
        });
      }
    } catch (e) {
      errors.push(`Không thể đọc hoặc parse JSON tệp safety_rules.json: ${e.message}`);
    }
  }

  // 6. Nạp và kiểm định recipes/
  const recipesDir = path.join(dataDir, 'recipes');
  if (fs.existsSync(recipesDir)) {
    const files = fs.readdirSync(recipesDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(recipesDir, file);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const parsed = RecipeSchema.safeParse(raw);
        if (!parsed.success) {
          const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
          errors.push(`recipes/${file}: ${issues}`);
          continue;
        }

        const recipe = parsed.data;

        // Ghi nhận missing_fields của công thức
        if (Array.isArray(recipe.missing_fields)) {
          for (const field of recipe.missing_fields) {
            missingItems.push({
              file: `recipes/${file}`,
              itemId: recipe.slug,
              itemName: recipe.name,
              missingField: field,
              sourceType: determineSourceType(field),
            });
          }
        }

        // Quy tắc 3: Mọi ingredient trong công thức phải có trong ingredients.json
        for (const ing of recipe.ingredients) {
          const targetIng = ingredientMap.get(ing.ingredient);
          if (!targetIng) {
            errors.push(
              `Món "${recipe.name}" (${recipe.slug}): nguyên liệu "${ing.ingredient}" không tồn tại trong ingredients.json`,
            );
            continue;
          }

          // Quy tắc 5: Quy đổi được sang đơn vị gốc bằng hàm convertToBaseUnit
          // Không quy đổi được thì báo lỗi nêu rõ: tên món, nguyên liệu, đơn vị, và "thiếu conversions.<đơn vị> của nguyên liệu <id>". Không được đoán số.
          try {
            convertToBaseUnit(ing.qty, ing.unit, targetIng.base_unit, targetIng.conversions);
          } catch {
            errors.push(
              `Món "${recipe.name}" (${recipe.slug}): nguyên liệu "${ing.ingredient}" dùng đơn vị "${ing.unit}" không thể quy đổi sang đơn vị gốc "${targetIng.base_unit}" (thiếu conversions.${ing.unit} của nguyên liệu ${targetIng.id}).`,
            );
            missingItems.push({
              file: `recipes/${file}`,
              itemId: targetIng.id,
              itemName: targetIng.name,
              missingField: `conversions.${ing.unit}`,
              sourceType: determineSourceType(`conversions.${ing.unit}`),
              note: `Cần cho món ${recipe.name}`,
            });
          }

          // Quy tắc 7: An toàn dị ứng
          if (targetIng.allergen_codes === null) {
            if (recipe.status === 'reviewed' || recipe.status === 'published') {
              errors.push(
                `Món "${recipe.name}" (${recipe.status}) sử dụng nguyên liệu "${ing.ingredient}" có allergen_codes: null (chưa rõ thông tin dị ứng).`,
              );
            } else {
              warnings.push(
                `Cảnh báo: Món "${recipe.name}" (${recipe.status}) sử dụng nguyên liệu "${ing.ingredient}" có allergen_codes: null (chưa rõ thông tin dị ứng).`,
              );
            }
          }
        }

        // Quy tắc 4: Mọi mã trong equipment và resources phải có trong equipment.json
        for (const eq of recipe.equipment) {
          if (!equipmentSet.has(eq)) {
            errors.push(
              `Món "${recipe.name}" (${recipe.slug}): dụng cụ "${eq}" không tồn tại trong equipment.json`,
            );
          }
        }

        for (const step of recipe.steps) {
          if (Array.isArray(step.resources)) {
            for (const res of step.resources) {
              if (!equipmentSet.has(res)) {
                errors.push(
                  `Món "${recipe.name}" (${recipe.slug}), bước "${step.id}": tài nguyên "${res}" không tồn tại trong equipment.json`,
                );
              }
            }
          }

          // Quy tắc 8: Mã safety_rule trong bước phải có trong safety_rules.json
          if (step.safety_rule) {
            if (!safetyRuleSet.has(step.safety_rule)) {
              errors.push(
                `Món "${recipe.name}" (${recipe.slug}), bước "${step.id}": mã safety_rule "${step.safety_rule}" không tồn tại trong safety_rules.json.`,
              );
            }
          }
        }

        // Quy tắc 6: Món reviewed hoặc published: missing_fields rỗng, có source, confirmed_by, reviewer, reviewed_at
        if (recipe.status === 'reviewed' || recipe.status === 'published') {
          if (!recipe.source || recipe.source.trim() === '') {
            errors.push(`Món "${recipe.name}" (${recipe.status}) thiếu trường source dữ liệu.`);
          }
          if (!recipe.confirmed_by || recipe.confirmed_by.trim() === '') {
            errors.push(`Món "${recipe.name}" (${recipe.status}) thiếu trường confirmed_by.`);
          }
          if (!recipe.reviewer || recipe.reviewer.trim() === '') {
            errors.push(`Món "${recipe.name}" (${recipe.status}) thiếu trường reviewer.`);
          }
          if (!recipe.reviewed_at || recipe.reviewed_at.trim() === '') {
            errors.push(`Món "${recipe.name}" (${recipe.status}) thiếu ngày kiểm duyệt reviewed_at.`);
          }
          if (recipe.missing_fields && recipe.missing_fields.length > 0) {
            errors.push(`Món "${recipe.name}" (${recipe.status}) còn missing_fields chưa hoàn tất.`);
          }
        }
      } catch (e) {
        errors.push(`Không thể đọc hoặc parse JSON món ăn ${file}: ${e.message}`);
      }
    }
  }

  // Đánh giá tính hợp lệ
  let valid = errors.length === 0;
  if (strict) {
    if (missingItems.length > 0 || warnings.length > 0) {
      valid = false;
    }
  }

  return { valid, errors, warnings, missingItems };
}

/**
 * In bảng danh sách dữ liệu còn thiếu gom theo tệp và trường
 * @param {Array<any>} missingItems
 */
export function printMissingReport(missingItems) {
  console.log('\n================================================================================');
  console.log('                 DANH SÁCH DỮ LIỆU THIẾU (VIỆC BIÊN TẬP CẦN LÀM)');
  console.log('================================================================================');

  if (missingItems.length === 0) {
    console.log('Tuyệt vời! Không có trường dữ liệu nào bị thiếu.');
    console.log('================================================================================\n');
    return;
  }

  // Gom nhóm theo tệp
  const groupedByFile = new Map();
  for (const item of missingItems) {
    const list = groupedByFile.get(item.file) || [];
    list.push(item);
    groupedByFile.set(item.file, list);
  }

  for (const [file, items] of groupedByFile.entries()) {
    console.log(`\n📂 Tệp: ${file} (${items.length} mục thiếu)`);
    console.log('--------------------------------------------------------------------------------');
    console.log(
      '| Mã / ID'.padEnd(20) +
        '| Tên đối tượng'.padEnd(25) +
        '| Trường thiếu'.padEnd(22) +
        '| Nguồn cần tìm'.padEnd(30) +
        '|',
    );
    console.log('--------------------------------------------------------------------------------');
    for (const it of items) {
      const id = (it.itemId || '').slice(0, 18).padEnd(19);
      const name = (it.itemName || '—').slice(0, 23).padEnd(24);
      const field = (it.missingField || '').slice(0, 20).padEnd(21);
      const src = (it.sourceType || '').slice(0, 28).padEnd(29);
      console.log(`| ${id}| ${name}| ${field}| ${src}|`);
    }
    console.log('--------------------------------------------------------------------------------');
  }

  console.log(`\nTổng số mục dữ liệu cần bổ sung: ${missingItems.length}`);
  console.log('================================================================================\n');
}

/**
 * Điểm vào CLI chính
 * @param {string[]} [argv]
 * @returns {number}
 */
export function runCli(argv = process.argv.slice(2)) {
  let strict = false;
  let reportMissing = false;
  let dataDir = 'data';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict') {
      strict = true;
    } else if (arg === '--report-missing') {
      reportMissing = true;
    } else if (arg === '--data-dir' && i + 1 < argv.length) {
      dataDir = argv[++i];
    }
  }

  console.log(`\nĐang kiểm tra dữ liệu trong thư mục: ${dataDir} (strict: ${strict ? 'BẬT' : 'TẮT'})...`);
  const result = validateData({ dataDir, strict, reportMissing });

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  CẢNH BÁO (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.log(`   - ${w}`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ PHÁT HIỆN LỖI VI PHẠM (${result.errors.length}):`);
    for (const err of result.errors) {
      console.log(`   - ${err}`);
    }
  }

  if (reportMissing || (strict && result.missingItems.length > 0)) {
    printMissingReport(result.missingItems);
  }

  if (!result.valid) {
    if (result.errors.length > 0) {
      console.log(`\n=> KẾT QUẢ: THẤT BẠI (Phát hiện ${result.errors.length} lỗi).`);
    } else if (strict && result.missingItems.length > 0) {
      console.log(
        `\n=> KẾT QUẢ: THẤT BẠI (--strict được bật và còn ${result.missingItems.length} mục thiếu dữ liệu).`,
      );
    }
    return 1;
  }

  console.log(`\n=> KẾT QUẢ: HỢP LỆ (Dữ liệu hoàn toàn sạch sẽ, đạt chuẩn).`);
  return 0;
}

// Chạy trực tiếp qua terminal
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = runCli();
  process.exit(exitCode);
}
