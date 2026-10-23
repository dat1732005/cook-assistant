/**
 * File: packages/core/src/schemas/ai-usage-log.ts
 * Module: @cook/core
 *
 * Định nghĩa Zod Schema và kiểu dữ liệu cho thực thể ai_usage_log (Nhật ký sử dụng AI).
 * Bám theo: docs/plan.md:L182 và docs/field-names.md mục 13, đã được chủ dự án phê duyệt.
 */

import { z } from 'zod';

export const AiUsageLogKindEnum = z.enum(['substitute', 'qa', 'scan']);
export type AiUsageLogKind = z.infer<typeof AiUsageLogKindEnum>;

/**
 * Schema xác thực thực thể ai_usage_log.
 * Gồm các trường: id, user_id, kind, tokens_in, tokens_out, cost_micro_usd, created_at.
 * tokens_in, tokens_out, cost_micro_usd cho phép NULL, không default 0; chi phí lưu số nguyên cost_micro_usd.
 */
export const AiUsageLogSchema = z.object({
  id: z.string().min(1, 'Mã nhật ký AI không được để trống'),
  user_id: z.string().min(1, 'Mã người dùng không được để trống'),
  kind: AiUsageLogKindEnum,
  tokens_in: z.number().int().nonnegative().nullable(),
  tokens_out: z.number().int().nonnegative().nullable(),
  cost_micro_usd: z.number().int().nonnegative().nullable(),
  created_at: z.string().min(1, 'Thời điểm tạo không được để trống'),
});

export type AiUsageLog = z.infer<typeof AiUsageLogSchema>;
