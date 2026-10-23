import { AllergenCode } from '../enums.js';
import { SqlDriver } from './driver.js';

export interface RecipeFilterOptions {
  /**
   * null: chưa khai dị ứng (trả về rỗng D1e)
   * []: đã khai không có dị ứng (hiện cả món có allergen_codes: null D1d)
   * [codes...]: có dị ứng (loại món chứa mã dị ứng hoặc allergen_codes: null D1a-c)
   */
  userAllergies?: AllergenCode[] | null;
  /** Bí danh snake_case tương thích T06 */
  allergies?: AllergenCode[] | null;
  /**
   * Danh sách dụng cụ người dùng có. Món chỉ hiện nếu người dùng có MỌI dụng cụ yêu cầu.
   */
  userEquipment?: string[];
  /** Bí danh snake_case tương thích T06 */
  available_equipment?: string[];
  /**
   * Thời gian nấu tối đa (phút), so sánh nhỏ hơn hoặc bằng (total_minutes <= maxMinutes).
   */
  maxMinutes?: number;
  /** Bí danh snake_case tương thích T06 */
  max_minutes?: number;
}

export interface RecipeSummary {
  id: string;
  slug: string;
  name: string;
  servings_base: number;
  total_minutes: number;
  difficulty: number;
  equipment: string[];
  tags: string[];
  status: string;
  version: number;
}

export interface RecipeIngredientDetail {
  ingredient: string;
  qty: number;
  unit: string;
  role: string;
  flavor_group: string;
  optional: boolean;
  amount_note?: string | null;
  group?: string | null;
}

export interface RecipeStepDetail {
  id: string;
  order: number;
  title: string;
  kind: string;
  seconds: number;
  after: string[];
  resources: string[];
  cue?: string | null;
  text: string;
  safety_rule?: string | null;
  target_temperature?: number | null;
}

export interface RecipeDetail extends RecipeSummary {
  description?: string | null;
  ingredients: RecipeIngredientDetail[];
  steps: RecipeStepDetail[];
}

interface RawRecipeRow {
  id: string;
  slug: string;
  name: string;
  servings_base: number;
  total_minutes: number;
  difficulty: number;
  equipment: string;
  tags: string;
  status: string;
  version: number;
  description?: string | null;
}

/** Mã trạng thái trả về khi chưa khai báo dị ứng */
export const ALLERGIES_NOT_DECLARED = 'ALLERGIES_NOT_DECLARED';

/**
 * Lớp truy cập dữ liệu công thức món ăn (Mục T05.5).
 */
export class RecipeRepo {
  constructor(private driver: SqlDriver) {}

  /**
   * Lấy danh sách món ăn đã lọc theo các tiêu chí (dị ứng, thời gian, dụng cụ).
   * Kết quả sắp xếp theo slug tăng dần (mục D trong docs/expected/T05.md).
   */
  async list(filters?: RecipeFilterOptions): Promise<RecipeSummary[] & { code?: string }> {
    const effectiveAllergies =
      filters?.allergies !== undefined ? filters.allergies : filters?.userAllergies;
    const effectiveEquipment =
      filters?.available_equipment !== undefined
        ? filters.available_equipment
        : filters?.userEquipment;
    const effectiveMaxMinutes =
      filters?.max_minutes !== undefined ? filters.max_minutes : filters?.maxMinutes;

    // Trường hợp chưa khai dị ứng: trả về danh sách rỗng kèm mã ALLERGIES_NOT_DECLARED (D1e - an toàn sức khỏe người dùng)
    if (filters && effectiveAllergies === null) {
      const emptyResult: RecipeSummary[] & { code?: string } = [];
      emptyResult.code = ALLERGIES_NOT_DECLARED;
      return emptyResult;
    }

    // 1. Lấy tất cả các món hiện có trong CSDL sắp theo slug ASC
    const rows = await this.driver.query<RawRecipeRow>(
      'SELECT id, slug, name, servings_base, total_minutes, difficulty, equipment, tags, status, version FROM recipe ORDER BY slug ASC;'
    );

    // 2. Lấy thông tin dị ứng của từng món từ bảng recipe_ingredient kết hợp ingredient
    const recipeAllergensMap = new Map<
      string,
      { hasUnknownAllergen: boolean; allergenSet: Set<string> }
    >();

    const ingRows = await this.driver.query<{
      recipe_id: string;
      allergen_codes: string | null;
    }>(
      `SELECT ri.recipe_id, i.allergen_codes
       FROM recipe_ingredient ri
       LEFT JOIN ingredient i ON ri.ingredient_id = i.id;`
    );

    for (const row of ingRows) {
      if (!recipeAllergensMap.has(row.recipe_id)) {
        recipeAllergensMap.set(row.recipe_id, {
          hasUnknownAllergen: false,
          allergenSet: new Set<string>(),
        });
      }
      const entry = recipeAllergensMap.get(row.recipe_id)!;

      if (row.allergen_codes === null || row.allergen_codes === undefined) {
        entry.hasUnknownAllergen = true;
      } else {
        try {
          const codes: string[] = JSON.parse(row.allergen_codes);
          if (Array.isArray(codes)) {
            for (const c of codes) {
              entry.allergenSet.add(c);
            }
          }
        } catch {
          entry.hasUnknownAllergen = true;
        }
      }
    }

    // 3. Áp dụng các bộ lọc
    const results: RecipeSummary[] = [];

    for (const r of rows) {
      // 3.1 Bộ lọc thời gian (D2): total_minutes <= maxMinutes; loại món thiếu total_minutes
      if (effectiveMaxMinutes !== undefined) {
        // Loại món thiếu total_minutes (null, undefined hoặc <= 0)
        if (
          r.total_minutes === null ||
          r.total_minutes === undefined ||
          r.total_minutes <= 0
        ) {
          continue;
        }
        // Loại món có thời gian vượt quá ngưỡng lọc
        if (r.total_minutes > effectiveMaxMinutes) {
          continue;
        }
      }

      // 3.2 Bộ lọc dụng cụ (D3): người dùng cần có MỌI dụng cụ mà món yêu cầu
      const requiredEq: string[] = JSON.parse(r.equipment || '[]');
      if (effectiveEquipment !== undefined) {
        const userEqSet = new Set(effectiveEquipment);
        const hasAllTools = requiredEq.every((eq) => userEqSet.has(eq));
        if (!hasAllTools) {
          continue;
        }
      }

      // 3.3 Bộ lọc dị ứng (D1):
      if (effectiveAllergies && effectiveAllergies.length > 0) {
        const allergenInfo = recipeAllergensMap.get(r.id) || {
          hasUnknownAllergen: false,
          allergenSet: new Set<string>(),
        };

        // Chỉ loại nguyên liệu có allergen_codes: null khi người dùng đã khai ít nhất một dị ứng (Chỉ đạo 6 & D1a-c)
        if (allergenInfo.hasUnknownAllergen) {
          continue;
        }

        // Loại nếu món chứa bất kỳ dị ứng nào người dùng đã khai
        const hasConflict = effectiveAllergies.some((userAllergen) =>
          allergenInfo.allergenSet.has(userAllergen)
        );
        if (hasConflict) {
          continue;
        }
      }

      results.push({
        id: r.id,
        slug: r.slug,
        name: r.name,
        servings_base: r.servings_base,
        total_minutes: r.total_minutes,
        difficulty: r.difficulty,
        equipment: requiredEq,
        tags: JSON.parse(r.tags || '[]'),
        status: r.status,
        version: r.version,
      });
    }

    return results;
  }

  /**
   * Lấy chi tiết công thức kèm nguyên liệu và các bước theo slug (Mục D5).
   * Trả về null nếu không tìm thấy, không ném lỗi (D5b, D5c).
   */
  async get(slug: string): Promise<RecipeDetail | null> {
    const recipe = await this.driver.queryOne<RawRecipeRow>(
      'SELECT id, slug, name, servings_base, total_minutes, difficulty, equipment, tags, status, version, description FROM recipe WHERE slug = ?;',
      [slug]
    );

    if (!recipe) {
      return null;
    }

    // Lấy nguyên liệu
    const ingRows = await this.driver.query<{
      ingredient_id: string;
      qty: number;
      unit: string;
      role: string;
      flavor_group: string;
      optional: number;
      amount_note: string | null;
      group: string | null;
    }>(
      'SELECT ingredient_id, qty, unit, role, flavor_group, optional, amount_note, "group" FROM recipe_ingredient WHERE recipe_id = ? ORDER BY id ASC;',
      [recipe.id]
    );

    const ingredients: RecipeIngredientDetail[] = ingRows.map((ing) => ({
      ingredient: ing.ingredient_id,
      qty: ing.qty,
      unit: ing.unit,
      role: ing.role,
      flavor_group: ing.flavor_group,
      optional: Boolean(ing.optional),
      amount_note: ing.amount_note,
      group: ing.group,
    }));

    // Lấy các bước thực hiện
    const stepRows = await this.driver.query<{
      id: string;
      order: number;
      title: string;
      kind: string;
      seconds: number;
      after: string;
      resources: string;
      cue: string | null;
      text: string;
      safety_rule: string | null;
      target_temperature: number | null;
    }>(
      'SELECT id, "order", title, kind, seconds, after, resources, cue, text, safety_rule, target_temperature FROM recipe_step WHERE recipe_id = ? ORDER BY "order" ASC;',
      [recipe.id]
    );

    const steps: RecipeStepDetail[] = stepRows.map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      kind: s.kind,
      seconds: s.seconds,
      after: JSON.parse(s.after || '[]'),
      resources: JSON.parse(s.resources || '[]'),
      cue: s.cue,
      text: s.text,
      safety_rule: s.safety_rule,
      target_temperature: s.target_temperature,
    }));

    return {
      id: recipe.id,
      slug: recipe.slug,
      name: recipe.name,
      servings_base: recipe.servings_base,
      total_minutes: recipe.total_minutes,
      difficulty: recipe.difficulty,
      equipment: JSON.parse(recipe.equipment || '[]'),
      tags: JSON.parse(recipe.tags || '[]'),
      status: recipe.status,
      version: recipe.version,
      description: recipe.description,
      ingredients,
      steps,
    };
  }
}
