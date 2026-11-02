/**
 * File: packages/core/src/pantry/quick-add.ts
 * Module: @cook/core
 *
 * Nghiệp vụ Thêm nhanh nguyên liệu vào kho (T11).
 * Cung cấp danh sách 15 nguyên liệu hay dùng, bộ quy đổi mức "một ít / vừa / nhiều",
 * kiểm tra cờ MISSING để khóa chọn mức, và hàm thêm hàng loạt vào kho.
 */

import { PantryService } from '../db/pantry-service.js';

/**
 * 3 vị trí bảo quản tiêu chuẩn bằng tiếng Việt (T11.3).
 */
export const QUICK_ADD_STORAGE_LOCATIONS = [
  'ngăn mát',
  'ngăn đá',
  'nhiệt độ phòng',
] as const;

export type QuickAddStorageLocation = (typeof QUICK_ADD_STORAGE_LOCATIONS)[number];

/**
 * 3 mức định lượng nhanh (T11.2).
 */
export type PortionLevel = 'little' | 'medium' | 'lot';

export interface PortionAmounts {
  little: number;
  medium: number;
  lot: number;
}

/**
 * Danh sách 15 nguyên liệu hay dùng nhất khi mới cài app (T11.4).
 * Giúp người dùng thêm nhanh vào kho chỉ với 1 chạm.
 */
export const COMMON_15_INGREDIENTS = [
  { id: 'trung-ga', name: 'Trứng gà', aliases: ['hột gà', 'trứng'], baseUnit: 'cái' as const, defaultLocation: 'ngăn mát' as QuickAddStorageLocation },
  { id: 'ca-chua', name: 'Cà chua', aliases: [], baseUnit: 'g' as const, defaultLocation: 'ngăn mát' as QuickAddStorageLocation },
  { id: 'hanh-la', name: 'Hành lá', aliases: ['hành hoa'], baseUnit: 'cái' as const, defaultLocation: 'ngăn mát' as QuickAddStorageLocation },
  { id: 'toi', name: 'Tỏi', aliases: ['tỏi ta'], baseUnit: 'cái' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'hanh-tim', name: 'Hành tím', aliases: ['hành củ'], baseUnit: 'cái' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'nuoc-mam', name: 'Nước mắm', aliases: ['mắm'], baseUnit: 'ml' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'dau-an', name: 'Dầu ăn', aliases: ['dầu'], baseUnit: 'ml' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'duong', name: 'Đường', aliases: ['đường cát', 'đường trắng'], baseUnit: 'g' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'muoi', name: 'Muối', aliases: ['muối tinh'], baseUnit: 'g' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'tieu', name: 'Tiêu', aliases: ['hạt tiêu', 'tiêu đen'], baseUnit: 'g' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'hat-nem', name: 'Hạt nêm', aliases: ['bột nêm'], baseUnit: 'g' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'gung', name: 'Gừng', aliases: ['củ gừng'], baseUnit: 'g' as const, defaultLocation: 'nhiệt độ phòng' as QuickAddStorageLocation },
  { id: 'ot', name: 'Ớt', aliases: ['ớt hiểm', 'ớt cay'], baseUnit: 'cái' as const, defaultLocation: 'ngăn mát' as QuickAddStorageLocation },
  { id: 'rau-muong', name: 'Rau muống', aliases: [], baseUnit: 'g' as const, defaultLocation: 'ngăn mát' as QuickAddStorageLocation },
  { id: 'thit-ba-chi', name: 'Thịt ba chỉ', aliases: ['ba rọi'], baseUnit: 'g' as const, defaultLocation: 'ngăn mát' as QuickAddStorageLocation },
] as const;

/**
 * Bảng mức định lượng mặc định cho các nguyên liệu đã được cân thử.
 * Lưu ý: Các nguyên liệu chưa có dữ liệu sẽ ghi nhận 'MISSING' theo quy định T11.2 và R2.
 */
export const DEFAULT_PORTION_LEVELS: Record<string, PortionAmounts | 'MISSING'> = {
  'trung-ga': { little: 2, medium: 4, lot: 10 },
  'trung': { little: 2, medium: 4, lot: 10 },
  'ca-chua': { little: 200, medium: 500, lot: 1000 },
  'hanh-la': { little: 2, medium: 5, lot: 10 },
  'toi': { little: 3, medium: 6, lot: 15 },
  'hanh-tim': { little: 3, medium: 6, lot: 15 },
  'nuoc-mam': { little: 50, medium: 150, lot: 500 },
  'dau-an': { little: 100, medium: 250, lot: 1000 },
  'duong': { little: 100, medium: 300, lot: 1000 },
  'muoi': { little: 50, medium: 150, lot: 500 },
  'rau-muong': { little: 300, medium: 500, lot: 1000 },
  'thit-ba-chi': { little: 200, medium: 500, lot: 1000 },
  // Nguyên liệu minh họa đánh dấu MISSING theo yêu cầu T11.2
  'nguyen-lieu-chua-can': 'MISSING',
};

/**
 * Kiểm tra xem một nguyên liệu có cho phép chọn mức "một ít / vừa / nhiều" hay không (T11.2).
 * Nếu nguyên liệu có trường cờ MISSING trong missing_fields hoặc cấu hình là 'MISSING' -> không cho chọn mức.
 *
 * Vào:
 *   - ingredientId: mã nguyên liệu.
 *   - missingFields: danh sách trường còn thiếu của nguyên liệu (từ DB).
 * Ra: boolean (true nếu được chọn mức, false nếu MISSING).
 */
export function canSelectPortionLevel(
  ingredientId: string,
  missingFields: string[] = [],
): boolean {
  // Nếu khai báo trong missing_fields -> cấm chọn mức
  if (missingFields.includes('portion_levels')) {
    return false;
  }
  const config = DEFAULT_PORTION_LEVELS[ingredientId];
  return config !== undefined && config !== 'MISSING';
}

/**
 * Quy đổi mức "một ít / vừa / nhiều" ra lượng thực tế theo đơn vị gốc (T11.2).
 *
 * Vào:
 *   - ingredientId: mã nguyên liệu.
 *   - level: 'little' | 'medium' | 'lot'.
 *   - missingFields: danh sách trường còn thiếu.
 * Ra: Số lượng theo đơn vị gốc, hoặc null nếu bị MISSING.
 */
export function resolvePortionQuantity(
  ingredientId: string,
  level: PortionLevel,
  missingFields: string[] = [],
): number | null {
  if (!canSelectPortionLevel(ingredientId, missingFields)) {
    return null;
  }
  const config = DEFAULT_PORTION_LEVELS[ingredientId];
  if (!config || config === 'MISSING') {
    return null;
  }
  return config[level];
}

/**
 * Tìm kiếm nguyên liệu theo tên chuẩn hoặc tên gọi khác (T11.1).
 *
 * Vào:
 *   - query: chuỗi tìm kiếm từ người dùng.
 *   - ingredients: danh sách nguyên liệu cần lọc.
 * Ra: Danh sách nguyên liệu khớp.
 */
export function searchIngredients<
  T extends { name: string; aliases?: readonly string[] | string[] }
>(query: string, ingredients: readonly T[] | T[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ingredients];

  return ingredients.filter((ing) => {
    if (ing.name.toLowerCase().includes(q)) return true;
    if (ing.aliases && ing.aliases.some((alias) => alias.toLowerCase().includes(q))) {
      return true;
    }
    return false;
  });
}

/**
 * Thông tin một mục cần thêm nhanh vào kho.
 */
export interface QuickAddBatchItem {
  ingredientId: string;
  quantity: number;
  baseUnit: 'g' | 'ml' | 'cái';
  storageLocation: QuickAddStorageLocation;
  expiryDate?: string | null;
}

/**
 * Thêm hàng loạt nguyên liệu vào kho (T11.1).
 *
 * Vào:
 *   - pantryService: dịch vụ kho đã khởi tạo.
 *   - items: mảng các mục cần thêm.
 * Ra: Mảng các id lô kho vừa được thêm vào SQLite.
 */
export async function batchAddToPantry(
  pantryService: PantryService,
  items: QuickAddBatchItem[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const item of items) {
    if (item.quantity <= 0) {
      throw new Error(`Số lượng nguyên liệu ${item.ingredientId} phải lớn hơn 0`);
    }
    const lotId = await pantryService.add({
      ingredientId: item.ingredientId,
      quantity: item.quantity,
      baseUnit: item.baseUnit,
      storageLocation: item.storageLocation,
      expiryDate: item.expiryDate ?? null,
      source: 'manual',
    });
    ids.push(lotId);
  }
  return ids;
}
