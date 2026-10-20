/**
 * File: packages/core/src/schemas/recipe.ts
 * Mục đích: Định nghĩa schema Zod và kiểu dữ liệu cho công thức món ăn (Recipe, RecipeIngredient, RecipeStep).
 * Nhận vào: Dữ liệu công thức JSON từ data/recipes/*.json hoặc database.
 * Trả ra: Đối tượng Recipe chuẩn hóa đã kiểm tra đầy đủ cấu trúc và tính hợp lệ.
 * Ai gọi: Scheduler (T04), SQLite Repo (T05), Chi tiết món (T06), validate-data (T03).
 * Bám theo: Mục T02.1, T02.2 và T03.4 trong docs/tasks.md.
 */

import { z } from 'zod';
import {
  IngredientRoleEnum,
  RecipeStatusEnum,
  StepTypeEnum,
  TasteGroupEnum,
} from '../enums.js';

/**
 * Schema nguyên liệu thành phần trong công thức (Mục T02.1, T02.2).
 */
export const RecipeIngredientSchema = z.object({
  // Mã nguyên liệu tham chiếu tới bảng Ingredient (ví dụ: "trung_ga", "ca_chua")
  ingredientId: z.string().min(1, 'Mã nguyên liệu không được để trống'),
  // Số lượng nguyên liệu cho số phần ăn mặc định (servings) của công thức
  amount: z.number().positive('Số lượng nguyên liệu phải lớn hơn 0'),
  // Đơn vị đo lường sử dụng trong công thức (ví dụ: "quả", "g", "thìa cà phê")
  unit: z.string().min(1, 'Đơn vị nguyên liệu không được để trống'),
  // Vai trò cấu trúc / chức năng của nguyên liệu trong món ăn
  role: IngredientRoleEnum,
  // Nhóm vị chủ đạo mà nguyên liệu đóng góp vào món (mặn, ngọt, chua, béo...)
  tasteGroup: TasteGroupEnum.default('none'),
  // Đánh dấu nguyên liệu này có thể bỏ qua được không (ví dụ: hành lá trang trí)
  isOptional: z.boolean().default(false),
  // Danh sách các nguyên liệu thay thế được chấp nhận (nếu có)
  substitutes: z.array(z.string().min(1)).default([]),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

/**
 * Schema một bước thực hiện trong công thức (Mục T02.1, T02.2, T04).
 */
export const RecipeStepSchema = z.object({
  // Mã định danh của bước (duy nhất trong công thức, ví dụ: "step_1", "step_2")
  id: z.string().min(1, 'Mã bước không được để trống'),
  // Thứ tự hiển thị thông thường
  order: z.number().int().positive('Thứ tự bước phải là số nguyên dương'),
  // Tiêu đề ngắn gọn của bước (tùy chọn, ví dụ: "Sơ chế cà chua")
  title: z.string().optional(),
  // Nội dung hướng dẫn thao tác chi tiết
  instruction: z.string().min(1, 'Hướng dẫn nấu không được để trống'),
  // Loại bước: "active" (cần người làm trực tiếp) hoặc "passive" (nấu tự động)
  type: StepTypeEnum,
  // Thời lượng thực hiện tính bằng giây (phải lớn hơn 0)
  duration: z.number().int().positive('Thời lượng bước phải lớn hơn 0 giây'),
  // Danh sách id của các bước phải hoàn thành trước bước này (ràng buộc phụ thuộc)
  after: z.array(z.string().min(1)).default([]),
  // Danh sách mã dụng cụ cần dùng trong suốt bước này (ví dụ: ["chao", "bep"])
  resources: z.array(z.string().min(1)).default([]),
  // Dấu hiệu nhận biết hoàn thành bằng cảm quan (mùi, âm thanh, màu sắc, độ mềm)
  cue: z.string().optional(),
  // Mã quy tắc an toàn cần lưu ý/xác nhận ở bước này (nếu có)
  safetyRuleId: z.string().optional(),
});

export type RecipeStep = z.infer<typeof RecipeStepSchema>;

/**
 * Schema công thức nấu ăn hoàn chỉnh (Mục T02.1, T02.2, T03.4).
 */
export const RecipeSchema = z
  .object({
    // Mã định danh duy nhất của công thức
    id: z.string().min(1, 'Mã công thức không được để trống'),
    // Đường dẫn tĩnh định danh (slug dùng cho URL / tra cứu)
    slug: z.string().min(1, 'Slug công thức không được để trống'),
    // Tên món ăn tiếng Việt
    title: z.string().min(1, 'Tên món ăn không được để trống'),
    // Mô tả ngắn về món ăn
    description: z.string().optional(),
    // Số phần ăn cơ sở mà lượng nguyên liệu được tính toán cho (mặc định thường là 2)
    servings: z.number().int().positive('Số phần ăn phải là số nguyên dương (ít nhất 1)'),
    // Thời gian chuẩn bị dự kiến (tính bằng giây)
    prepTime: z.number().int().nonnegative('Thời gian chuẩn bị không được âm'),
    // Thời gian nấu trên bếp dự kiến (tính bằng giây)
    cookTime: z.number().int().nonnegative('Thời gian nấu không được âm'),
    // Trạng thái kiểm duyệt: draft, reviewed, published
    status: RecipeStatusEnum,
    // Người kiểm duyệt (bắt buộc khi status là reviewed hoặc published)
    reviewedBy: z.string().nullable().optional(),
    // Ngày kiểm duyệt định dạng ISO (bắt buộc khi status là reviewed hoặc published)
    reviewedAt: z.string().nullable().optional(),
    // Danh sách các dụng cụ yêu cầu cho cả món ăn
    equipment: z.array(z.string().min(1)).default([]),
    // Danh sách nguyên liệu cần thiết (phải có ít nhất 1 nguyên liệu)
    ingredients: z
      .array(RecipeIngredientSchema)
      .min(1, 'Công thức phải có ít nhất một nguyên liệu'),
    // Danh sách các bước nấu (phải có ít nhất 1 bước)
    steps: z
      .array(RecipeStepSchema)
      .min(1, 'Công thức phải có ít nhất một bước nấu'),
    // Phiên bản công thức (tăng khi có cập nhật nội dung)
    version: z.number().int().positive('Phiên bản công thức phải lớn hơn hoặc bằng 1').default(1),
    // Nguồn gốc công thức
    source: z.string().optional(),
    // Người xác nhận công thức
    confirmedBy: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Kiểm tra quy tắc 1: Phải có ít nhất một bước active để người nấu thao tác
    const hasActiveStep = data.steps.some((step) => step.type === 'active');
    if (!hasActiveStep) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['steps'],
        message: 'Công thức bắt buộc phải có ít nhất một bước chủ động (active)',
      });
    }

    // Kiểm tra quy tắc 2: Nếu món đã reviewed hoặc published thì bắt buộc có người và ngày kiểm duyệt (T03.4)
    if (data.status === 'reviewed' || data.status === 'published') {
      if (!data.reviewedBy || data.reviewedBy.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reviewedBy'],
          message:
            'Món ăn ở trạng thái reviewed hoặc published bắt buộc phải có thông tin người kiểm duyệt (reviewedBy)',
        });
      }
      if (!data.reviewedAt || data.reviewedAt.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reviewedAt'],
          message:
            'Món ăn ở trạng thái reviewed hoặc published bắt buộc phải có ngày kiểm duyệt (reviewedAt)',
        });
      }
    }
  });

export type Recipe = z.infer<typeof RecipeSchema>;
