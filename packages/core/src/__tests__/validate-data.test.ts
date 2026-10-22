/**
 * File: packages/core/src/__tests__/validate-data.test.ts
 * Làm gì: Bộ kiểm thử đơn vị cho script scripts/validate-data.js (Mục T03.4).
 * Nhận vào: Dữ liệu giả định trong thư mục fixtures/ riêng biệt (có synthetic: true).
 * Trả ra: Kết quả kiểm tra của Vitest xác nhận mọi quy tắc của T03.2, --strict, và --report-missing.
 * Bám theo: docs/tasks.md mục T03.2, T03.3, T03.4.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Import các hàm từ scripts/validate-data.js
// @ts-expect-error validate-data.js là tệp script JS ngoài thư mục src
import { validateData, determineSourceType } from '../../../../scripts/validate-data.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');

describe('T03: Bộ kiểm thử cho script validate-data và các quy tắc nghiệp vụ dữ liệu', () => {
  it('T03.4 Ca đúng: Kiểm định thành công bộ dữ liệu giả định hợp lệ (fixtures/valid)', () => {
    const validDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/valid'));
    const result = validateData({ dataDir: validDir });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('T03.1 Ca đúng: Kiểm định thành công thư mục dữ liệu rỗng chuẩn (data/)', () => {
    const dataDir = path.relative(process.cwd(), path.join(repoRoot, 'data'));
    const result = validateData({ dataDir });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.missingItems).toEqual([]);
  });

  it('T03.2 Cờ --strict: Thành công trên thư mục rỗng chuẩn (data/)', () => {
    const dataDir = path.relative(process.cwd(), path.join(repoRoot, 'data'));
    const result = validateData({ dataDir, strict: true });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('T03.2 Ca sai 1: Bắt lỗi schema của tệp ingredients.json (fixtures/invalid-ingredient)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/invalid-ingredient'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((err: string) => err.includes('ingredients.json'))).toBe(true);
  });

  it('T03.2 Ca sai 2: Bắt lỗi công thức có vòng lặp phụ thuộc chu trình (fixtures/invalid-cycle)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/invalid-cycle'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(false);
    expect(result.errors.some((err: string) => err.includes('chu trình') || err.includes('cycle'))).toBe(true);
  });

  it('T03.2 Ca sai 3: Bắt đúng thông điệp khi nguyên liệu trong công thức không có trong ingredients.json (fixtures/missing-ingredient)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/missing-ingredient'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((err: string) =>
        err.includes('nguyên liệu "thit-bo" không tồn tại trong ingredients.json'),
      ),
    ).toBe(true);
  });

  it('T03.2 Ca sai 4: Bắt đúng thông điệp khi dụng cụ/tài nguyên không có trong equipment.json (fixtures/missing-equipment)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/missing-equipment'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((err: string) =>
        err.includes('dụng cụ "chao" không tồn tại trong equipment.json'),
      ),
    ).toBe(true);
  });

  it('T03.2 Ca sai 5: Bắt đúng thông điệp khi cặp (nguyên liệu, đơn vị) không quy đổi được (fixtures/missing-conversion)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/missing-conversion'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(false);
    // Bắt buộc thông điệp: tên món, nguyên liệu, đơn vị, và "thiếu conversions.<đơn vị> của nguyên liệu <id>".
    expect(
      result.errors.some((err: string) =>
        err.includes('thiếu conversions.thìa cà phê của nguyên liệu trung-ga'),
      ),
    ).toBe(true);
  });

  it('T03.2 Ca sai 6: Bắt lỗi khi món published còn missing_fields (fixtures/invalid-published)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/invalid-published'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((err: string) =>
        err.includes('missing_fields') || err.includes('không được còn trường thiếu'),
      ),
    ).toBe(true);
  });

  it('T03.2 Ca sai 7: An toàn dị ứng - Bắt lỗi khi món published dùng nguyên liệu có allergen_codes: null (fixtures/allergen-error)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/allergen-error'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((err: string) =>
        err.includes('có allergen_codes: null (chưa rõ thông tin dị ứng)'),
      ),
    ).toBe(true);
  });

  it('T03.2 Ca cảnh báo: An toàn dị ứng - Món draft dùng nguyên liệu allergen_codes: null chỉ phát cảnh báo (fixtures/allergen-warning)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/allergen-warning'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      result.warnings.some((w: string) =>
        w.includes('có allergen_codes: null (chưa rõ thông tin dị ứng)'),
      ),
    ).toBe(true);
  });

  it('T03.2 Ca sai 8: Bắt lỗi khi mã safety_rule trong bước không có trong safety_rules.json (fixtures/missing-safety-rule)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/missing-safety-rule'));
    const result = validateData({ dataDir: targetDir });

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((err: string) =>
        err.includes('mã safety_rule "rule-unlisted" không tồn tại trong safety_rules.json'),
      ),
    ).toBe(true);
  });

  it('T03.2 & T03.3 Cờ --strict: Báo thất bại khi còn missing_fields hoặc cảnh báo (fixtures/missing-data-report)', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/missing-data-report'));

    // Chế độ bình thường: chỉ có cảnh báo/thiếu thông tin, không có lỗi cấu trúc nặng -> valid: true
    const normalResult = validateData({ dataDir: targetDir, strict: false });
    expect(normalResult.valid).toBe(true);

    // Chế độ --strict: bắt buộc mọi dữ liệu phải hoàn tất 100% -> valid: false
    const strictResult = validateData({ dataDir: targetDir, strict: true });
    expect(strictResult.valid).toBe(false);
  });

  it('T03.3 Báo cáo dữ liệu thiếu: Phân loại đúng nguồn cần tìm cho các trường dữ liệu thiếu', () => {
    expect(determineSourceType('allergen_codes')).toBe('cơ quan y tế / tài liệu khoa học');
    expect(determineSourceType('conversions.thìa canh')).toBe('cân thử / thực nghiệm');
    expect(determineSourceType('storage_rule')).toBe('cơ quan y tế / quy chuẩn vệ sinh');
    expect(determineSourceType('safety_rule')).toBe('cơ quan y tế / quy chuẩn vệ sinh');
    expect(determineSourceType('reference_price')).toBe('khảo sát giá thị trường');
    expect(determineSourceType('steps')).toBe('người biết nấu / chuyên gia ẩm thực');
  });

  it('T03.3 Báo cáo dữ liệu thiếu: Gom đúng các trường thiếu theo tệp từ fixtures/missing-data-report', () => {
    const targetDir = path.relative(process.cwd(), path.join(repoRoot, 'fixtures/missing-data-report'));
    const result = validateData({ dataDir: targetDir, reportMissing: true });

    expect(result.missingItems.length).toBeGreaterThan(0);

    const files = new Set(result.missingItems.map((it: { file: string }) => it.file));
    expect(files.has('ingredients.json')).toBe(true);
    expect(files.has('equipment.json')).toBe(true);
    expect(files.has('storage_rules.json')).toBe(true);
    expect(files.has('recipes/dish.json')).toBe(true);
  });
});
