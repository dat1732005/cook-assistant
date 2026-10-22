/**
 * File: packages/core/src/schemas/recipe.ts
 * Làm gì: Định nghĩa schema Zod và kiểu TypeScript cho công thức nấu ăn chuẩn xác theo docs/plan.md (Recipe, RecipeIngredient, RecipeStep).
 * Nhận vào: Dữ liệu công thức JSON dạng snake_case từ data/recipes/*.json hoặc cơ sở dữ liệu.
 * Trả ra: Đối tượng Recipe chuẩn hóa đã kiểm định cấu trúc, khóa snake_case và tính toàn vẹn (DAG phụ thuộc, dụng cụ).
 * Ai gọi: validate-data (T03), Scheduler (T04), SQLite Repo (T05), Chi tiết món (T06), bộ test.
 * Bám theo: Mục Mô hình dữ liệu, Schema chi tiết (dòng 228-230) và Định dạng công thức có cấu trúc (dòng 259-300) trong docs/plan.md.
 */

import { z } from 'zod';
import {
  IngredientRoleEnum,
  RecipeStatusEnum,
  StepTypeEnum,
  TasteGroupEnum,
} from '../enums.js';

/**
 * Schema nguyên liệu thành phần trong công thức nấu ăn (docs/plan.md dòng 229, 265-272).
 * Tên các trường ở dạng snake_case đúng với JSON công thức và DB schema.
 */
export const RecipeIngredientSchema = z.object({
  // Mã/slug nguyên liệu chuẩn (khớp khóa "ingredient" trong JSON mẫu và ingredient_id trong bảng DB)
  ingredient: z.string().min(1, 'Mã nguyên liệu không được để trống'),
  // Số lượng nguyên liệu theo số phần gốc (tùy chọn nếu đã có ghi chú lượng như "vừa ăn")
  qty: z.number().positive('Số lượng nguyên liệu phải lớn hơn 0').optional(),
  // Đơn vị đo lường sử dụng trong công thức (ví dụ: "quả", "thìa cà phê", "thìa canh", "nhánh")
  unit: z.string().min(1, 'Đơn vị nguyên liệu không được để trống'),
  // Vai trò cấu trúc / chức năng của nguyên liệu: flavor, structure, moisture, preservation, color
  role: IngredientRoleEnum,
  // Nhóm vị chủ đạo đóng góp vào món: salt, sugar, acid, fat, spice, none (mặc định 'none')
  flavor_group: TasteGroupEnum.default('none'),
  // Đánh dấu nguyên liệu này có thể bỏ qua được không (mặc định false)
  optional: z.boolean().default(false),
  // Ghi chú lượng cho các trường hợp ước chừng không ép thành số (ví dụ: "vừa ăn", "một ít")
  amount_note: z.string().optional(),
  // Phân nhóm nguyên liệu trong công thức (ví dụ: "nước ướp", "nước sốt", "rau xào")
  group: z.string().optional(),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

/**
 * Schema một bước thực hiện trong công thức (docs/plan.md dòng 230, 274-280).
 * Tên các trường ở dạng snake_case đúng với JSON công thức và DB schema.
 */
export const RecipeStepSchema = z.object({
  // Mã định danh của bước (duy nhất trong công thức, ví dụ: "s1", "s2")
  id: z.string().min(1, 'Mã bước không được để trống'),
  // Tiêu đề ngắn gọn của bước (ví dụ: "Cắt cà chua", "Đánh trứng")
  title: z.string().optional(),
  // Loại bước: "active" (cần người làm tay) hoặc "passive" (bước tự chạy như luộc, ninh, để nguội)
  kind: StepTypeEnum,
  // Thời lượng thực hiện tính bằng giây (phải lớn hơn 0)
  seconds: z.number().int().positive('Thời lượng bước phải lớn hơn 0 giây'),
  // Danh sách mã id của các bước phải hoàn thành trước bước này
  after: z.array(z.string().min(1)).default([]),
  // Danh sách dụng cụ bị chiếm dụng trong suốt bước này (mỗi dụng cụ chỉ phục vụ một bước tại một thời điểm)
  resources: z.array(z.string().min(1)).default([]),
  // Dấu hiệu nhận biết cảm quan cho người mới thay vì chỉ nhìn đồng hồ (ví dụ: "Mặt dưới vàng nhẹ thì lật")
  cue: z.string().optional(),
  // Nội dung hướng dẫn thao tác chi tiết cho bước
  text: z.string().min(1, 'Nội dung hướng dẫn bước không được để trống'),
  // Nhiệt độ mục tiêu cần đạt ở bước này (ví dụ: 75 độ C cho phần lõi thịt)
  target_temperature: z.number().optional(),
  // Mã quy tắc an toàn gắn với bước (bắt xác nhận trước khi qua bước tiếp theo nếu có)
  safety_rule: z.string().optional(),
  // Thứ tự hiển thị thông thường (tùy chọn vì thứ tự được suy ra từ vị trí mảng JSON)
  order: z.number().int().positive('Thứ tự bước phải là số nguyên dương').optional(),
});

export type RecipeStep = z.infer<typeof RecipeStepSchema>;

/**
 * Phát hiện vòng lặp phụ thuộc (chu trình) giữa các bước nấu ăn.
 *
 * Làm gì: Duyệt đồ thị có hướng biểu diễn các bước bằng thuật toán DFS kiểm tra chu trình.
 * Vào: steps (mảng RecipeStep).
 * Ra: boolean (true nếu có chu trình phụ thuộc, false nếu đồ thị là DAG hợp lệ).
 * Ví dụ: s1 phụ thuộc s2, s2 phụ thuộc s1 -> trả về true.
 * Gọi bởi: RecipeSchema.superRefine khi kiểm tra tính toàn vẹn công thức.
 */
function hasCyclicDependency(steps: RecipeStep[]): boolean {
  // Xây dựng danh sách kề phụ thuộc: u phụ thuộc vào v (v phải hoàn thành trước u)
  const adj = new Map<string, string[]>();
  for (const step of steps) {
    adj.set(step.id, step.after);
  }

  // Trạng thái duyệt đỉnh: 0 = chưa thăm, 1 = đang trong nhánh đệ quy hiện tại, 2 = đã hoàn thành
  const visited = new Map<string, number>();
  for (const step of steps) {
    visited.set(step.id, 0);
  }

  function dfs(nodeId: string): boolean {
    visited.set(nodeId, 1);
    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const state = visited.get(neighbor);
      // Nếu gặp lại đỉnh đang nằm trong nhánh đệ quy hiện tại -> có chu trình
      if (state === 1) {
        return true;
      }
      // Nếu đỉnh chưa thăm và nhánh con có chu trình -> trả về true
      if (state === 0 && dfs(neighbor)) {
        return true;
      }
    }
    visited.set(nodeId, 2);
    return false;
  }

  for (const step of steps) {
    if (visited.get(step.id) === 0) {
      if (dfs(step.id)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Schema công thức nấu ăn hoàn chỉnh theo đúng docs/plan.md (dòng 228, 259-300).
 * Sử dụng đúng tên khóa snake_case của JSON kế hoạch, không dùng alias camelCase.
 */
export const RecipeSchema = z
  .object({
    // Khóa định danh slug duy nhất của công thức (ví dụ: "trung-chien-ca-chua")
    slug: z.string().min(1, 'Slug công thức không được để trống'),
    // Tên món ăn tiếng Việt (tương ứng cột "tên" trong bảng DB và "name" trong JSON kế hoạch)
    name: z.string().min(1, 'Tên món ăn không được để trống'),
    // Số phần ăn cơ sở (khớp "servings_base" trong JSON kế hoạch và "số phần gốc" trong DB)
    servings_base: z
      .number()
      .int()
      .positive('Số phần ăn cơ sở phải là số nguyên dương (ít nhất 1)'),
    // Độ khó của món ăn: 1 (dễ), 2 (vừa), 3 (khó) theo bảng schema dòng 228
    difficulty: z
      .number()
      .int()
      .min(1, 'Độ khó tối thiểu là 1')
      .max(3, 'Độ khó tối đa là 3')
      .optional(),
    // Danh sách dụng cụ yêu cầu cho cả món ăn
    equipment: z.array(z.string().min(1)).default([]),
    // Danh sách nguyên liệu thành phần (phải có ít nhất 1 nguyên liệu)
    ingredients: z
      .array(RecipeIngredientSchema)
      .min(1, 'Công thức phải có ít nhất một nguyên liệu'),
    // Danh sách các bước nấu ăn (phải có ít nhất 1 bước)
    steps: z
      .array(RecipeStepSchema)
      .min(1, 'Công thức phải có ít nhất một bước nấu'),
    // Mã định danh cơ sở dữ liệu (tùy chọn trong JSON đóng gói app, slug đóng vai trò khóa)
    id: z.string().optional(),
    // Tổng số phút hoàn thành món ăn (docs/plan.md dòng 228)
    total_minutes: z.number().int().positive('Tổng số phút phải lớn hơn 0').optional(),
    // Thẻ phân loại món ăn (ví dụ: kho, xào, canh, cay...) dùng cho gợi ý và khẩu vị
    tags: z.array(z.string().min(1)).default([]),
    // Trạng thái kiểm duyệt: draft, reviewed, published (mặc định là 'draft')
    status: RecipeStatusEnum.default('draft'),
    // Người kiểm duyệt (bắt buộc khi trạng thái là reviewed hoặc published)
    reviewer: z.string().nullable().optional(),
    // Ngày kiểm duyệt định dạng ISO (bắt buộc khi trạng thái là reviewed hoặc published)
    reviewed_at: z.string().nullable().optional(),
    // Phiên bản công thức (tăng khi cập nhật nội dung)
    version: z
      .number()
      .int()
      .positive('Phiên bản công thức phải lớn hơn hoặc bằng 1')
      .default(1),
    // Mô tả ngắn về món ăn (tùy chọn)
    description: z.string().optional(),
    // Nguồn dữ liệu công thức (bắt buộc theo R3 khi status là reviewed hoặc published)
    source: z.string().optional(),
    // Người xác nhận dữ liệu (bắt buộc theo R3 khi status là reviewed hoặc published)
    confirmed_by: z.string().optional(),
    // Danh sách các trường còn thiếu đang chờ dữ liệu theo R2 (mặc định [])
    missing_fields: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    // Quy tắc kiểm tra 1: Bắt buộc phải có ít nhất một bước active (docs/plan.md dòng 298)
    const hasActiveStep = data.steps.some((step) => step.kind === 'active');
    if (!hasActiveStep) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['steps'],
        message: 'Công thức bắt buộc phải có ít nhất một bước chủ động (kind === "active")',
      });
    }

    // Quy tắc kiểm tra 2: Mọi dụng cụ trong resources của các bước phải có trong equipment (docs/plan.md dòng 297)
    const equipmentSet = new Set(data.equipment);
    data.steps.forEach((step, stepIndex) => {
      for (const res of step.resources) {
        if (!equipmentSet.has(res)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', stepIndex, 'resources'],
            message: `Dụng cụ "${res}" dùng trong bước ${step.id} không được khai báo trong danh sách equipment của món`,
          });
        }
      }
    });

    // Quy tắc kiểm tra 3: Mọi id trong after đều phải tồn tại trong danh sách bước (docs/plan.md dòng 295)
    const stepIdSet = new Set(data.steps.map((s) => s.id));
    data.steps.forEach((step, stepIndex) => {
      for (const depId of step.after) {
        if (!stepIdSet.has(depId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['steps', stepIndex, 'after'],
            message: `Bước phụ thuộc "${depId}" trong bước ${step.id} không tồn tại trong công thức`,
          });
        }
      }
    });

    // Quy tắc kiểm tra 4: Không có vòng phụ thuộc giữa các bước (docs/plan.md dòng 295)
    if (hasCyclicDependency(data.steps)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['steps'],
        message: 'Phát hiện vòng lặp phụ thuộc (chu trình) giữa các bước nấu ăn',
      });
    }

    // Quy tắc kiểm tra 5: Trạng thái reviewed hoặc published bắt buộc có người, ngày kiểm duyệt, nguồn, người xác nhận và missing_fields rỗng (docs/plan.md dòng 299, R2, R3)
    if (data.status === 'reviewed' || data.status === 'published') {
      if (!data.reviewer || data.reviewer.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reviewer'],
          message:
            'Món ăn ở trạng thái reviewed hoặc published bắt buộc phải có thông tin người kiểm duyệt (reviewer)',
        });
      }
      if (!data.reviewed_at || data.reviewed_at.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reviewed_at'],
          message:
            'Món ăn ở trạng thái reviewed hoặc published bắt buộc phải có ngày kiểm duyệt (reviewed_at)',
        });
      }
      if (!data.source || data.source.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['source'],
          message:
            'Món ăn ở trạng thái reviewed hoặc published bắt buộc phải có nguồn dữ liệu (source) theo R3',
        });
      }
      if (!data.confirmed_by || data.confirmed_by.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmed_by'],
          message:
            'Món ăn ở trạng thái reviewed hoặc published bắt buộc phải có người xác nhận (confirmed_by) theo R3',
        });
      }
      if (data.missing_fields && data.missing_fields.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['missing_fields'],
          message:
            'Món ăn ở trạng thái reviewed hoặc published không được còn trường thiếu (missing_fields phải rỗng) theo R2',
        });
      }
    }

    // Quy tắc kiểm tra 6: Mỗi nguyên liệu phải có số lượng qty hoặc ghi chú lượng amount_note (docs/plan.md dòng 289)
    data.ingredients.forEach((ing, i) => {
      if (ing.qty === undefined && (!ing.amount_note || ing.amount_note.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ingredients', i, 'qty'],
          message: `Nguyên liệu "${ing.ingredient}" phải có số lượng cụ thể (qty) hoặc ghi chú lượng (amount_note)`,
        });
      }
    });
  });

export type Recipe = z.infer<typeof RecipeSchema>;
