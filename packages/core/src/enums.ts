/**
 * File: packages/core/src/enums.ts
 * Mục đích: Định nghĩa các hằng số và kiểu dữ liệu liệt kê (enums) dùng chung trong toàn bộ hệ thống.
 * Nhận vào: Không có (chứa định nghĩa hằng và kiểu).
 * Trả ra: Các enum và mảng giá trị liệt kê chuẩn (AllergenCode, IngredientRole, StepType, v.v.).
 * Ai gọi: Các schema Zod (schemas/*), module tính toán (units, scheduler), và ứng dụng di động.
 * Bám theo: Mục T02.2 và T02.5 trong docs/tasks.md.
 */

import { z } from 'zod';

/**
 * Danh sách vai trò của nguyên liệu trong món ăn (Mục T02.2).
 * - flavor: tạo hương vị chính (muối, đường, tiêu, tỏi...)
 * - structure: tạo cấu trúc/hình khối món (trứng, thịt, đậu hũ...)
 * - moisture: cung cấp chất lỏng/nước sốt (cà chua, nước cốt dừa, nước dùng...)
 * - preservation: bảo quản/hạn chế hỏng (muối đặc, giấm...)
 * - color: tạo màu sắc trang trí (hành lá, ớt tỉa, bột nghệ...)
 */
export const INGREDIENT_ROLES = [
  'flavor',
  'structure',
  'moisture',
  'preservation',
  'color',
] as const;
export const IngredientRoleEnum = z.enum(INGREDIENT_ROLES);
export type IngredientRole = z.infer<typeof IngredientRoleEnum>;

/**
 * Danh sách nhóm vị cơ bản (Mục T02.2).
 * - salt: mặn (muối, nước mắm, hạt nêm...)
 * - sugar: ngọt (đường, mật ong...)
 * - acid: chua (chanh, giấm, me...)
 * - fat: béo ngậy (dầu ăn, bơ, mỡ heo...)
 * - spice: cay/nồng (ớt, tiêu, gừng...)
 * - none: không có vị rõ rệt
 */
export const TASTE_GROUPS = [
  'salt',
  'sugar',
  'acid',
  'fat',
  'spice',
  'none',
] as const;
export const TasteGroupEnum = z.enum(TASTE_GROUPS);
export type TasteGroup = z.infer<typeof TasteGroupEnum>;

/**
 * Loại bước nấu ăn phục vụ xếp lịch đa nhiệm (Mục T02.2).
 * - active: người nấu phải dùng tay thao tác (đập trứng, thái hành, xào...)
 * - passive: bước nấu tự diễn ra (luộc, ninh, ướp, nướng...) người nấu có thể rảnh tay
 */
export const STEP_TYPES = ['active', 'passive'] as const;
export const StepTypeEnum = z.enum(STEP_TYPES);
export type StepType = z.infer<typeof StepTypeEnum>;

/**
 * Trạng thái kiểm duyệt của công thức (Mục T02.2).
 * - draft: bản nháp đang soạn thảo
 * - reviewed: đã được người có chuyên môn nấu ăn thẩm định
 * - published: đã phát hành chính thức cho người dùng
 */
export const RECIPE_STATUSES = ['draft', 'reviewed', 'published'] as const;
export const RecipeStatusEnum = z.enum(RECIPE_STATUSES);
export type RecipeStatus = z.infer<typeof RecipeStatusEnum>;

/**
 * Đơn vị đo lường gốc chuẩn hóa trong kho và tính toán (Mục T02.2).
 * - g: gam (cho chất rắn, bột, thịt, rau)
 * - ml: mililit (cho chất lỏng, dầu ăn, nước mắm)
 * - cái: đơn vị đếm cá thể (trứng, quả chanh, củ hành)
 */
export const BASE_UNITS = ['g', 'ml', 'cái'] as const;
export const BaseUnitEnum = z.enum(BASE_UNITS);
export type BaseUnit = z.infer<typeof BaseUnitEnum>;

/**
 * Lý do thay đổi số lượng trong kho thực phẩm (Mục T02.2).
 * - cook: trừ kho tự động khi nấu ăn
 * - adjust: người dùng tự kiểm kê chỉnh tay
 * - discard: vứt bỏ do hỏng/hết hạn
 * - buy: bổ sung vào kho sau khi mua sắm
 */
export const PANTRY_EVENT_REASONS = [
  'cook',
  'adjust',
  'discard',
  'buy',
] as const;
export const PantryEventReasonEnum = z.enum(PANTRY_EVENT_REASONS);
export type PantryEventReason = z.infer<typeof PantryEventReasonEnum>;

/**
 * 8 mã dị ứng thực phẩm cố định theo kế hoạch và y tế (Mục T02.5).
 * GHI CHÚ BẮT BUỘC THEO KẾ HOẠCH & R1/R6:
 * Danh sách 8 mã dị ứng dưới đây là quy ước tạm thời từ bản kế hoạch ban đầu,
 * chờ đối chiếu và xác nhận chính thức với tài liệu của cơ quan y tế.
 * - peanut: đậu phộng (lạc)
 * - tree_nut: các loại hạt cây (hạt điều, óc chó, hạnh nhân...)
 * - crustacean: động vật giáp xác (tôm, cua...)
 * - fish: cá
 * - egg: trứng (trứng gà, trứng vịt...)
 * - milk: sữa và các chế phẩm từ sữa
 * - soy: đậu nành (đậu tương, đậu phụ...)
 * - wheat: lúa mì (bột mì, bánh mì...)
 */
export const ALLERGEN_CODES = [
  'peanut',
  'tree_nut',
  'crustacean',
  'fish',
  'egg',
  'milk',
  'soy',
  'wheat',
] as const;
export const AllergenCodeEnum = z.enum(ALLERGEN_CODES);
export type AllergenCode = z.infer<typeof AllergenCodeEnum>;

/**
 * Chế độ tối ưu hóa lịch nấu của Scheduler (Mục T04.1).
 * - fastest: ưu tiên tổng thời gian hoàn thành sớm nhất
 * - fewest_tools: ưu tiên tái sử dụng dụng cụ nấu, rửa ít đồ nhất
 */
export const OPTIMIZATION_MODES = ['fastest', 'fewest_tools'] as const;
export const OptimizationModeEnum = z.enum(OPTIMIZATION_MODES);
export type OptimizationMode = z.infer<typeof OptimizationModeEnum>;

/**
 * Trạng thái của một phiên nấu ăn trực tiếp (Mục T07).
 */
export const COOK_SESSION_STATUSES = [
  'preparing',
  'cooking',
  'paused',
  'completed',
  'cancelled',
] as const;
export const CookSessionStatusEnum = z.enum(COOK_SESSION_STATUSES);
export type CookSessionStatus = z.infer<typeof CookSessionStatusEnum>;

/**
 * Phân loại cảnh báo an toàn thực phẩm (Mục T16).
 */
export const SAFETY_CATEGORIES = [
  'temperature',
  'cross_contamination',
  'hygiene',
  'storage',
  'allergy',
] as const;
export const SafetyCategoryEnum = z.enum(SAFETY_CATEGORIES);
export type SafetyCategory = z.infer<typeof SafetyCategoryEnum>;
