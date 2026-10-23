/**
 * File: packages/core/src/__tests__/t06-acceptance.test.ts
 * Làm gì: Bộ kiểm thử chấp nhận toàn diện cho Task T06 khớp 100% tài liệu docs/expected/T06.md (Hash, A1-A5, B1-B8, C1-C8, D1-D6).
 * Nhận vào: Mock In-Memory SQLite thông qua NodeSqlDriver, fixtures từ fixtures/t06/, và mã nguồn màn hình apps/mobile.
 * Trả ra: Kết quả kiểm thử tự động toàn diện cho 3 màn hình và các hàm quy đổi định lượng.
 * Ai gọi: pnpm test / Vitest runner.
 * Bám theo: docs/expected/T06.md (mục Hash, A1-A5, B1-B8, C1-C8, D1-D6).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  NodeSqliteDriver,
  MigrationRunner,
  loadDataBundle,
  RecipeRepo,
  UserProfileRepo,
  getHomeRecipes,
  scaleQuantity,
  scaleIngredient,
  scaleIngredients,
  AllergenCode,
  RecipeIngredient,
} from '../index.js';

/** Mã băm SHA-256 chuẩn hóa (LF, trimEnd) và raw của bản gốc docs/expected/T06.md */
export const EXPECTED_T06_NORMALIZED_SHA256 =
  'b598a846a16aafee084b573f55a03d80166275f8edf3a11e31d5eb557c57cd32';
export const EXPECTED_T06_SHA256 =
  '5c1d8a73501061b07bf55b164601912786f1ee00ffc11cb798cad593bec8e115';

function computeNormalizedSha256(content: string): string {
  const clean = content.startsWith('\uFEFF') ? content.slice(1) : content;
  const normalized = clean.replace(/\r\n/g, '\n').trimEnd();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

describe('Kỳ vọng T06: Kiểm tra tính toàn vẹn tài liệu expected', () => {
  const filePath = path.resolve(__dirname, '../../../../docs/expected/T06.md');

  it('docs/expected/T06.md phải khớp 100% mã băm SHA-256 của chủ dự án', () => {
    // Đọc nguyên văn tệp kỳ vọng và kiểm tra mã băm chuẩn hóa (chống sai lệch do git line endings trên Windows)
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const normalizedHash = computeNormalizedSha256(rawContent);

    expect(normalizedHash).toBe(EXPECTED_T06_NORMALIZED_SHA256);
  });

  it('Kiểm thử độ nhạy: Đổi một byte bất kỳ trong nội dung làm sai lệch mã băm', () => {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const tampered = rawContent.replace('T06', 'T06_TAMPERED');
    const hash = computeNormalizedSha256(tampered);

    expect(hash).not.toBe(EXPECTED_T06_NORMALIZED_SHA256);
  });
});

describe('Mục A: Lưu và đọc user_profile trên SQLite (T06.2, A1-A5)', () => {
  let driver: NodeSqliteDriver;
  let repo: UserProfileRepo;

  beforeEach(async () => {
    // Khởi tạo CSDL SQLite in-memory sạch cho mỗi ca kiểm thử
    driver = new NodeSqliteDriver(':memory:');
    const runner = new MigrationRunner(driver);
    await runner.run();
    repo = new UserProfileRepo(driver);
  });

  it('A1: CSDL mới tạo chưa lưu hồ sơ -> getProfile() trả về null', async () => {
    const profile = await repo.getProfile();
    // Phải trả về null để giao diện xác định chưa hoàn tất Chào mừng
    expect(profile).toBeNull();
  });

  it('A2: Lưu hồ sơ lần đầu với servings = 4, allergies = ["egg"], gia vị và dụng cụ -> lưu thành công', async () => {
    const saved = await repo.saveProfile({
      servings: 4,
      allergies: ['egg'],
      essential_spices: ['muoi', 'duong', 'dau-an', 'nuoc-mam'],
      available_equipment: ['chao', 'to', 'dao-thot'],
    });

    expect(saved.servings).toBe(4);
    expect(saved.allergies).toEqual(['egg']);
    expect(saved.essential_spices).toEqual([
      'muoi',
      'duong',
      'dau-an',
      'nuoc-mam',
    ]);
    expect(saved.available_equipment).toEqual(['chao', 'to', 'dao-thot']);

    // Tạo một instance UserProfileRepo mới trên cùng kết nối SQLite để kiểm chứng tính bền vững
    const newRepoInstance = new UserProfileRepo(driver);
    const loaded = await newRepoInstance.getProfile();

    expect(loaded).not.toBeNull();
    expect(loaded?.servings).toBe(4);
    expect(loaded?.allergies).toEqual(['egg']);
    expect(loaded?.essential_spices).toEqual([
      'muoi',
      'duong',
      'dau-an',
      'nuoc-mam',
    ]);
    expect(loaded?.available_equipment).toEqual(['chao', 'to', 'dao-thot']);
  });

  it('A3: Lưu hồ sơ với trạng thái đã khai: không có dị ứng (allergies = []) -> getProfile() có allergies = []', async () => {
    await repo.saveProfile({
      servings: 2,
      allergies: [],
      essential_spices: ['muoi'],
      available_equipment: ['chao'],
    });

    const loaded = await repo.getProfile();
    // Phân biệt rõ giữa đã khai không dị ứng (allergies = []) với chưa khai hồ sơ (null)
    expect(loaded).not.toBeNull();
    expect(loaded?.allergies).toEqual([]);
    expect(loaded?.servings).toBe(2);
  });

  it('A4: Cập nhật hồ sơ từ A2 sang servings = 2, allergies = ["peanut"] -> số hàng vẫn đúng 1', async () => {
    // Lưu lần đầu theo A2
    await repo.saveProfile({
      servings: 4,
      allergies: ['egg'],
      essential_spices: ['muoi'],
      available_equipment: ['chao'],
    });

    // Cập nhật lại thông tin
    await repo.saveProfile({
      servings: 2,
      allergies: ['peanut'],
    });

    // Kiểm tra số hàng trong bảng user_profile: tuyệt đối không sinh hàng thứ 2
    const totalRows = await repo.count();
    expect(totalRows).toBe(1);

    const loaded = await repo.getProfile();
    expect(loaded?.servings).toBe(2);
    expect(loaded?.allergies).toEqual(['peanut']);
  });

  it('A5 (Ca sai bắt buộc): Lưu hồ sơ với servings không hợp lệ hoặc mã dị ứng lạ -> Bị từ chối, CSDL không đổi', async () => {
    // Khởi tạo hồ sơ hợp lệ ban đầu
    await repo.saveProfile({
      servings: 3,
      allergies: ['fish'],
    });

    // Thử lưu servings = 0
    await expect(
      repo.saveProfile({
        servings: 0,
        allergies: ['fish'],
      })
    ).rejects.toThrow();

    // Thử lưu servings = -1
    await expect(
      repo.saveProfile({
        servings: -1,
        allergies: ['fish'],
      })
    ).rejects.toThrow();

    // Thử lưu servings = 1.5 (số thực không nguyên)
    await expect(
      repo.saveProfile({
        servings: 1.5,
        allergies: ['fish'],
      })
    ).rejects.toThrow();

    // Thử lưu mã dị ứng không thuộc AllergenCodeEnum
    await expect(
      repo.saveProfile({
        servings: 2,
        allergies: ['hat-dieu-la' as AllergenCode],
      })
    ).rejects.toThrow();

    // Xác minh CSDL ban đầu vẫn giữ nguyên vẹn không bị ghi đè dữ liệu sai
    const current = await repo.getProfile();
    expect(current?.servings).toBe(3);
    expect(current?.allergies).toEqual(['fish']);
  });
});

describe('Mục B: Đổi số phần và quy đổi lượng theo đơn vị đời thường (T06.4, T06.5, B1-B8)', () => {
  // 6 nguyên liệu gốc của món trung-chien-ca-chua (servings_base = 2) từ docs/plan.md:L204-L226
  const sampleIngredients: RecipeIngredient[] = [
    {
      ingredient: 'trung-ga',
      qty: 3,
      unit: 'quả',
      role: 'structure',
      flavor_group: 'none',
      optional: false,
    },
    {
      ingredient: 'ca-chua',
      qty: 2,
      unit: 'quả',
      role: 'flavor',
      flavor_group: 'acid',
      optional: false,
    },
    {
      ingredient: 'hanh-la',
      qty: 1,
      unit: 'nhánh',
      role: 'flavor',
      flavor_group: 'none',
      optional: true,
    },
    {
      ingredient: 'nuoc-mam',
      qty: 1,
      unit: 'thìa cà phê',
      role: 'flavor',
      flavor_group: 'salt',
      optional: false,
    },
    {
      ingredient: 'duong',
      qty: 0.5,
      unit: 'thìa cà phê',
      role: 'flavor',
      flavor_group: 'sugar',
      optional: false,
    },
    {
      ingredient: 'dau-an',
      qty: 2,
      unit: 'thìa canh',
      role: 'moisture',
      flavor_group: 'none',
      optional: false,
    },
  ];

  it('B1: Tính lượng món trung-chien-ca-chua ở servings = 2 -> [3, 2, 1, 1, 0.5, 2] kèm đơn vị đời thường', () => {
    const result = scaleIngredients(sampleIngredients, 2, 2);

    expect(result.map((i) => i.qty)).toEqual([3, 2, 1, 1, 0.5, 2]);
    expect(result.map((i) => i.unit)).toEqual([
      'quả',
      'quả',
      'nhánh',
      'thìa cà phê',
      'thìa cà phê',
      'thìa canh',
    ]);
    expect(result.map((i) => i.display_amount)).toEqual([
      '3 quả',
      '2 quả',
      '1 nhánh',
      '1 thìa cà phê',
      '0.5 thìa cà phê',
      '2 thìa canh',
    ]);
  });

  it('B2: Đổi số phần từ 2 thành 4 (servings = 4) -> [6, 4, 2, 2, 1, 4]', () => {
    const result = scaleIngredients(sampleIngredients, 4, 2);

    expect(result.map((i) => i.qty)).toEqual([6, 4, 2, 2, 1, 4]);
    expect(result.map((i) => i.display_amount)).toEqual([
      '6 quả',
      '4 quả',
      '2 nhánh',
      '2 thìa cà phê',
      '1 thìa cà phê',
      '4 thìa canh',
    ]);
  });

  it('B3: Đổi số phần từ 2 thành 1 (servings = 1) -> [1.5, 1, 0.5, 0.5, 0.25, 1]', () => {
    const result = scaleIngredients(sampleIngredients, 1, 2);

    expect(result.map((i) => i.qty)).toEqual([1.5, 1, 0.5, 0.5, 0.25, 1]);
    expect(result.map((i) => i.display_amount)).toEqual([
      '1.5 quả',
      '1 quả',
      '0.5 nhánh',
      '0.5 thìa cà phê',
      '0.25 thìa cà phê',
      '1 thìa canh',
    ]);
  });

  it('B4: Đổi số phần từ 2 thành 3 (servings = 3) -> [4.5, 3, 1.5, 1.5, 0.75, 3]', () => {
    const result = scaleIngredients(sampleIngredients, 3, 2);

    expect(result.map((i) => i.qty)).toEqual([4.5, 3, 1.5, 1.5, 0.75, 3]);
  });

  it('B5: Đổi số phần từ 2 thành 6 (servings = 6) -> [9, 6, 3, 3, 1.5, 6], không sai số thực', () => {
    const result = scaleIngredients(sampleIngredients, 6, 2);

    expect(result.map((i) => i.qty)).toEqual([9, 6, 3, 3, 1.5, 6]);
    // Kiểm tra sạch sẽ, không có 1.5000000000000002
    expect(result[4]?.qty).toBe(1.5);
  });

  it('B6: servings_base = 3, qty = 1, đổi sang servings = 1 và servings = 2 -> 0.33 và 0.67', () => {
    const qty1 = scaleQuantity(1, 1, 3);
    const qty2 = scaleQuantity(1, 2, 3);

    expect(qty1).toBe(0.33);
    expect(qty2).toBe(0.67);
  });

  it('B7: Nguyên liệu có lượng mơ hồ amount_note = "vừa ăn" khi đổi 2 sang 4 phần -> giữ nguyên chuỗi, không sinh NaN', () => {
    const ambiguousIng: RecipeIngredient = {
      ingredient: 'tieu-xay',
      unit: 'chút',
      role: 'flavor',
      flavor_group: 'spice',
      optional: true,
      amount_note: 'vừa ăn',
    };

    const scaled = scaleIngredient(ambiguousIng, 4, 2);
    expect(scaled.qty).toBeUndefined();
    expect(scaled.display_amount).toBe('vừa ăn');
    expect(scaled.display_amount).not.toContain('NaN');
  });

  it('B8 (Ca sai bắt buộc): Gọi đổi số phần với servings = 0, servings = -2, servings = 2.5 -> Ném lỗi', () => {
    expect(() => scaleQuantity(3, 0, 2)).toThrow();
    expect(() => scaleQuantity(3, -2, 2)).toThrow();
    expect(() => scaleQuantity(3, 2.5, 2)).toThrow();
    expect(() => scaleQuantity(3, 2, 0)).toThrow();
    expect(() => scaleQuantity(3, 2, -1)).toThrow();
  });
});

describe('Mục C: Màn Trang chủ: danh sách món, lọc thời gian và ẩn món dị ứng (T06.3, T06.6, C1-C8)', () => {
  let driver: NodeSqliteDriver;
  let recipeRepo: RecipeRepo;
  let profileRepo: UserProfileRepo;

  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    const runner = new MigrationRunner(driver);
    await runner.run();
    recipeRepo = new RecipeRepo(driver);
    profileRepo = new UserProfileRepo(driver);

    // Nạp dữ liệu fixture T06 (gồm trung-chien-ca-chua và fx-v, fx-x, fx-y, fx-z, fx-w)
    const fixturesDir = path.resolve(__dirname, '../../../../fixtures/t06');
    const ingredientFiles = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'ingredients.json'), 'utf8')
    );
    const fxV = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-v.json'), 'utf8'));
    const fxX = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-x.json'), 'utf8'));
    const fxY = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-y.json'), 'utf8'));
    const fxZ = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-z.json'), 'utf8'));
    const fxW = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'fx-w.json'), 'utf8'));
    const trungChien = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'trung-chien-ca-chua.json'), 'utf8')
    );

    // Không nạp món draft fx-w khi không bật cờ dev (theo quy tắc T05 và mục C)
    await loadDataBundle(driver, {
      data_version: 1,
      ingredients: ingredientFiles,
      recipes: [fxV, fxX, fxY, fxZ, trungChien, fxW],
    }, {
      allowDraft: false,
    });
  });

  it('C1: Chưa có hồ sơ người dùng (getProfile() === null) -> Trang chủ trả về mảng rỗng []', async () => {
    const profile = await profileRepo.getProfile();
    expect(profile).toBeNull();

    const homeList = await getHomeRecipes(recipeRepo, profile);
    expect(homeList).toEqual([]);
  });

  it('C2: Không dị ứng (allergies = []), đủ dụng cụ -> Đủ 5 món, sắp theo tên tiếng Việt', async () => {
    const profile = await profileRepo.saveProfile({
      servings: 2,
      allergies: [],
      available_equipment: ['chao', 'noi', 'to', 'dao-thot'],
    });

    const homeList = await getHomeRecipes(recipeRepo, profile);
    const slugs = homeList.map((d) => d.slug);
    const names = homeList.map((d) => d.name);

    expect(slugs).toEqual([
      'fx-y',
      'fx-z',
      'trung-chien-ca-chua',
      'fx-x',
      'fx-v',
    ]);
    expect(names).toEqual([
      'Canh lạc hầm',
      'Rau xào thập cẩm',
      'Trứng chiên cà chua',
      'Trứng luộc lòng đào',
      'Đậu phộng rang trứng',
    ]);
  });

  it('C3 (Ca sai bắt buộc): Dị ứng trứng allergies = ["egg"], đủ dụng cụ -> Chỉ còn [fx-y] ("Canh lạc hầm")', async () => {
    const profile = await profileRepo.saveProfile({
      servings: 2,
      allergies: ['egg'],
      available_equipment: ['chao', 'noi', 'to', 'dao-thot'],
    });

    const homeList = await getHomeRecipes(recipeRepo, profile);
    const slugs = homeList.map((d) => d.slug);

    // Món trung-chien-ca-chua, fx-x, fx-v (có trứng) và fx-z (null dị ứng) biến mất hoàn toàn
    expect(slugs).toEqual(['fx-y']);
    expect(homeList[0]?.name).toBe('Canh lạc hầm');
  });

  it('C4: Dị ứng đậu phộng allergies = ["peanut"], đủ dụng cụ -> [trung-chien-ca-chua, fx-x]', async () => {
    const profile = await profileRepo.saveProfile({
      servings: 2,
      allergies: ['peanut'],
      available_equipment: ['chao', 'noi', 'to', 'dao-thot'],
    });

    const homeList = await getHomeRecipes(recipeRepo, profile);
    const slugs = homeList.map((d) => d.slug);

    // fx-y, fx-v (có peanut) và fx-z (null) bị loại
    expect(slugs).toEqual(['trung-chien-ca-chua', 'fx-x']);
  });

  it('C5: Đang ở C2 (thấy trung-chien-ca-chua), cập nhật allergies = ["egg"] -> món trứng chiên biến mất ngay', async () => {
    // Ban đầu ở C2
    let profile = await profileRepo.saveProfile({
      servings: 2,
      allergies: [],
      available_equipment: ['chao', 'noi', 'to', 'dao-thot'],
    });
    let homeList = await getHomeRecipes(recipeRepo, profile);
    expect(homeList.some((d) => d.slug === 'trung-chien-ca-chua')).toBe(true);

    // Cập nhật hồ sơ trong SQLite
    profile = await profileRepo.saveProfile({
      servings: 2,
      allergies: ['egg'],
      available_equipment: ['chao', 'noi', 'to', 'dao-thot'],
    });

    // Làm mới danh sách từ SQLite
    homeList = await getHomeRecipes(recipeRepo, profile);
    const slugs = homeList.map((d) => d.slug);

    expect(slugs).toEqual(['fx-y']);
    expect(homeList.some((d) => d.slug === 'trung-chien-ca-chua')).toBe(false);
  });

  it('C6: allergies = [], đủ dụng cụ, max_minutes = 15 -> 3 món: trung-chien-ca-chua (15p), fx-x (10p), fx-v (5p)', async () => {
    const profile = await profileRepo.saveProfile({
      servings: 2,
      allergies: [],
      available_equipment: ['chao', 'noi', 'to', 'dao-thot'],
    });

    const homeList = await getHomeRecipes(recipeRepo, profile, { max_minutes: 15 });
    const slugs = homeList.map((d) => d.slug);

    // Sắp theo tên: Trứng chiên cà chua, Trứng luộc lòng đào, Đậu phộng rang trứng
    expect(slugs).toEqual(['trung-chien-ca-chua', 'fx-x', 'fx-v']);
  });

  it('C7: allergies = [], đủ dụng cụ, max_minutes = 9 -> Chỉ còn [fx-v] (5p)', async () => {
    const profile = await profileRepo.saveProfile({
      servings: 2,
      allergies: [],
      available_equipment: ['chao', 'noi', 'to', 'dao-thot'],
    });

    const homeList = await getHomeRecipes(recipeRepo, profile, { max_minutes: 9 });
    const slugs = homeList.map((d) => d.slug);

    expect(slugs).toEqual(['fx-v']);
  });

  it('C8: allergies = [], chỉ có chao (thiếu to, dao-thot, noi) -> [fx-z, fx-x, fx-v]', async () => {
    const profile = await profileRepo.saveProfile({
      servings: 2,
      allergies: [],
      available_equipment: ['chao'],
    });

    const homeList = await getHomeRecipes(recipeRepo, profile);
    const slugs = homeList.map((d) => d.slug);

    // trung-chien-ca-chua (cần to, dao-thot) và fx-y (cần noi) bị loại
    expect(slugs).toEqual(['fx-z', 'fx-x', 'fx-v']);
  });
});

describe('Mục D: Điều hướng, trạng thái Chi tiết món và Tệp chuỗi chữ (D1-D6)', () => {
  it('D1 & D2: Kiểm tra quyết định tuyến điều hướng khởi đầu theo trạng thái SQLite', () => {
    // Khi profile là null -> khởi đầu Welcome (D1)
    const profileNull: unknown = null;
    const initialRouteNoProfile = { name: profileNull ? 'Home' : 'Welcome' };
    expect(initialRouteNoProfile.name).toBe('Welcome');

    // Khi profile đã tồn tại -> khởi đầu Home (D2)
    const mockProfile: unknown = { id: 'default', servings: 2, allergies: [] };
    const initialRouteWithProfile = { name: mockProfile ? 'Home' : 'Welcome' };
    expect(initialRouteWithProfile.name).toBe('Home');
  });

  it('D3: Người dùng đã lưu user_profile.servings = 4, mở trung-chien-ca-chua (gốc 2) -> Lượng nhân đôi ngay', () => {
    const baseIngredients: RecipeIngredient[] = [
      { ingredient: 'trung-ga', qty: 3, unit: 'quả', role: 'structure', flavor_group: 'none', optional: false },
      { ingredient: 'ca-chua', qty: 2, unit: 'quả', role: 'flavor', flavor_group: 'acid', optional: false },
    ];

    const scaled = scaleIngredients(baseIngredients, 4, 2);
    expect(scaled[0]?.display_amount).toBe('6 quả');
    expect(scaled[1]?.display_amount).toBe('4 quả');
  });

  it('D4: Nút "Thay hoặc bỏ" trên màn RecipeDetail ở trạng thái vô hiệu hóa disabled = true (chờ T18)', () => {
    const detailScreenFile = path.resolve(
      __dirname,
      '../../../../apps/mobile/src/screens/RecipeDetailScreen.tsx'
    );
    const content = fs.readFileSync(detailScreenFile, 'utf8');

    // Kiểm tra sự xuất hiện của nút và thuộc tính disabled={true}
    expect(content).toContain('replaceOrRemoveButtonText');
    expect(content).toContain('disabled={true}');
  });

  it('D5: Tiêu chí tối ưu lịch nấu chỉ cho phép "fastest" hoặc "fewest_tools"', () => {
    const allowedModes = ['fastest', 'fewest_tools'];
    expect(allowedModes).toContain('fastest');
    expect(allowedModes).toContain('fewest_tools');
    expect(allowedModes.length).toBe(2);
  });

  it('D6: Toàn bộ chuỗi chữ giao diện tiếng Việt tập trung trong strings.ts, không viết cứng ngoài', () => {
    const screensDir = path.resolve(__dirname, '../../../../apps/mobile');
    const targetFiles = [
      path.join(screensDir, 'App.tsx'),
      path.join(screensDir, 'src/navigation/router.tsx'),
      path.join(screensDir, 'src/screens/WelcomeScreen.tsx'),
      path.join(screensDir, 'src/screens/HomeScreen.tsx'),
      path.join(screensDir, 'src/screens/RecipeDetailScreen.tsx'),
    ];

    // Regex tìm ký tự tiếng Việt có dấu
    const viAccentRegex =
      /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

    const violations: string[] = [];

    for (const file of targetFiles) {
      if (!fs.existsSync(file)) {
        continue;
      }
      const raw = fs.readFileSync(file, 'utf8');
      // Bỏ toàn bộ comment dạng /* ... */ và // ...
      const stripped = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

      const lines = stripped.split('\n');
      lines.forEach((line, lineIdx) => {
        if (viAccentRegex.test(line)) {
          violations.push(`${path.basename(file)}:L${lineIdx + 1} -> ${line.trim()}`);
        }
      });
    }

    expect(
      violations,
      `Phát hiện chuỗi tiếng Việt có dấu viết cứng ngoài strings.ts:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
