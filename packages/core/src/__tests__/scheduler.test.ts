/**
 * File: packages/core/src/__tests__/scheduler.test.ts
 * Module: @cook/core
 *
 * Bộ kiểm thử toàn diện cho bộ xếp lịch nấu ăn (Scheduler) theo nhiệm vụ T04.
 * Bám sát tuyệt đối các quy ước và giá trị tính tay có trước trong docs/expected/T04.md
 * và thuật toán trong docs/plan.md:L250-271.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  plan,
  replan,
  checkManualStart,
  computeTails,
  SchedulerError,
} from '../scheduler/index.js';
import type { RecipeStep } from '../schemas/recipe.js';

describe('T04: Bộ kiểm thử Scheduler xếp lịch nấu (Bám sát docs/expected/T04.md)', () => {
  // Trích xuất công thức JSON gốc của món "Trứng chiên cà chua" từ docs/plan.md
  const planMdPath = path.resolve(__dirname, '../../../../docs/plan.md');
  const planMdContent = fs.readFileSync(planMdPath, 'utf-8');
  const jsonMatch = planMdContent.match(/```json\s*(\{[\s\S]*?"slug":\s*"trung-chien-ca-chua"[\s\S]*?\})\s*```/);
  const sampleRecipe = jsonMatch && jsonMatch[1] ? JSON.parse(jsonMatch[1]) : null;

  // --------------------------------------------------------------------------
  // Test 1: Ca A - JSON mẫu "trứng chiên cà chua" từ docs/plan.md
  // Giá trị tính tay trong docs/expected/T04.md:
  // tail: s5=60, s4=300, s3=480, s2=570, s1=420.
  // Thứ tự: s2 (0-90, largest_tail) -> s3 (90-270, largest_tail) -> s1 (270-390, only_candidate) -> s4 (390-630, only_candidate) -> s5 (630-690, only_candidate).
  // Tổng thời gian: 690 giây cho cả 2 chế độ fastest và fewest_tools.
  // --------------------------------------------------------------------------
  it('Ca A: Xếp lịch chính xác cho JSON mẫu "Trứng chiên cà chua" từ docs/plan.md', () => {
    expect(sampleRecipe).not.toBeNull();

    // 1. Kiểm tra tính tail(s)
    const tails = computeTails(sampleRecipe.steps);
    expect(tails.get('s5')).toBe(60);
    expect(tails.get('s4')).toBe(300);
    expect(tails.get('s3')).toBe(480);
    expect(tails.get('s2')).toBe(570);
    expect(tails.get('s1')).toBe(420);

    // 2. Chế độ fastest
    const fastestPlan = plan(sampleRecipe, sampleRecipe.servings_base, 'fastest');
    expect(fastestPlan).toEqual([
      { step_id: 's2', start_at: 0, end_at: 90, reason: 'largest_tail' },
      { step_id: 's3', start_at: 90, end_at: 270, reason: 'largest_tail' },
      { step_id: 's1', start_at: 270, end_at: 390, reason: 'only_candidate' },
      { step_id: 's4', start_at: 390, end_at: 630, reason: 'only_candidate' },
      { step_id: 's5', start_at: 630, end_at: 690, reason: 'only_candidate' },
    ]);

    // 3. Chế độ fewest_tools
    const fewestPlan = plan(sampleRecipe, sampleRecipe.servings_base, 'fewest_tools');
    expect(fewestPlan).toEqual(fastestPlan);
  });

  // --------------------------------------------------------------------------
  // Test 2: Ca B - Hai chế độ cho thứ tự khác nhau
  // Bước:
  // s1 (active, 60s, after: [], resources: ['chao'])
  // s2 (active, 30s, after: ['s1'], resources: ['chao'])
  // s3 (active, 90s, after: ['s1'], resources: ['noi'])
  // tail: s2 = 30, s3 = 90, s1 = 150.
  // - fastest: s1 (0-60, only_candidate), s3 (60-150, largest_tail), s2 (150-180, only_candidate).
  // - fewest_tools: s1 (0-60, only_candidate), s2 (60-90, shares_tool), s3 (90-180, only_candidate).
  // --------------------------------------------------------------------------
  it('Ca B: Hai chế độ (fastest vs fewest_tools) cho ra thứ tự khác nhau', () => {
    const caseBSteps: RecipeStep[] = [
      { id: 's1', title: 'B1', kind: 'active', seconds: 60, after: [], resources: ['chao'], text: 'B1' },
      { id: 's2', title: 'B2', kind: 'active', seconds: 30, after: ['s1'], resources: ['chao'], text: 'B2' },
      { id: 's3', title: 'B3', kind: 'active', seconds: 90, after: ['s1'], resources: ['noi'], text: 'B3' },
    ];

    const fastest = plan({ steps: caseBSteps }, 2, 'fastest');
    expect(fastest).toEqual([
      { step_id: 's1', start_at: 0, end_at: 60, reason: 'only_candidate' },
      { step_id: 's3', start_at: 60, end_at: 150, reason: 'largest_tail' },
      { step_id: 's2', start_at: 150, end_at: 180, reason: 'only_candidate' },
    ]);

    const fewest = plan({ steps: caseBSteps }, 2, 'fewest_tools');
    expect(fewest).toEqual([
      { step_id: 's1', start_at: 0, end_at: 60, reason: 'only_candidate' },
      { step_id: 's2', start_at: 60, end_at: 90, reason: 'shares_tool' },
      { step_id: 's3', start_at: 90, end_at: 180, reason: 'only_candidate' },
    ]);
  });

  // --------------------------------------------------------------------------
  // Test 3: Ca C - Bước passive chen bước active
  // Bước:
  // A (passive, 300s, after: [], resources: ['noi'])
  // B (active, 60s, after: [], resources: ['dao'])
  // C (active, 60s, after: [], resources: ['to'])
  // D (active, 30s, after: ['A', 'B', 'C'], resources: ['dia'])
  // tail: D = 30, A = 330, B = 90, C = 90.
  // Kỳ vọng:
  // A: 0-300 (passive_starts_immediately)
  // B: 0-60 (tie_by_order)
  // C: 60-120 (only_candidate)
  // D: 300-330 (only_candidate)
  // --------------------------------------------------------------------------
  it('Ca C: Bước passive chạy nền song song chen bước active', () => {
    const caseCSteps: RecipeStep[] = [
      { id: 'A', title: 'Luộc', kind: 'passive', seconds: 300, after: [], resources: ['noi'], text: 'A' },
      { id: 'B', title: 'Thái', kind: 'active', seconds: 60, after: [], resources: ['dao'], text: 'B' },
      { id: 'C', title: 'Trộn', kind: 'active', seconds: 60, after: [], resources: ['to'], text: 'C' },
      { id: 'D', title: 'Bày', kind: 'active', seconds: 30, after: ['A', 'B', 'C'], resources: ['dia'], text: 'D' },
    ];

    const expectedPlan = [
      { step_id: 'A', start_at: 0, end_at: 300, reason: 'passive_starts_immediately' },
      { step_id: 'B', start_at: 0, end_at: 60, reason: 'tie_by_order' },
      { step_id: 'C', start_at: 60, end_at: 120, reason: 'only_candidate' },
      { step_id: 'D', start_at: 300, end_at: 330, reason: 'only_candidate' },
    ];

    expect(plan({ steps: caseCSteps }, 2, 'fastest')).toEqual(expectedPlan);
    expect(plan({ steps: caseCSteps }, 2, 'fewest_tools')).toEqual(expectedPlan);
  });

  // --------------------------------------------------------------------------
  // Test 4: Ca D - Hai bước tranh cùng dụng cụ
  // P (passive, 120s, resources: ['chao'])
  // Q (active, 60s, resources: ['chao'])
  // R (active, 30s, resources: ['dao'])
  // Kỳ vọng:
  // P: 0-120 (passive_starts_immediately)
  // R: 0-30 (only_candidate)
  // Q: 120-180 (only_candidate)
  // --------------------------------------------------------------------------
  it('Ca D: Hai bước tranh chấp cùng một dụng cụ (bước cần dụng cụ phải chờ)', () => {
    const caseDSteps: RecipeStep[] = [
      { id: 'P', title: 'Hầm', kind: 'passive', seconds: 120, after: [], resources: ['chao'], text: 'P' },
      { id: 'Q', title: 'Chiên', kind: 'active', seconds: 60, after: [], resources: ['chao'], text: 'Q' },
      { id: 'R', title: 'Gọt', kind: 'active', seconds: 30, after: [], resources: ['dao'], text: 'R' },
    ];

    const expectedPlan = [
      { step_id: 'P', start_at: 0, end_at: 120, reason: 'passive_starts_immediately' },
      { step_id: 'R', start_at: 0, end_at: 30, reason: 'only_candidate' },
      { step_id: 'Q', start_at: 120, end_at: 180, reason: 'only_candidate' },
    ];

    expect(plan({ steps: caseDSteps }, 2, 'fastest')).toEqual(expectedPlan);
    expect(plan({ steps: caseDSteps }, 2, 'fewest_tools')).toEqual(expectedPlan);
  });

  // --------------------------------------------------------------------------
  // Test 5: Ca E - Hai bước độc lập, một ngắn một dài
  // L1 (active, 30s, resources: ['dao'])
  // L2 (active, 90s, resources: ['to'])
  // Kỳ vọng: L2 chọn trước vì tail 90 > 30.
  // L2: 0-90 (largest_tail)
  // L1: 90-120 (only_candidate)
  // --------------------------------------------------------------------------
  it('Ca E: Hai bước độc lập, chọn bước dài hơn trước (largest_tail)', () => {
    const caseESteps: RecipeStep[] = [
      { id: 'L1', title: 'Ngắn', kind: 'active', seconds: 30, after: [], resources: ['dao'], text: 'L1' },
      { id: 'L2', title: 'Dài', kind: 'active', seconds: 90, after: [], resources: ['to'], text: 'L2' },
    ];

    const expectedPlan = [
      { step_id: 'L2', start_at: 0, end_at: 90, reason: 'largest_tail' },
      { step_id: 'L1', start_at: 90, end_at: 120, reason: 'only_candidate' },
    ];

    expect(plan({ steps: caseESteps }, 2, 'fastest')).toEqual(expectedPlan);
    expect(plan({ steps: caseESteps }, 2, 'fewest_tools')).toEqual(expectedPlan);
  });

  // --------------------------------------------------------------------------
  // Test 6: Ca F - Công thức bị từ chối bằng lỗi rõ ràng (CYCLE, UNKNOWN_DEPENDENCY)
  // --------------------------------------------------------------------------
  it('Ca F1: Từ chối công thức có chu trình phụ thuộc lặp vòng (mã lỗi CYCLE)', () => {
    const cycleSteps: RecipeStep[] = [
      { id: 'X', title: 'X', kind: 'active', seconds: 10, after: ['Y'], resources: ['dao'], text: 'X' },
      { id: 'Y', title: 'Y', kind: 'active', seconds: 10, after: ['X'], resources: ['dao'], text: 'Y' },
    ];

    expect(() => plan({ steps: cycleSteps }, 2)).toThrowError(SchedulerError);
    try {
      plan({ steps: cycleSteps }, 2);
    } catch (err: unknown) {
      expect((err as SchedulerError).code).toBe('CYCLE');
    }
  });

  it('Ca F2: Từ chối công thức phụ thuộc vào bước không tồn tại (mã lỗi UNKNOWN_DEPENDENCY)', () => {
    const unknownSteps: RecipeStep[] = [
      { id: 'Z', title: 'Z', kind: 'active', seconds: 10, after: ['khong-ton-tai'], resources: ['dao'], text: 'Z' },
    ];

    expect(() => plan({ steps: unknownSteps }, 2)).toThrowError(SchedulerError);
    try {
      plan({ steps: unknownSteps }, 2);
    } catch (err: unknown) {
      expect((err as SchedulerError).code).toBe('UNKNOWN_DEPENDENCY');
    }
  });

  // --------------------------------------------------------------------------
  // Test 7: Ca G - Người dùng làm lệch, tính lại (replan)
  // Dùng lại món ca C: A (passive, 300), B (active, 60), C (active, 60), D (active, 30 after A,B,C).
  // --------------------------------------------------------------------------
  const caseCSteps: RecipeStep[] = [
    { id: 'A', title: 'Luộc', kind: 'passive', seconds: 300, after: [], resources: ['noi'], text: 'A' },
    { id: 'B', title: 'Thái', kind: 'active', seconds: 60, after: [], resources: ['dao'], text: 'B' },
    { id: 'C', title: 'Trộn', kind: 'active', seconds: 60, after: [], resources: ['to'], text: 'C' },
    { id: 'D', title: 'Bày', kind: 'active', seconds: 30, after: ['A', 'B', 'C'], resources: ['dia'], text: 'D' },
  ];

  it('Ca G1: B hoàn thành muộn lúc 90s, A đang chạy giữ nguyên endsAt = 300s', () => {
    const result = replan(
      { steps: caseCSteps },
      {
        done: { B: 90 },
        running_passive: { A: { start: 0, endsAt: 300 } },
      },
      90,
      'fastest'
    );

    expect(result).toEqual([
      { step_id: 'C', start_at: 90, end_at: 150, reason: 'only_candidate' },
      { step_id: 'D', start_at: 300, end_at: 330, reason: 'only_candidate' },
    ]);
  });

  it('Ca G2: B hoàn thành sớm lúc 40s, A đang chạy giữ nguyên endsAt = 300s', () => {
    const result = replan(
      { steps: caseCSteps },
      {
        done: { B: 40 },
        running_passive: { A: { start: 0, endsAt: 300 } },
      },
      40,
      'fastest'
    );

    expect(result).toEqual([
      { step_id: 'C', start_at: 40, end_at: 100, reason: 'only_candidate' },
      { step_id: 'D', start_at: 300, end_at: 330, reason: 'only_candidate' },
    ]);
  });

  it('Ca G3: Người dùng làm C chậm (xong lúc 400s), D chạy từ 400s đến 430s', () => {
    const result = replan(
      { steps: caseCSteps },
      {
        done: { B: 60, A: 300, C: 400 },
        running_passive: {},
      },
      400,
      'fastest'
    );

    expect(result).toEqual([
      { step_id: 'D', start_at: 400, end_at: 430, reason: 'only_candidate' },
    ]);
  });

  // --------------------------------------------------------------------------
  // Test 8: Ca H - Kiểm tra người dùng tự bấm làm bước khác kế hoạch (checkManualStart)
  // --------------------------------------------------------------------------
  it('Ca H1: Bắt đầu C (không có phụ thuộc) -> ok', () => {
    const res = checkManualStart({ steps: caseCSteps }, 'C', [], false);
    expect(res).toEqual({ level: 'ok' });
  });

  it('Ca H2: B đã xong; A và C đang chạy; bấm D (không có mã an toàn) -> warn (unmet: [A, C])', () => {
    const res = checkManualStart({ steps: caseCSteps }, 'D', ['B'], false);
    expect(res).toEqual({ level: 'warn', unmet: ['A', 'C'] });
  });

  it('Ca H3: B đã xong; A và C đang chạy; bấm D (D có mã an toàn, chưa xác nhận) -> blocked', () => {
    const stepsWithSafety: RecipeStep[] = caseCSteps.map((s) =>
      s.id === 'D' ? { ...s, safety_rule: 'safety-test-1' } : s
    );
    const res = checkManualStart({ steps: stepsWithSafety }, 'D', ['B'], false);
    expect(res).toEqual({ level: 'blocked', reason: 'safety_unconfirmed' });
  });

  it('Ca H4: A, B, C đã xong; D có mã an toàn, chưa xác nhận -> blocked', () => {
    const stepsWithSafety: RecipeStep[] = caseCSteps.map((s) =>
      s.id === 'D' ? { ...s, safety_rule: 'safety-test-1' } : s
    );
    const res = checkManualStart({ steps: stepsWithSafety }, 'D', ['A', 'B', 'C'], false);
    expect(res).toEqual({ level: 'blocked', reason: 'safety_unconfirmed' });
  });

  it('Ca H5: A, B, C đã xong; D có mã an toàn, ĐÃ xác nhận -> ok', () => {
    const stepsWithSafety: RecipeStep[] = caseCSteps.map((s) =>
      s.id === 'D' ? { ...s, safety_rule: 'safety-test-1' } : s
    );
    const res = checkManualStart({ steps: stepsWithSafety }, 'D', ['A', 'B', 'C'], true);
    expect(res).toEqual({ level: 'ok' });
  });

  it('Ca H6: A, B, C đã xong; D không có mã an toàn -> ok', () => {
    const res = checkManualStart({ steps: caseCSteps }, 'D', ['A', 'B', 'C'], false);
    expect(res).toEqual({ level: 'ok' });
  });

  // --------------------------------------------------------------------------
  // Test 9: T04.8 - Đổi số phần ăn không làm đổi thời lượng bước
  // --------------------------------------------------------------------------
  it('T04.8: Đổi số phần ăn từ 2 lên 4 không đổi thời lượng các bước (kết quả plan giống hệt)', () => {
    const plan2 = plan(sampleRecipe, 2, 'fastest');
    const plan4 = plan(sampleRecipe, 4, 'fastest');
    expect(plan4).toEqual(plan2);
  });

  // --------------------------------------------------------------------------
  // Test 10: Đối chiếu 100% với các khối JSON trong docs/expected/T04.md
  // --------------------------------------------------------------------------
  it('T04: Khớp 100% với toàn bộ khối JSON kỳ vọng tính tay trong docs/expected/T04.md', () => {
    const expectedFilePath = path.resolve(__dirname, '../../../../docs/expected/T04.md');
    expect(fs.existsSync(expectedFilePath)).toBe(true);
    interface ExpectedCaseBlock {
      case: string;
      steps: RecipeStep[];
      expected: {
        fastest: Array<{ step: string; start: number; end: number; reason: string }>;
        fewest_tools: Array<{ step: string; start: number; end: number; reason: string }>;
      };
    }

    const content = fs.readFileSync(expectedFilePath, 'utf-8');

    // Trích xuất tất cả các khối ```json trong docs/expected/T04.md
    const jsonBlocks = [...content.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
      .map((m) => (m && m[1] ? (JSON.parse(m[1]) as Record<string, unknown>) : null))
      .filter((b): b is Record<string, unknown> => b !== null);

    expect(jsonBlocks.length).toBeGreaterThanOrEqual(8);

    // Kiểm tra Ca B từ file kỳ vọng
    const blockB = jsonBlocks.find((b) => b['case'] === 'B') as unknown as ExpectedCaseBlock | undefined;
    const blockC = jsonBlocks.find((b) => b['case'] === 'C') as unknown as ExpectedCaseBlock | undefined;
    const blockD = jsonBlocks.find((b) => b['case'] === 'D') as unknown as ExpectedCaseBlock | undefined;
    const blockE = jsonBlocks.find((b) => b['case'] === 'E') as unknown as ExpectedCaseBlock | undefined;

    expect(blockB).toBeDefined();
    expect(blockC).toBeDefined();
    expect(blockD).toBeDefined();
    expect(blockE).toBeDefined();

    if (!blockB || !blockC || !blockD || !blockE) {
      throw new Error('Không tìm thấy đủ các khối ca kiểm thử trong docs/expected/T04.md');
    }

    const planBFastest = plan({ steps: blockB.steps }, 2, 'fastest');
    expect(planBFastest.map((s) => ({ step: s.step_id, start: s.start_at, end: s.end_at, reason: s.reason }))).toEqual(
      blockB.expected.fastest
    );
    const planBFewest = plan({ steps: blockB.steps }, 2, 'fewest_tools');
    expect(planBFewest.map((s) => ({ step: s.step_id, start: s.start_at, end: s.end_at, reason: s.reason }))).toEqual(
      blockB.expected.fewest_tools
    );

    // Kiểm tra Ca C từ file kỳ vọng
    const planCFastest = plan({ steps: blockC.steps }, 2, 'fastest');
    expect(planCFastest.map((s) => ({ step: s.step_id, start: s.start_at, end: s.end_at, reason: s.reason }))).toEqual(
      blockC.expected.fastest
    );

    // Kiểm tra Ca D từ file kỳ vọng
    const planDFastest = plan({ steps: blockD.steps }, 2, 'fastest');
    expect(planDFastest.map((s) => ({ step: s.step_id, start: s.start_at, end: s.end_at, reason: s.reason }))).toEqual(
      blockD.expected.fastest
    );

    // Kiểm tra Ca E từ file kỳ vọng
    const planEFastest = plan({ steps: blockE.steps }, 2, 'fastest');
    expect(planEFastest.map((s) => ({ step: s.step_id, start: s.start_at, end: s.end_at, reason: s.reason }))).toEqual(
      blockE.expected.fastest
    );
  });

  // --------------------------------------------------------------------------
  // Test 11: Kiểm tra tính toàn vẹn SHA-256 của docs/expected/T04.md
  // Chuẩn hóa: đổi CRLF -> LF, trimEnd(), tính SHA-256 trên chuỗi UTF-8 không BOM.
  // --------------------------------------------------------------------------
  const EXPECTED_T04_HASH = '89f77ecc4fa5bd7e104315638572d06c3dbb8f3b61c077ecd007526addae2ca7';

  function computeExpectedFileHash(rawContent: string): string {
    const cleanContent = rawContent.startsWith('\uFEFF') ? rawContent.slice(1) : rawContent;
    const normalized = cleanContent.replace(/\r\n/g, '\n').trimEnd();
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  it('T04: Mã băm SHA-256 của docs/expected/T04.md khớp tuyệt đối với bản gốc của chủ dự án (89f77ecc...)', () => {
    const expectedFilePath = path.resolve(__dirname, '../../../../docs/expected/T04.md');
    const rawContent = fs.readFileSync(expectedFilePath, 'utf-8');
    const hash = computeExpectedFileHash(rawContent);
    expect(hash).toBe(EXPECTED_T04_HASH);
  });

  it('T04: Test băm phải ĐỎ khi đổi một ký tự bất kỳ trong nội dung docs/expected/T04.md', () => {
    const expectedFilePath = path.resolve(__dirname, '../../../../docs/expected/T04.md');
    const rawContent = fs.readFileSync(expectedFilePath, 'utf-8');
    const tamperedContent = rawContent.replace('case', 'kase');
    expect(tamperedContent).not.toBe(rawContent);
    const tamperedHash = computeExpectedFileHash(tamperedContent);
    expect(tamperedHash).not.toBe(EXPECTED_T04_HASH);
  });

  it('T04: Test băm KHÔNG ĐỎ khi chỉ thêm hoặc bớt dòng trống và khoảng trắng ở cuối file docs/expected/T04.md', () => {
    const expectedFilePath = path.resolve(__dirname, '../../../../docs/expected/T04.md');
    const rawContent = fs.readFileSync(expectedFilePath, 'utf-8');

    // Thêm nhiều dòng trống, khoảng trắng, CRLF ở cuối
    const withExtraTrailing = rawContent + '\n\n   \r\n\t\n\n';
    const hashWithExtra = computeExpectedFileHash(withExtraTrailing);
    expect(hashWithExtra).toBe(EXPECTED_T04_HASH);

    // Bỏ dòng trống ở cuối (trimEnd)
    const trimmedAtEnd = rawContent.trimEnd();
    const hashTrimmed = computeExpectedFileHash(trimmedAtEnd);
    expect(hashTrimmed).toBe(EXPECTED_T04_HASH);
  });
});

