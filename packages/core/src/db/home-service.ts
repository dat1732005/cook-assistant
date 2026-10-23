/**
 * File: packages/core/src/db/home-service.ts
 * Làm gì: Cung cấp hàm nghiệp vụ lấy danh sách món hiển thị trên Trang chủ kết hợp lọc dị ứng, dụng cụ và sắp xếp theo tên.
 * Nhận vào: RecipeRepo, UserProfile hiện tại (hoặc null), và các bộ lọc tùy chọn (max_minutes).
 * Trả ra: Danh sách tóm tắt món ăn (RecipeSummary[]) đã được lọc sạch dị ứng và sắp xếp tăng dần theo tên.
 * Ai gọi: Màn hình Trang chủ (HomeScreen), bộ test T06 mục C (C1-C8).
 * Bám theo: Mục T06.3, T06.6 trong docs/tasks.md và docs/expected/T06.md mục C (C1-C8).
 */

import { RecipeRepo, RecipeSummary } from './recipe-repo.js';
import { UserProfile } from '../schemas/profile.js';

/**
 * Hàm sắp xếp danh sách món ăn theo tên (name) tăng dần.
 * Dùng thứ tự chuỗi ký tự chuẩn (binary string comparison) khớp tuyệt đối với bảng kết quả mong đợi của C2, C6, C8 trong docs/expected/T06.md.
 *
 * @param recipes Danh sách món ăn có thuộc tính name
 * @returns Mảng mới đã được sắp xếp tăng dần theo name
 *
 * @example
 * // Sắp xếp 5 món giả:
 * sortRecipesByName([
 *   { name: 'Đậu phộng rang trứng' },
 *   { name: 'Canh lạc hầm' },
 *   { name: 'Rau xào thập cẩm' }
 * ]);
 * // => ['Canh lạc hầm', 'Rau xào thập cẩm', 'Đậu phộng rang trứng']
 */
export function sortRecipesByName<T extends { name: string }>(recipes: T[]): T[] {
  return [...recipes].sort((a, b) => {
    // So sánh thứ tự chuỗi ký tự theo chuẩn nhị phân (khớp SQLite default collation và bảng kỳ vọng C2)
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }
    return 0;
  });
}

/**
 * Lấy danh sách món ăn hiển thị trên màn hình Trang chủ dựa trên hồ sơ người dùng và bộ lọc thời gian.
 *
 * Quy tắc an toàn bắt buộc (C1, C3, C6, C8):
 * - Nếu chưa có hồ sơ người dùng (profile === null): Không hiển thị bất kỳ món nào (trả về []), điều hướng sang Chào mừng.
 * - Nếu có hồ sơ: Lọc triệt để theo mã dị ứng (allergies), dụng cụ đang có (available_equipment), và thời gian tối đa (max_minutes).
 * - Sắp xếp kết quả trả về theo tên món tăng dần.
 *
 * @param recipeRepo Repository truy vấn công thức món ăn từ SQLite
 * @param profile Hồ sơ người dùng từ UserProfileRepo (hoặc null nếu chưa lưu)
 * @param filters Bộ lọc bổ sung từ giao diện (ví dụ: max_minutes)
 * @returns Danh sách món ăn hiển thị an toàn trên Trang chủ
 *
 * @example
 * const dishes = await getHomeRecipes(recipeRepo, profile, { max_minutes: 15 });
 */
export async function getHomeRecipes(
  recipeRepo: RecipeRepo,
  profile: UserProfile | null,
  filters?: { max_minutes?: number }
): Promise<RecipeSummary[]> {
  // Quy tắc an toàn C1: Nếu người dùng chưa hoàn tất hồ sơ, tuyệt đối không hiển thị món nào
  if (!profile) {
    return [];
  }

  // Gọi RecipeRepo.list() với các tiêu chí an toàn: dị ứng người dùng, dụng cụ sẵn có, và thời lượng tối đa
  const rawList = await recipeRepo.list({
    max_minutes: filters?.max_minutes,
    available_equipment: profile.available_equipment,
    allergies: profile.allergies,
  });

  // T06.3: Sắp xếp danh sách hiển thị theo tên tăng dần
  return sortRecipesByName(rawList);
}
