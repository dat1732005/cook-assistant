/**
 * File: packages/core/src/units/conversions.ts
 * Mục đích: Quản lý quy đổi đơn vị đo lường đời thường sang đơn vị gốc (g, ml, cái).
 * Nhận vào: Số lượng, đơn vị nguồn, đơn vị đích, và bảng quy đổi riêng của nguyên liệu.
 * Trả ra: Số lượng đã quy đổi chính xác, hoặc ném lỗi nếu không có quy tắc chuyển đổi.
 * Ai gọi: Scheduler (T04), Quản lý kho (T10), Chi tiết món (T06), và các script kiểm tra.
 * Bám theo: Mục T02.4 và R1 trong docs/tasks.md.
 */

import { BaseUnit, BASE_UNITS } from '../enums.js';

/**
 * Danh sách tên các đơn vị đo lường thông dụng trong ẩm thực Việt Nam (Mục T02.4).
 */
export const COMMON_UNITS = [
  'g',
  'ml',
  'cái',
  'thìa cà phê',
  'thìa canh',
  'chén',
  'bó',
  'nhánh',
  'quả',
  'củ',
  'tép',
  'lát',
] as const;

export type CommonUnit = (typeof COMMON_UNITS)[number];

/**
 * Bảng dung tích mặc định cho các đơn vị đo lường thể tích chất lỏng chuẩn (ml).
 * Nguồn: Chuẩn đo lường làm bếp quốc tế (Metric Kitchen Units).
 */
export const DEFAULT_VOLUME_CONVERSIONS_IN_ML: Readonly<Record<string, number>> = {
  // 1 thìa cà phê chuẩn bằng 5 mililit
  'thìa cà phê': 5,
  // 1 thìa canh chuẩn bằng 15 mililit
  'thìa canh': 15,
  // 1 chén (bát ăn cơm) chuẩn chất lỏng khoảng 240 mililit
  'chén': 240,
};

/**
 * Kiểu dữ liệu bảng quy đổi riêng của từng nguyên liệu (được lưu trong thuộc tính conversions của Ingredient).
 * Khóa là tên đơn vị (ví dụ "quả", "thìa cà phê"), giá trị là hệ số đổi ra đơn vị gốc (baseUnit) của nguyên liệu đó.
 */
export type IngredientConversionMap = Record<string, number>;

/**
 * Kiểm tra xem một chuỗi có phải là đơn vị gốc (g, ml, cái) hay không.
 *
 * @param unit Tên đơn vị cần kiểm tra
 * @returns true nếu là đơn vị gốc chuẩn hóa, false nếu không phải
 *
 * Ví dụ:
 * - isBaseUnit("g") -> true
 * - isBaseUnit("thìa canh") -> false
 *
 * Gọi bởi: convertUnit, validator
 */
export function isBaseUnit(unit: string): unit is BaseUnit {
  // Duyệt danh sách đơn vị gốc xem có trùng khớp không
  return (BASE_UNITS as readonly string[]).includes(unit);
}

/**
 * Chuyển đổi số lượng từ một đơn vị bất kỳ về đơn vị gốc (baseUnit) của nguyên liệu.
 *
 * Làm gì: Nhân số lượng với hệ số quy đổi trong bảng conversions của nguyên liệu hoặc thể tích mặc định.
 * Vào:
 * - amount: số lượng cần đổi, số thực dương (> 0).
 * - fromUnit: đơn vị ban đầu (ví dụ: "quả", "thìa cà phê").
 * - baseUnit: đơn vị gốc của nguyên liệu ("g", "ml", hoặc "cái").
 * - conversions: bảng quy đổi riêng của nguyên liệu (ví dụ: {"quả": 55, "thìa cà phê": 5}).
 * Ra: Số lượng tính theo đơn vị gốc (số thực).
 *
 * Ví dụ có số cụ thể:
 * - 2 quả trứng gà, baseUnit="g", conversions={"quả": 55} -> trả về 110 (gam).
 * - 3 thìa cà phê nước mắm, baseUnit="ml", conversions={} -> trả về 15 (ml theo thể tích chuẩn).
 *
 * Gọi bởi: Scheduler, Module trừ kho, Bộ chuyển đổi công thức.
 */
export function convertToBaseUnit(
  amount: number,
  fromUnit: string,
  baseUnit: BaseUnit,
  conversions?: IngredientConversionMap | null,
): number {
  // Nếu đơn vị nguồn đã là đơn vị gốc thì giữ nguyên số lượng
  if (fromUnit === baseUnit) {
    return amount;
  }

  // Bước 1: Kiểm tra trong bảng quy đổi riêng của nguyên liệu
  if (conversions && typeof conversions[fromUnit] === 'number') {
    const factor = conversions[fromUnit];
    // Chặn trường hợp hệ số quy đổi không hợp lệ
    if (factor <= 0) {
      throw new Error(
        `Hệ số quy đổi cho đơn vị "${fromUnit}" phải lớn hơn 0, nhận được: ${factor}`,
      );
    }
    return amount * factor;
  }

  // Bước 2: Nếu nguyên liệu dùng đơn vị gốc là ml và đơn vị nguồn là đơn vị thể tích thông dụng
  if (baseUnit === 'ml' && DEFAULT_VOLUME_CONVERSIONS_IN_ML[fromUnit]) {
    const volumeInMl = DEFAULT_VOLUME_CONVERSIONS_IN_ML[fromUnit];
    return amount * volumeInMl;
  }

  // Bước 3: Không tìm thấy quy tắc chuyển đổi nào phù hợp -> Báo lỗi nghiệp vụ rõ ràng
  throw new Error(
    `Không thể quy đổi đơn vị "${fromUnit}" sang đơn vị gốc "${baseUnit}". Vui lòng bổ sung vào bảng conversions của nguyên liệu.`,
  );
}

/**
 * Chuyển đổi số lượng từ đơn vị này sang đơn vị khác dựa vào đơn vị gốc và bảng quy đổi của nguyên liệu.
 *
 * Làm gì: Quy đổi trung gian qua đơn vị gốc (fromUnit -> baseUnit -> toUnit).
 * Vào:
 * - amount: số lượng ban đầu (số thực).
 * - fromUnit: đơn vị nguồn.
 * - toUnit: đơn vị đích cần quy đổi ra.
 * - baseUnit: đơn vị gốc chuẩn của nguyên liệu.
 * - conversions: bảng quy đổi riêng của nguyên liệu.
 * Ra: Số lượng đã quy đổi sang toUnit.
 *
 * Ví dụ:
 * - Đổi 110 g trứng sang "quả" với conversions={"quả": 55} -> trả về 2 quả.
 *
 * Gọi bởi: Giao diện hiển thị (T06), Module tính giá (T12).
 */
export function convertUnit(
  amount: number,
  fromUnit: string,
  toUnit: string,
  baseUnit: BaseUnit,
  conversions?: IngredientConversionMap | null,
): number {
  // Nếu hai đơn vị trùng nhau thì không cần chuyển đổi
  if (fromUnit === toUnit) {
    return amount;
  }

  // Bước 1: Quy đổi từ fromUnit về đơn vị gốc
  const amountInBase = convertToBaseUnit(amount, fromUnit, baseUnit, conversions);

  // Nếu đơn vị đích là đơn vị gốc thì trả về luôn kết quả
  if (toUnit === baseUnit) {
    return amountInBase;
  }

  // Bước 2: Quy đổi từ đơn vị gốc sang toUnit
  // Kiểm tra bảng quy đổi riêng của nguyên liệu
  if (conversions && typeof conversions[toUnit] === 'number') {
    const factor = conversions[toUnit];
    if (factor <= 0) {
      throw new Error(`Hệ số quy đổi của "${toUnit}" không hợp lệ: ${factor}`);
    }
    return amountInBase / factor;
  }

  // Kiểm tra đơn vị thể tích chuẩn nếu đơn vị gốc là ml
  if (baseUnit === 'ml' && DEFAULT_VOLUME_CONVERSIONS_IN_ML[toUnit]) {
    const volumeInMl = DEFAULT_VOLUME_CONVERSIONS_IN_ML[toUnit];
    return amountInBase / volumeInMl;
  }

  // Báo lỗi nếu không có cách chuyển từ đơn vị gốc sang toUnit
  throw new Error(
    `Không thể quy đổi từ đơn vị gốc "${baseUnit}" sang đơn vị đích "${toUnit}".`,
  );
}
