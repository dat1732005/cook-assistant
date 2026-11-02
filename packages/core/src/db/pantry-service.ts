/**
 * File: packages/core/src/db/pantry-service.ts
 * Module: @cook/core
 *
 * Quản lý kho nguyên liệu (pantry_item) và lịch sử thay đổi (pantry_event).
 * Nhận vào: SqlDriver (cơ sở dữ liệu SQLite).
 * Trả ra: Trạng thái kho sau khi thêm, sửa, trừ (deductForSession) hoặc hoàn tác (undoSession).
 * Ai gọi: Màn hình Hoàn tất (T13), Màn hình Kho (T13), test T10.
 * Bám theo: docs/expected/T10.md (ca P1-P10), docs/plan.md mục "Kho của người dùng",
 *           docs/tasks.md mục T10 và R4.
 */

import { SqlDriver } from './driver.js';
import { convertToBaseUnit } from '../units/conversions.js';

// ==========================================
// HẰNG SỐ NGHIỆP VỤ
// ==========================================

/**
 * Số chữ số thập phân tối đa khi làm tròn lượng kho.
 * Nguồn: docs/expected/T10.md – "Làm tròn đến 3 chữ số thập phân."
 * Mục đích: Tránh lỗi dấu phẩy động nổi tiếng (ví dụ 0.1 + 0.2 ≠ 0.3 trong số học nhị phân).
 */
export const ROUNDING_DECIMAL_PLACES = 3; // đề xuất từ T10.md

/**
 * Lý do ghi vào pantry_event khi trừ kho sau nấu.
 * Nguồn: docs/plan.md bảng pantry_event, cột "lý do".
 */
const REASON_COOK = 'cook';

/**
 * Lý do ghi vào pantry_event khi hoàn tác (đảo ngược các sự kiện trừ kho).
 * Nguồn: docs/plan.md bảng pantry_event, cột "lý do".
 */
const REASON_ADJUST = 'adjust';

/**
 * Nguồn của pantry_item khi thêm tay từ giao diện.
 * Nguồn: docs/plan.md bảng pantry_item, cột "nguồn".
 */
const SOURCE_MANUAL = 'manual';

// ==========================================
// KIỂU DỮ LIỆU NỘI BỘ
// ==========================================

/**
 * Bản ghi đọc từ bảng pantry_item trong SQLite.
 */
interface PantryItemRow {
  id: string;
  ingredient_id: string;
  quantity: number;
  base_unit: string;
  storage_location: string;
  added_at: string;
  opened_at: string | null;
  expiry_date: string | null;
  source: string;
}

/**
 * Bản ghi đọc từ bảng pantry_event trong SQLite.
 */
interface PantryEventRow {
  id: string;
  pantry_item_id: string;
  delta: number;
  reason: string;
  cook_session_id: string | null;
  created_at: string;
}

/**
 * Tham số để thêm một lô nguyên liệu vào kho.
 */
export interface AddPantryItemParams {
  /** Mã nguyên liệu chuẩn (slug, phải tồn tại trong bảng ingredient). */
  ingredientId: string;
  /** Số lượng tính theo đơn vị gốc (g, ml, hoặc cái). */
  quantity: number;
  /** Đơn vị gốc ('g', 'ml', 'cái'). */
  baseUnit: 'g' | 'ml' | 'cái';
  /** Vị trí bảo quản (ví dụ 'ngăn mát', 'tủ khô'). */
  storageLocation: string;
  /** Ngày hết hạn (ISO 8601), để null nếu không có. */
  expiryDate?: string | null;
  /** Ngày mở dùng (ISO 8601), để null nếu chưa mở. */
  openedAt?: string | null;
  /** Nguồn gốc lô hàng (mặc định 'manual'). */
  source?: 'manual' | 'cook' | 'shopping' | 'photo';
  /** Ghi đè id (dùng cho test để dễ kiểm soát). */
  id?: string;
}

/**
 * Kết quả trả về từ deductForSession cho từng nguyên liệu.
 */
export interface DeductIngredientResult {
  /** Mã nguyên liệu. */
  ingredientId: string;
  /** Lượng đã trừ thành công (đơn vị gốc). */
  deducted: number;
  /** Lượng thiếu do kho không đủ (0 nếu đủ). */
  shortage: number;
  /** Danh sách sự kiện ghi vào pantry_event (mỗi lô một sự kiện). */
  events: Array<{ pantryItemId: string; delta: number }>;
}

/**
 * Kết quả tổng hợp của deductForSession.
 */
export interface DeductForSessionResult {
  /** Danh sách kết quả theo từng nguyên liệu đã xử lý. */
  ingredients: DeductIngredientResult[];
  /** Các nguyên liệu bị thiếu (ingredientId -> lượng thiếu). */
  shortages: Record<string, number>;
}

/**
 * Mô tả một nguyên liệu cần trừ kho, đã được quy về đơn vị gốc.
 * Dùng bởi deductForSession.
 */
export interface IngredientDeductSpec {
  /** Mã nguyên liệu (slug). */
  ingredientId: string;
  /** Lượng cần trừ tính theo đơn vị gốc của nguyên liệu đó. */
  amountInBaseUnit: number;
  /** Đánh dấu "luôn có sẵn" – nếu true thì bỏ qua, không trừ. */
  essential?: boolean;
}

// ==========================================
// LỚP DỊCH VỤ CHÍNH
// ==========================================

/**
 * PantryService – Dịch vụ quản lý kho nguyên liệu.
 *
 * Làm gì: Cung cấp các hàm thêm lô, sửa lượng, trừ kho sau nấu, và hoàn tác phiên.
 * Vào: SqlDriver đã được khởi tạo và chạy migration.
 * Ra: Trạng thái kho sau mỗi thao tác, hoặc ném lỗi nghiệp vụ khi vi phạm quy tắc.
 * Gọi bởi: Màn hình Hoàn tất (T13), Màn hình Kho (T13), test T10.
 */
export class PantryService {
  constructor(private readonly db: SqlDriver) {}

  // ─────────────────────────────────────────
  // HÀM THÊM LÔ NGUYÊN LIỆU
  // ─────────────────────────────────────────

  /**
   * Thêm một lô nguyên liệu mới vào kho.
   *
   * Làm gì: Chèn một bản ghi mới vào pantry_item với nguồn mặc định là 'manual'.
   * Vào: params – thông tin lô hàng (ingredientId, quantity, baseUnit, storageLocation, expiryDate, openedAt).
   * Ra: id của lô vừa thêm (chuỗi UUID ngẫu nhiên).
   * Ví dụ: add({ingredientId: "trung", quantity: 6, baseUnit: "cái", storageLocation: "ngăn mát"}) → "uuid-xxx".
   * Gọi bởi: Màn hình Kho (T13), QuickAddScreen (T11).
   */
  async add(params: AddPantryItemParams): Promise<string> {
    const id = params.id ?? generateId();
    const now = new Date().toISOString();

    await this.db.execute(
      `INSERT INTO pantry_item
         (id, ingredient_id, quantity, base_unit, storage_location, added_at, opened_at, expiry_date, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.ingredientId,
        params.quantity,
        params.baseUnit,
        params.storageLocation,
        now,
        params.openedAt ?? null,
        params.expiryDate ?? null,
        params.source ?? SOURCE_MANUAL,
      ],
    );

    return id;
  }

  // ─────────────────────────────────────────
  // HÀM SỬA LƯỢNG MỘT LÔ
  // ─────────────────────────────────────────

  /**
   * Sửa lượng nguyên liệu của một lô đã có trong kho.
   *
   * Làm gì: Cập nhật trực tiếp cột quantity của pantry_item theo id cho trước.
   *         Ghi một sự kiện pantry_event với reason='adjust' để đối soát lịch sử.
   * Vào:
   *   - itemId: id của lô cần sửa.
   *   - newQuantity: lượng mới (đơn vị gốc, không âm).
   * Ra: void (ném lỗi nếu itemId không tồn tại hoặc newQuantity âm).
   * Ví dụ: adjust("item-1", 500) → cập nhật item-1 thành 500 g.
   * Gọi bởi: Màn hình Hoàn tất (cho phép sửa nhanh sau khi trừ kho), Màn hình Kho.
   */
  async adjust(itemId: string, newQuantity: number): Promise<void> {
    // Không cho phép lượng âm – vi phạm ràng buộc nghiệp vụ
    if (newQuantity < 0) {
      throw new Error(`Lượng mới phải không âm, nhận được: ${newQuantity}`);
    }

    // Lấy lô hiện tại để tính delta ghi sự kiện
    const existing = await this.db.queryOne<PantryItemRow>(
      'SELECT * FROM pantry_item WHERE id = ?',
      [itemId],
    );
    if (!existing) {
      throw new Error(`Không tìm thấy lô kho id="${itemId}"`);
    }

    const delta = roundTo3(newQuantity - existing.quantity);

    await this.db.transaction(async (tx) => {
      // Cập nhật lượng lô
      await tx.execute('UPDATE pantry_item SET quantity = ? WHERE id = ?', [
        roundTo3(newQuantity),
        itemId,
      ]);

      // Ghi sự kiện điều chỉnh để đối soát lịch sử
      await tx.execute(
        `INSERT INTO pantry_event (id, pantry_item_id, delta, reason, cook_session_id, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [generateId(), itemId, delta, REASON_ADJUST, new Date().toISOString()],
      );
    });
  }

  // ─────────────────────────────────────────
  // HÀM TRỪ KHO SAU KHI NẤU
  // ─────────────────────────────────────────

  /**
   * Trừ kho nguyên liệu cho một phiên nấu đã hoàn tất.
   *
   * Làm gì: Duyệt từng nguyên liệu trong danh sách specs, tìm tất cả lô có sẵn,
   *         ưu tiên lô hết hạn gần nhất, trừ lần lượt cho đến khi đủ lượng hoặc hết kho.
   *         Không để số âm: thiếu thì trừ về 0 và ghi phần thiếu.
   *         Mỗi lô bị trừ ghi một sự kiện (reason: cook).
   *         Làm tròn 3 chữ số thập phân.
   * Vào:
   *   - sessionId: id phiên nấu (ghi vào pantry_event.cook_session_id).
   *   - specs: danh sách nguyên liệu cần trừ (đã quy về đơn vị gốc).
   * Ra: DeductForSessionResult (danh sách kết quả từng nguyên liệu và bản đồ thiếu hụt).
   * Ví dụ: deductForSession("s1", [{ingredientId:"trung", amountInBaseUnit:3}])
   *        → trừ 3 trứng từ lô tìm được, trả về {ingredients:[...], shortages:{}}.
   * Gọi bởi: FinishScreen (T13).
   *
   * Bám theo: docs/expected/T10.md quy tắc trừ kho (7 bước):
   *   Bước 1: Bỏ nguyên liệu essential (luôn có sẵn).
   *   Bước 2: Tìm tất cả lô của nguyên liệu, sắp xếp theo hạn gần nhất.
   *   Bước 3: Trừ lần lượt từng lô.
   *   Bước 4: Không để âm – nếu thiếu, trừ về 0 và ghi shortage.
   *   Bước 5: Ghi sự kiện pantry_event cho mỗi lô bị trừ.
   *   Bước 6: Cập nhật pantry_item.quantity.
   *   Bước 7: Làm tròn 3 chữ số thập phân.
   */
  async deductForSession(
    sessionId: string,
    specs: IngredientDeductSpec[],
  ): Promise<DeductForSessionResult> {
    const results: DeductIngredientResult[] = [];
    const shortages: Record<string, number> = {};
    const createdAt = new Date().toISOString();

    await this.db.transaction(async (tx) => {
      for (const spec of specs) {
        // Bước 1: Bỏ qua nguyên liệu khai "luôn có sẵn" – không trừ kho
        if (spec.essential) {
          continue;
        }

        // Bước 2: Tìm tất cả lô của nguyên liệu, sắp xếp theo hạn sớm nhất trước,
        //         lô không hạn dùng xếp cuối cùng (NULL cuối theo NULLS LAST).
        const lots = await tx.query<PantryItemRow>(
          `SELECT * FROM pantry_item
           WHERE ingredient_id = ? AND quantity > 0
           ORDER BY
             CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END ASC,
             expiry_date ASC`,
          [spec.ingredientId],
        );

        // Bước 3 & 4: Trừ lần lượt từng lô cho đến khi đủ lượng hoặc hết lô
        let remaining = roundTo3(spec.amountInBaseUnit); // lượng còn phải trừ
        const events: Array<{ pantryItemId: string; delta: number }> = [];
        let totalDeducted = 0;

        for (const lot of lots) {
          // Nếu đã trừ đủ lượng cần thì dừng vòng lặp lô
          if (remaining <= 0) break;

          // Tính lượng thực sự trừ từ lô này (không để âm)
          const fromThisLot = Math.min(remaining, lot.quantity);
          const actualDeduct = roundTo3(fromThisLot);

          // Cập nhật lượng mới của lô
          const newQty = roundTo3(lot.quantity - actualDeduct);

          // Bước 6: Cập nhật pantry_item.quantity
          await tx.execute('UPDATE pantry_item SET quantity = ? WHERE id = ?', [
            newQty,
            lot.id,
          ]);

          // Bước 5: Ghi sự kiện trừ kho cho lô này
          await tx.execute(
            `INSERT INTO pantry_event (id, pantry_item_id, delta, reason, cook_session_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [generateId(), lot.id, -actualDeduct, REASON_COOK, sessionId, createdAt],
          );

          events.push({ pantryItemId: lot.id, delta: -actualDeduct });
          remaining = roundTo3(remaining - actualDeduct);
          totalDeducted = roundTo3(totalDeducted + actualDeduct);
        }

        // Bước 4: Ghi phần thiếu nếu kho không đủ
        const shortage = roundTo3(remaining);
        if (shortage > 0) {
          shortages[spec.ingredientId] = shortage;
        }

        results.push({
          ingredientId: spec.ingredientId,
          deducted: totalDeducted,
          shortage,
          events,
        });
      }
    });

    return { ingredients: results, shortages };
  }

  // ─────────────────────────────────────────
  // HÀM HOÀN TÁC PHIÊN NẤU
  // ─────────────────────────────────────────

  /**
   * Hoàn tác toàn bộ thao tác trừ kho của một phiên nấu.
   *
   * Làm gì: Tìm tất cả sự kiện pantry_event có cook_session_id = sessionId và reason='cook',
   *         đảo ngược delta (cộng lại lượng đã trừ), ghi sự kiện đảo ngược với reason='adjust'.
   *         Hoàn tác lần hai ném lỗi ALREADY_UNDONE.
   * Vào: sessionId – id phiên nấu cần hoàn tác.
   * Ra: void (ném lỗi 'ALREADY_UNDONE' nếu phiên đã hoàn tác trước đó).
   * Ví dụ: undoSession("s1") → cộng lại toàn bộ lượng đã trừ; undoSession("s1") lần hai → ném ALREADY_UNDONE.
   * Gọi bởi: Màn hình Hoàn tất (T13) – nút "Hoàn tác".
   *
   * Bám theo: docs/expected/T10.md ca P9, docs/plan.md pantry_event reason='adjust'.
   */
  async undoSession(sessionId: string): Promise<void> {
    // Kiểm tra xem phiên đã được hoàn tác trước đó chưa bằng cách tìm sự kiện đảo ngược
    // (sự kiện adjust được tạo bởi undoSession sẽ có cook_session_id = sessionId và reason = 'adjust')
    const alreadyUndone = await this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM pantry_event
       WHERE cook_session_id = ? AND reason = ?`,
      [sessionId, REASON_ADJUST],
    );

    // Nếu đã có sự kiện adjust cho phiên này thì báo lỗi ALREADY_UNDONE
    if (alreadyUndone && alreadyUndone.cnt > 0) {
      throw new Error('ALREADY_UNDONE');
    }

    // Tìm tất cả sự kiện trừ kho (reason='cook') của phiên này
    const cookEvents = await this.db.query<PantryEventRow>(
      `SELECT * FROM pantry_event
       WHERE cook_session_id = ? AND reason = ?
       ORDER BY created_at ASC`,
      [sessionId, REASON_COOK],
    );

    // Nếu không có sự kiện nào để hoàn tác thì thoát sớm (phiên chưa trừ kho)
    if (cookEvents.length === 0) {
      return;
    }

    const createdAt = new Date().toISOString();

    await this.db.transaction(async (tx) => {
      for (const evt of cookEvents) {
        // Lượng cần hoàn lại = đảo dấu delta gốc (delta gốc là âm khi trừ kho)
        const restoreAmount = roundTo3(-evt.delta);

        // Lấy lô hiện tại
        const lot = await tx.queryOne<PantryItemRow>(
          'SELECT * FROM pantry_item WHERE id = ?',
          [evt.pantry_item_id],
        );
        if (!lot) continue; // Lô đã bị xóa – bỏ qua

        // Cộng lại lượng vào lô
        const newQty = roundTo3(lot.quantity + restoreAmount);
        await tx.execute('UPDATE pantry_item SET quantity = ? WHERE id = ?', [
          newQty,
          lot.id,
        ]);

        // Ghi sự kiện hoàn tác với reason='adjust'
        await tx.execute(
          `INSERT INTO pantry_event (id, pantry_item_id, delta, reason, cook_session_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [generateId(), lot.id, restoreAmount, REASON_ADJUST, sessionId, createdAt],
        );
      }
    });
  }

  // ─────────────────────────────────────────
  // HÀM TRUY VẤN HỖ TRỢ
  // ─────────────────────────────────────────

  /**
   * Lấy tổng lượng hiện có trong kho theo mã nguyên liệu (gộp tất cả lô).
   *
   * Làm gì: Tính tổng quantity của tất cả pantry_item có ingredient_id khớp.
   * Vào: ingredientId – mã nguyên liệu cần tra.
   * Ra: Tổng lượng (đơn vị gốc), 0 nếu không có lô nào.
   * Ví dụ: getTotalQuantity("trung") → 6 (nếu kho có 6 quả trứng).
   * Gọi bởi: SuggestService (T12), test T10.
   */
  async getTotalQuantity(ingredientId: string): Promise<number> {
    const row = await this.db.queryOne<{ total: number | null }>(
      'SELECT SUM(quantity) as total FROM pantry_item WHERE ingredient_id = ?',
      [ingredientId],
    );
    return roundTo3(row?.total ?? 0);
  }

  /**
   * Lấy danh sách tất cả lô của một nguyên liệu, sắp xếp theo hạn gần nhất trước.
   *
   * Làm gì: Truy vấn pantry_item theo ingredient_id, sắp theo expiry_date (NULL cuối).
   * Vào: ingredientId – mã nguyên liệu.
   * Ra: Mảng các lô (PantryItemRow[]).
   * Ví dụ: getLotsByIngredient("ca-chua") → [{id:"L1", quantity:150, expiry_date:"2026-11-02"}, ...].
   * Gọi bởi: SuggestService (kiểm tra cấp bách), test T10.
   */
  async getLotsByIngredient(ingredientId: string): Promise<PantryItemRow[]> {
    return this.db.query<PantryItemRow>(
      `SELECT * FROM pantry_item
       WHERE ingredient_id = ?
       ORDER BY
         CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END ASC,
         expiry_date ASC`,
      [ingredientId],
    );
  }

  /**
   * Lấy toàn bộ trạng thái kho hiện tại (tất cả lô, tất cả nguyên liệu).
   *
   * Làm gì: Truy vấn toàn bộ pantry_item, nhóm theo ingredient_id.
   * Vào: Không có.
   * Ra: Record<ingredientId, totalQuantity> – bản đồ tổng lượng theo nguyên liệu.
   * Ví dụ: getSnapshot() → {"trung": 6, "ca-chua": 500, ...}.
   * Gọi bởi: Test T10 (so sánh trạng thái kho trước/sau).
   */
  async getSnapshot(): Promise<Record<string, number>> {
    const rows = await this.db.query<{ ingredient_id: string; total: number }>(
      `SELECT ingredient_id, SUM(quantity) as total
       FROM pantry_item
       GROUP BY ingredient_id`,
    );
    const snapshot: Record<string, number> = {};
    for (const row of rows) {
      snapshot[row.ingredient_id] = roundTo3(row.total);
    }
    return snapshot;
  }
}

// ==========================================
// HÀM TIỆN ÍCH NỘI BỘ
// ==========================================

/**
 * Tạo ID ngẫu nhiên dạng chuỗi (đủ ngẫu nhiên cho dùng trong test và production).
 *
 * Làm gì: Sinh chuỗi hex ngẫu nhiên 16 byte dùng cho id bảng SQLite.
 * Vào: Không có.
 * Ra: Chuỗi hex 32 ký tự.
 * Gọi bởi: add, adjust, deductForSession, undoSession.
 */
function generateId(): string {
  // Dùng crypto.getRandomValues khi chạy trên Expo, Math.random() là dự phòng
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback cho môi trường không có Web Crypto API
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/**
 * Làm tròn số đến 3 chữ số thập phân bằng phép nhân-chia nguyên.
 *
 * Làm gì: Tránh lỗi dấu phẩy động (floating point) như 0.1 * 3 = 0.30000000000000004.
 * Vào: value – số thực cần làm tròn.
 * Ra: Số thực đã làm tròn 3 chữ số thập phân.
 * Ví dụ: roundTo3(0.30000000000000004) → 0.3.
 * Gọi bởi: deductForSession, undoSession, getTotalQuantity, getSnapshot.
 */
export function roundTo3(value: number): number {
  // Nhân 1000, làm tròn số nguyên, rồi chia lại để tránh lỗi nhị phân
  return Math.round(value * 1000) / 1000;
}

/**
 * Tính lượng cần trừ kho từ công thức, quy về đơn vị gốc của nguyên liệu.
 *
 * Làm gì: Lượng trừ = lượng gốc × (số phần nấu / số phần gốc), quy về đơn vị gốc.
 * Vào:
 *   - qtyInRecipe: lượng theo công thức (ví dụ 3 quả trứng).
 *   - unit: đơn vị trong công thức (ví dụ "quả").
 *   - baseUnit: đơn vị gốc của nguyên liệu ("cái").
 *   - conversions: bảng quy đổi của nguyên liệu.
 *   - servings: số phần thực nấu.
 *   - servingsBase: số phần gốc trong công thức.
 * Ra: Lượng cần trừ (đơn vị gốc, đã làm tròn 3 chữ số).
 * Ví dụ: calcDeductAmount(3, "quả", "cái", {quả:1}, 4, 2) → 6 (cái).
 * Gọi bởi: Màn hình Hoàn tất (T13) trước khi gọi deductForSession.
 */
export function calcDeductAmount(
  qtyInRecipe: number,
  unit: string,
  baseUnit: 'g' | 'ml' | 'cái',
  conversions: Record<string, number> | null | undefined,
  servings: number,
  servingsBase: number,
): number {
  // Quy đổi lượng gốc sang đơn vị gốc trước khi nhân hệ số phần
  const baseAmount = convertToBaseUnit(qtyInRecipe, unit, baseUnit, conversions);
  // Nhân hệ số phần (số phần nấu / số phần gốc)
  const scaled = baseAmount * (servings / servingsBase);
  return roundTo3(scaled);
}

/**
 * Tham số cho hàm buildDeductSpecs.
 */
export interface BuildDeductSpecsParams {
  /** Thông tin công thức món ăn (số phần gốc và danh sách nguyên liệu). */
  recipe: {
    servings_base: number;
    ingredients: Array<{
      i: string;
      qty: number;
      unit: string;
      optional?: boolean;
    }>;
  };
  /** Số phần thực tế người dùng nấu. */
  servings: number;
  /** Danh sách mã nguyên liệu người dùng bỏ qua (không dùng, không trừ). */
  omit?: string[];
  /** Danh sách nguyên liệu thay thế: ingredientId gốc -> { ingredientId thay thế: lượng (đơn vị gốc) }. */
  substitute?: Record<string, Record<string, number>>;
  /** Danh sách nguyên liệu thiết yếu ("luôn có sẵn") -> đánh dấu essential để không trừ kho. */
  essential?: string[];
  /** Bản đồ quy đổi đơn vị của các nguyên liệu liên quan. */
  conversionsMap: Record<
    string,
    { baseUnit: 'g' | 'ml' | 'cái'; conversions?: Record<string, number> }
  >;
}

/**
 * Xây dựng danh sách IngredientDeductSpec từ công thức món ăn và lựa chọn tùy biến của người dùng.
 *
 * Làm gì:
 *   - Bỏ qua nguyên liệu trong danh sách omit.
 *   - Nếu nguyên liệu được thay thế (substitute), thêm spec trừ nguyên liệu thay thế với lượng xác nhận.
 *   - Ngược lại, tính lượng trừ theo tỉ lệ servings / servings_base quy về baseUnit.
 *   - Đánh dấu essential = true nếu nguyên liệu nằm trong danh sách essential ("luôn có sẵn").
 *
 * Vào: params (BuildDeductSpecsParams).
 * Ra: Mảng IngredientDeductSpec[] sẵn sàng nạp vào deductForSession.
 * Gọi bởi: FinishScreen (T13), test T10.
 */
export function buildDeductSpecs(params: BuildDeductSpecsParams): IngredientDeductSpec[] {
  const { recipe, servings, omit = [], substitute = {}, essential = [], conversionsMap } = params;
  const specs: IngredientDeductSpec[] = [];

  for (const ing of recipe.ingredients) {
    // 1. Nếu người dùng chọn bỏ nguyên liệu (omit) -> không trừ kho
    if (omit.includes(ing.i)) {
      continue;
    }

    // 2. Nếu người dùng thay thế nguyên liệu
    if (substitute[ing.i]) {
      const subs = substitute[ing.i]!;
      for (const [subIngId, subAmount] of Object.entries(subs)) {
        specs.push({
          ingredientId: subIngId,
          amountInBaseUnit: roundTo3(subAmount),
          essential: essential.includes(subIngId),
        });
      }
      continue;
    }

    // 3. Nguyên liệu bình thường: quy về baseUnit và nhân tỉ lệ phần
    const convInfo = conversionsMap[ing.i];
    if (!convInfo) {
      throw new Error(`Thiếu cấu hình quy đổi đơn vị cho nguyên liệu: ${ing.i}`);
    }

    const amountInBaseUnit = calcDeductAmount(
      ing.qty,
      ing.unit,
      convInfo.baseUnit,
      convInfo.conversions,
      servings,
      recipe.servings_base,
    );

    specs.push({
      ingredientId: ing.i,
      amountInBaseUnit,
      essential: essential.includes(ing.i),
    });
  }

  return specs;
}

