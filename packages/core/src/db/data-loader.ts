import { SqlDriver } from './driver.js';

export interface RecipeIngredientInput {
  ingredient: string;
  qty: number;
  unit: string;
  role: 'flavor' | 'structure' | 'moisture' | 'preservation' | 'color';
  flavor_group: 'salt' | 'sugar' | 'acid' | 'fat' | 'spice' | 'none';
  optional?: boolean;
  amount_note?: string;
  group?: string;
}

export interface RecipeStepInput {
  id: string;
  title: string;
  kind: 'active' | 'passive';
  seconds: number;
  after?: string[];
  resources?: string[];
  cue?: string;
  text: string;
  safety_rule?: string;
  target_temperature?: number;
  order?: number;
}

export interface RecipeInput {
  id?: string;
  slug: string;
  name: string;
  servings_base: number;
  total_minutes: number;
  difficulty: number;
  equipment?: string[];
  tags?: string[];
  status: 'draft' | 'reviewed' | 'published';
  reviewer?: string;
  reviewed_at?: string;
  version?: number;
  description?: string;
  source?: string;
  confirmed_by?: string;
  missing_fields?: string[];
  synthetic?: boolean;
  ingredients: RecipeIngredientInput[];
  steps: RecipeStepInput[];
}

export interface IngredientInput {
  id: string;
  name: string;
  aliases?: string[];
  group: string;
  base_unit: 'g' | 'ml' | 'cái';
  conversions?: Record<string, number>;
  allergen_codes?: string[] | null;
  reference_price?: number | null;
  price_updated_at?: string | null;
  storage_rule_id?: string | null;
  source?: string;
  confirmed_by?: string;
  missing_fields?: string[];
}

export interface DataBundle {
  data_version: number | string;
  recipes?: RecipeInput[];
  ingredients?: IngredientInput[];
}

export interface LoadOptions {
  allowDraft?: boolean;
  logger?: (msg: string) => void;
}

export interface LoadResult {
  status: 'loaded' | 'skipped';
  reason?: string;
  loadedRecipesCount: number;
  dataVersion: string;
}

interface ExistingRecipeRow {
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
}

/**
 * Kiểm tra xem nội dung của công thức có thay đổi hay không so với bản ghi hiện có trong CSDL.
 */
function isRecipeContentEqual(
  existing: ExistingRecipeRow,
  incoming: RecipeInput,
  existingIngredients: Array<{ ingredient_id: string; qty: number; unit: string; role: string; optional: number }>,
  existingSteps: Array<{ id: string; seconds: number; title: string; text: string; kind: string }>
): boolean {
  if (existing.name !== incoming.name) return false;
  if (existing.servings_base !== incoming.servings_base) return false;
  if (existing.total_minutes !== incoming.total_minutes) return false;
  if (existing.difficulty !== incoming.difficulty) return false;

  const existingEq = JSON.parse(existing.equipment || '[]').sort();
  const incomingEq = [...(incoming.equipment || [])].sort();
  if (JSON.stringify(existingEq) !== JSON.stringify(incomingEq)) return false;

  const existingTags = JSON.parse(existing.tags || '[]').sort();
  const incomingTags = [...(incoming.tags || [])].sort();
  if (JSON.stringify(existingTags) !== JSON.stringify(incomingTags)) return false;

  // So sánh nguyên liệu
  const incomingIngs = incoming.ingredients || [];
  if (existingIngredients.length !== incomingIngs.length) return false;
  for (let i = 0; i < existingIngredients.length; i++) {
    const e = existingIngredients[i]!;
    const inc = incomingIngs[i]!;
    if (e.ingredient_id !== inc.ingredient) return false;
    if (e.qty !== inc.qty) return false;
    if (e.unit !== inc.unit) return false;
    if (e.role !== inc.role) return false;
    if (Boolean(e.optional) !== Boolean(inc.optional)) return false;
  }

  // So sánh các bước
  const incomingSteps = incoming.steps || [];
  if (existingSteps.length !== incomingSteps.length) return false;
  for (let i = 0; i < existingSteps.length; i++) {
    const s = existingSteps[i]!;
    const inc = incomingSteps[i]!;
    if (s.seconds !== inc.seconds) return false;
    if (s.title !== inc.title) return false;
    if (s.text !== inc.text) return false;
    if (s.kind !== inc.kind) return false;
  }

  return true;
}

/**
 * Bộ nạp dữ liệu đóng gói vào SQLite (Mục T05.3, T05.4, B1-B5, C1-C4).
 */
export async function loadDataBundle(
  driver: SqlDriver,
  bundle: DataBundle,
  options: LoadOptions = {}
): Promise<LoadResult> {
  const log = options.logger || console.log;
  const bundleVersionStr = String(bundle.data_version);

  // 1. Kiểm tra data_version hiện tại trong app_metadata
  const metaRow = await driver.queryOne<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'data_version';"
  );

  const currentVersionStr = metaRow?.value;
  if (currentVersionStr !== undefined && currentVersionStr !== null) {
    const currentNum = Number(currentVersionStr);
    const bundleNum = Number(bundleVersionStr);

    // Nếu data_version không tăng (bằng hoặc nhỏ hơn), bỏ qua nạp (B2, E4)
    if (!Number.isNaN(currentNum) && !Number.isNaN(bundleNum) && bundleNum <= currentNum) {
      log(`bỏ qua nạp: cùng data_version = ${currentVersionStr}`);
      return {
        status: 'skipped',
        reason: 'up-to-date',
        loadedRecipesCount: 0,
        dataVersion: currentVersionStr,
      };
    }
  }

  // 2. Kiểm tra nếu bộ dữ liệu rỗng (B5, E3)
  const allRecipes = bundle.recipes || [];
  if (allRecipes.length === 0) {
    log('không có món nào để nạp');
    await driver.execute(
      "INSERT INTO app_metadata (key, value) VALUES ('data_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
      [bundleVersionStr]
    );
    return {
      status: 'loaded',
      reason: 'no-recipes',
      loadedRecipesCount: 0,
      dataVersion: bundleVersionStr,
    };
  }

  // 3. Lọc danh sách món: chỉ nạp published hoặc reviewed; draft chỉ nạp khi bật cờ dev (B1, B4)
  const recipesToLoad = allRecipes.filter((r) => {
    if (r.status === 'draft') {
      return Boolean(options.allowDraft);
    }
    return r.status === 'published' || r.status === 'reviewed';
  });

  // 4. Thực thi nạp trong một giao dịch
  await driver.transaction(async (tx) => {
    // 4.1 Nạp danh mục nguyên liệu trước (nếu có) để thỏa mãn ràng buộc khóa ngoại
    if (bundle.ingredients && bundle.ingredients.length > 0) {
      for (const ing of bundle.ingredients) {
        await tx.execute(
          `INSERT INTO ingredient (
            id, name, aliases, "group", base_unit, conversions, allergen_codes,
            reference_price, price_updated_at, storage_rule_id, source, confirmed_by, missing_fields
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            aliases = excluded.aliases,
            "group" = excluded."group",
            base_unit = excluded.base_unit,
            conversions = excluded.conversions,
            allergen_codes = excluded.allergen_codes,
            reference_price = excluded.reference_price,
            price_updated_at = excluded.price_updated_at,
            storage_rule_id = excluded.storage_rule_id,
            source = excluded.source,
            confirmed_by = excluded.confirmed_by,
            missing_fields = excluded.missing_fields;`,
          [
            ing.id,
            ing.name,
            JSON.stringify(ing.aliases || []),
            ing.group,
            ing.base_unit,
            JSON.stringify(ing.conversions || {}),
            ing.allergen_codes ? JSON.stringify(ing.allergen_codes) : null,
            ing.reference_price ?? null,
            ing.price_updated_at ?? null,
            ing.storage_rule_id ?? null,
            ing.source ?? null,
            ing.confirmed_by ?? null,
            JSON.stringify(ing.missing_fields || []),
          ]
        );
      }
    }

    // 4.2 Nạp từng công thức và kiểm tra quy tắc phiên bản (C1, C2, C3)
    for (const r of recipesToLoad) {
      const recipeId = r.id || r.slug;
      const recipeVersion = r.version ?? 1;

      // Tìm món cũ theo slug
      const existing = await tx.queryOne<ExistingRecipeRow>(
        'SELECT id, slug, name, servings_base, total_minutes, difficulty, equipment, tags, status, version FROM recipe WHERE slug = ?;',
        [r.slug]
      );

      if (existing) {
        // Lấy nguyên liệu và bước hiện có để so sánh nội dung
        const existingIngs = await tx.query<{
          ingredient_id: string;
          qty: number;
          unit: string;
          role: string;
          optional: number;
        }>('SELECT ingredient_id, qty, unit, role, optional FROM recipe_ingredient WHERE recipe_id = ? ORDER BY id ASC;', [
          existing.id,
        ]);
        const existingSteps = await tx.query<{
          id: string;
          seconds: number;
          title: string;
          text: string;
          kind: string;
        }>('SELECT id, seconds, title, text, kind FROM recipe_step WHERE recipe_id = ? ORDER BY "order" ASC;', [
          existing.id,
        ]);

        const contentEqual = isRecipeContentEqual(existing, r, existingIngs, existingSteps);

        if (!contentEqual) {
          // Quy tắc C1: nội dung đổi nhưng version không tăng -> từ chối với lỗi rõ ràng
          if (recipeVersion <= existing.version) {
            throw new Error(
              `[C1-REJECT] Công thức '${r.slug}' đã thay đổi nội dung nhưng version không tăng ` +
                `(version hiện tại: ${existing.version}, version mới: ${recipeVersion}). ` +
                `Theo quy tắc T05.4, khi sửa công thức đã xuất bản thì bắt buộc phải tăng version.`
            );
          }

          // Quy tắc C2: nội dung đổi và version tăng -> cập nhật món
          await tx.execute(
            `UPDATE recipe SET
              name = ?, servings_base = ?, total_minutes = ?, difficulty = ?,
              equipment = ?, tags = ?, status = ?, reviewer = ?, reviewed_at = ?,
              version = ?, description = ?, source = ?, confirmed_by = ?, missing_fields = ?
            WHERE id = ?;`,
            [
              r.name,
              r.servings_base,
              r.total_minutes,
              r.difficulty,
              JSON.stringify(r.equipment || []),
              JSON.stringify(r.tags || []),
              r.status,
              r.reviewer ?? null,
              r.reviewed_at ?? null,
              recipeVersion,
              r.description ?? null,
              r.source ?? null,
              r.confirmed_by ?? null,
              JSON.stringify(r.missing_fields || []),
              existing.id,
            ]
          );

          // Xóa nguyên liệu và bước cũ để nạp lại
          await tx.execute('DELETE FROM recipe_ingredient WHERE recipe_id = ?;', [existing.id]);
          await tx.execute('DELETE FROM recipe_step WHERE recipe_id = ?;', [existing.id]);

          await insertRecipeDetails(tx, existing.id, r);
        } else {
          // Quy tắc C3: nội dung y hệt và version giữ nguyên -> không làm gì
          continue;
        }
      } else {
        // Món mới tinh
        await tx.execute(
          `INSERT INTO recipe (
            id, slug, name, servings_base, total_minutes, difficulty, equipment,
            tags, status, reviewer, reviewed_at, version, description, source, confirmed_by, missing_fields
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            recipeId,
            r.slug,
            r.name,
            r.servings_base,
            r.total_minutes,
            r.difficulty,
            JSON.stringify(r.equipment || []),
            JSON.stringify(r.tags || []),
            r.status,
            r.reviewer ?? null,
            r.reviewed_at ?? null,
            recipeVersion,
            r.description ?? null,
            r.source ?? null,
            r.confirmed_by ?? null,
            JSON.stringify(r.missing_fields || []),
          ]
        );

        await insertRecipeDetails(tx, recipeId, r);
      }
    }

    // 4.3 Cập nhật app_metadata với data_version mới
    await tx.execute(
      "INSERT INTO app_metadata (key, value) VALUES ('data_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
      [bundleVersionStr]
    );
  });

  log(`Đã nạp thành công ${recipesToLoad.length} món với phiên bản dữ liệu ${bundleVersionStr}`);
  return {
    status: 'loaded',
    loadedRecipesCount: recipesToLoad.length,
    dataVersion: bundleVersionStr,
  };
}

async function insertRecipeDetails(tx: SqlDriver, recipeId: string, r: RecipeInput): Promise<void> {
  // Thêm ingredients
  const ingredients = r.ingredients || [];
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i]!;
    const ingRowId = `${recipeId}_ing_${i + 1}`;
    await tx.execute(
      `INSERT INTO recipe_ingredient (
        id, recipe_id, ingredient_id, qty, unit, amount_note, role, flavor_group, optional, "group"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        ingRowId,
        recipeId,
        ing.ingredient,
        ing.qty,
        ing.unit,
        ing.amount_note ?? null,
        ing.role,
        ing.flavor_group,
        ing.optional ? 1 : 0,
        ing.group ?? null,
      ]
    );
  }

  // Thêm steps
  const steps = r.steps || [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    await tx.execute(
      `INSERT INTO recipe_step (
        id, recipe_id, "order", title, kind, seconds, after, resources, cue, text, safety_rule, target_temperature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        step.id,
        recipeId,
        step.order ?? i + 1,
        step.title,
        step.kind,
        step.seconds,
        JSON.stringify(step.after || []),
        JSON.stringify(step.resources || []),
        step.cue ?? null,
        step.text,
        step.safety_rule ?? null,
        step.target_temperature ?? null,
      ]
    );
  }
}
