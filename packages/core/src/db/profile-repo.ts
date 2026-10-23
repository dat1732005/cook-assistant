/**
 * File: packages/core/src/db/profile-repo.ts
 * Làm gì: Cung cấp lớp UserProfileRepo để lưu và truy vấn hồ sơ người dùng thật trong bảng user_profile của SQLite.
 * Nhận vào: SqlDriver (NodeSqlDriver hoặc ExpoSqliteDriver) và đối tượng hồ sơ người dùng.
 * Trả ra: Đối tượng UserProfile chuẩn hóa hoặc null khi chưa tạo hồ sơ.
 * Ai gọi: Màn hình Chào mừng (WelcomeScreen), Màn hình Trang chủ (HomeScreen), Màn hình Chi tiết món (RecipeDetailScreen), bộ test T06 mục A.
 * Bám theo: Mục T06.2 trong docs/tasks.md và docs/expected/T06.md mục A (A1-A5).
 */

import { SqlDriver } from './driver.js';
import { UserProfile, UserProfileSchema } from '../schemas/profile.js';
import { AllergenCode } from '../enums.js';

/** ID mặc định cho hồ sơ người dùng đơn lẻ cục bộ */
export const DEFAULT_PROFILE_ID = 'default';

/**
 * Dữ liệu đầu vào khi tạo hoặc cập nhật hồ sơ người dùng.
 * Bắt buộc phải có số người ăn (servings) và danh sách mã dị ứng (allergies).
 */
export interface SaveProfileInput {
  id?: string;
  display_name?: string;
  servings: number;
  allergies: AllergenCode[] | null;
  dietary_preference?: string;
  essential_spices?: string[];
  available_equipment?: string[];
}

interface UserProfileDbRow {
  id: string;
  display_name: string | null;
  servings: number;
  allergies: string | null;
  dietary_preference: string | null;
  essential_spices: string;
  available_equipment: string;
}

/**
 * Lớp truy xuất cơ sở dữ liệu cho bảng user_profile trên SQLite.
 * Đảm bảo tính toàn vẹn: luôn duy trì đúng 1 bản ghi hồ sơ người dùng trong hệ thống.
 */
export class UserProfileRepo {
  private driver: SqlDriver;

  /**
   * Khởi tạo repository hồ sơ người dùng.
   *
   * @param driver Bộ điều khiển SQLite (NodeSqlDriver hoặc ExpoSqliteDriver)
   */
  constructor(driver: SqlDriver) {
    this.driver = driver;
  }

  /**
   * Lấy hồ sơ người dùng hiện tại từ SQLite.
   *
   * @returns Đối tượng UserProfile nếu đã lưu, hoặc null nếu chưa có hồ sơ
   *
   * @example
   * const profile = await repo.getProfile();
   * if (profile === null) {
   *   // Chưa hoàn tất màn Chào mừng (A1)
   * }
   */
  async getProfile(): Promise<UserProfile | null> {
    const row = await this.driver.queryOne<UserProfileDbRow>(
      'SELECT id, display_name, servings, allergies, dietary_preference, essential_spices, available_equipment FROM user_profile LIMIT 1;'
    );

    // Kiểm tra bản ghi trong CSDL: Nếu chưa có hàng nào được lưu (A1)
    if (!row) {
      return null;
    }

    // Giải mã các trường JSON lưu trữ trong SQLite (null nghĩa là chưa khai dị ứng)
    const parsedAllergies =
      row.allergies === null || row.allergies === undefined
        ? null
        : JSON.parse(row.allergies);
    const parsedSpices = JSON.parse(row.essential_spices || '[]');
    const parsedEquipment = JSON.parse(row.available_equipment || '[]');

    const profileData = {
      id: row.id,
      display_name: row.display_name ?? undefined,
      servings: Number(row.servings),
      allergies: parsedAllergies,
      dietary_preference: row.dietary_preference ?? undefined,
      essential_spices: parsedSpices,
      available_equipment: parsedEquipment,
    };

    // Kiểm định cấu trúc và kiểu dữ liệu trước khi trả ra ngoài
    return UserProfileSchema.parse(profileData);
  }

  /**
   * Lưu hoặc cập nhật hồ sơ người dùng vào SQLite.
   * Kiểm định nghiêm ngặt theo UserProfileSchema trước khi ghi vào CSDL.
   *
   * @param input Dữ liệu hồ sơ người dùng cần lưu
   * @returns Đối tượng UserProfile đã lưu thành công
   *
   * @example
   * await repo.saveProfile({
   *   servings: 4,
   *   allergies: ['egg'],
   *   essential_spices: ['muoi', 'duong'],
   *   available_equipment: ['chao', 'noi']
   * });
   */
  async saveProfile(input: SaveProfileInput): Promise<UserProfile> {
    // Tìm ID hiện tại trong CSDL để đảm bảo chỉ có tối đa 1 hàng trong bảng user_profile (A4)
    const existing = await this.driver.queryOne<{ id: string }>(
      'SELECT id FROM user_profile LIMIT 1;'
    );

    // Xác định ID bản ghi: dùng lại ID đã có hoặc dùng ID mặc định
    const profileId = existing?.id ?? input.id ?? DEFAULT_PROFILE_ID;

    // Chuẩn bị dữ liệu đầy đủ để kiểm định qua Zod Schema (A5)
    // Nếu servings <= 0, không nguyên, hoặc allergen_code lạ -> Zod sẽ ném lỗi ngay
    const validated = UserProfileSchema.parse({
      id: profileId,
      display_name: input.display_name,
      servings: input.servings,
      allergies: input.allergies,
      dietary_preference: input.dietary_preference,
      essential_spices: input.essential_spices ?? [],
      available_equipment: input.available_equipment ?? [],
    });

    const allergiesJson =
      validated.allergies === null ? null : JSON.stringify(validated.allergies);
    const spicesJson = JSON.stringify(validated.essential_spices);
    const equipmentJson = JSON.stringify(validated.available_equipment);

    // Phân nhánh lưu trữ: Cập nhật nếu đã có hàng cũ, Chèn mới nếu chưa có
    if (existing) {
      await this.driver.execute(
        `UPDATE user_profile SET
           display_name = ?,
           servings = ?,
           allergies = ?,
           dietary_preference = ?,
           essential_spices = ?,
           available_equipment = ?
         WHERE id = ?;`,
        [
          validated.display_name ?? null,
          validated.servings,
          allergiesJson,
          validated.dietary_preference ?? null,
          spicesJson,
          equipmentJson,
          existing.id,
        ]
      );
    } else {
      await this.driver.execute(
        `INSERT INTO user_profile (
           id, display_name, servings, allergies, dietary_preference, essential_spices, available_equipment
         ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          validated.id,
          validated.display_name ?? null,
          validated.servings,
          allergiesJson,
          validated.dietary_preference ?? null,
          spicesJson,
          equipmentJson,
        ]
      );
    }

    return validated;
  }

  /**
   * Đếm số lượng hàng hiện có trong bảng user_profile.
   *
   * @returns Số hàng trong bảng (kỳ vọng là 0 hoặc 1)
   *
   * @example
   * const count = await repo.count(); // => 1
   */
  async count(): Promise<number> {
    const row = await this.driver.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM user_profile;'
    );
    return Number(row?.cnt ?? 0);
  }
}
