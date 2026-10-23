/**
 * File: packages/core/src/schemas/equipment.ts
 * Module: @cook/core
 *
 * Định nghĩa Zod Schema và kiểu dữ liệu cho thực thể Equipment (Dụng cụ nấu ăn).
 * Bám theo: docs/field-names.md mục 12, đã được chủ dự án chính thức phê duyệt.
 */

import { z } from 'zod';

/**
 * Schema xác thực thực thể dụng cụ nấu ăn (Equipment).
 * Gồm các trường: id, name, source, confirmed_by, missing_fields.
 */
export const EquipmentSchema = z.object({
  id: z.string().min(1, 'Mã dụng cụ không được để trống'),
  name: z.string().min(1, 'Tên dụng cụ không được để trống'),
  source: z.string().optional(),
  confirmed_by: z.string().optional(),
  missing_fields: z.array(z.string()).default([]),
});

export type Equipment = z.infer<typeof EquipmentSchema>;
