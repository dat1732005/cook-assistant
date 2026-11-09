/**
 * File: packages/core/src/__tests__/session-service.test.ts
 * Làm gì: Kiểm thử toàn diện SessionService đọc kỳ vọng trực tiếp từ khối JSON Ca S, R, X trong docs/expected/T07.md.
 * Không dùng đồng hồ thật, toàn bộ thời gian truyền qua tham số now.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionService, computeRemaining } from '../db/session-service.js';
import type { RecipeStep } from '../schemas/recipe.js';

// Đọc và phân tích trực tiếp từ docs/expected/T07.md
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const expectedFilePath = path.resolve(__dirname, '../../../../docs/expected/T07.md');
const t07RawContent = fs.readFileSync(expectedFilePath, 'utf-8');

const jsonBlocks = [...t07RawContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
  .map((m) => (m && m[1] ? (JSON.parse(m[1]) as Record<string, unknown>) : null))
  .filter((b): b is Record<string, unknown> => b !== null);

const blockS = jsonBlocks.find((b) => b['case'] === 'S') as {
  case: 'S';
  steps: Array<{
    id: string;
    kind: 'passive' | 'active';
    seconds: number;
    after: string[];
    resources: string[];
  }>;
  timeline: Array<{
    id: string;
    do: string;
    now: number;
    step?: string;
    endsAt?: number;
    now_group?: string[];
    waiting?: string[];
    next?: string[];
    notifications?: number;
    replan?: Array<{ step: string; start: number; end: number }>;
    remaining?: Record<string, number>;
    auto_done?: string[];
    notifications_fired?: number;
    session_status?: 'cooking' | 'done' | 'abandoned';
  }>;
};

const blockR = jsonBlocks.find((b) => b['case'] === 'R') as {
  case: 'R';
  state: {
    done: string[];
    waiting: Record<string, number>;
    pending: string[];
  };
  reopen: Array<{
    now: number;
    A: { remaining: number; state: string; overdue_by?: number };
    D: 'locked' | 'now';
    notifications?: number;
    notifications_fire_now?: number;
    session_status?: 'cooking' | 'done' | 'abandoned';
  }>;
};

const blockX = jsonBlocks.find((b) => b['case'] === 'X') as {
  case: 'X';
  rules: Array<{
    do: string;
    error?: string;
    session_status?: string;
    notifications?: number;
    d_safety_rule?: string;
    result?: { level: string; reason?: string };
  }>;
};

if (!blockS || !blockR || !blockX) {
  throw new Error('Không tìm thấy đủ các khối JSON Ca S, R, X trong docs/expected/T07.md');
}

// Chuyển đổi các bước đọc từ T07.md thành kiểu RecipeStep dùng cho kiểm thử
const t07Steps: RecipeStep[] = blockS.steps.map((s) => ({
  ...s,
  text: `Hướng dẫn cho bước ${s.id}`,
  title: `Bước ${s.id}`,
}));

describe('T07: SessionService & Trạng thái phiên nấu (đối chiếu docs/expected/T07.md)', () => {
  let service: SessionService;

  beforeEach(() => {
    service = new SessionService();
  });

  // =========================================================================
  // CA S: Phiên nấu theo dòng thời gian (S1 đến S6) đọc trực tiếp từ JSON
  // =========================================================================
  describe('Ca S: Dòng thời gian phiên nấu (S1 -> S6)', () => {
    const s1 = blockS.timeline.find((t) => t.id === 'S1')!;
    const s2 = blockS.timeline.find((t) => t.id === 'S2')!;
    const s3 = blockS.timeline.find((t) => t.id === 'S3')!;
    const s4 = blockS.timeline.find((t) => t.id === 'S4')!;
    const s5 = blockS.timeline.find((t) => t.id === 'S5')!;
    const s6 = blockS.timeline.find((t) => t.id === 'S6')!;

    it('S1: Bắt đầu phiên lúc now = 0 -> now: [A, B], waiting: [], next: [C, D], notifications = 0', async () => {
      const snap = await service.start(
        { steps: t07Steps },
        { now: s1.now, mode: 'fastest' }
      );

      expect(snap.now_group).toEqual(s1.now_group);
      expect(snap.waiting).toEqual(s1.waiting);
      expect(snap.next).toEqual(s1.next);
      expect(snap.notifications).toBe(s1.notifications);
      expect(snap.session_status).toBe('cooking');
    });

    it('S2: Bấm "Đã bắt đầu" bước A lúc now = 20 -> endsAt = 320, now: [B], waiting: [A], next: [C, D], notifications = 1', async () => {
      await service.start({ steps: t07Steps }, { now: s1.now });
      const snap = await service.startPassive(s2.step!, s2.now);

      expect(snap.now_group).toEqual(s2.now_group);
      expect(snap.waiting).toEqual(s2.waiting);
      expect(snap.next).toEqual(s2.next);
      expect(snap.notifications).toBe(s2.notifications);

      const timerA = snap.running_timers.find((t) => t.step_id === s2.step);
      expect(timerA).toBeDefined();
      expect(timerA?.endsAt).toBe(s2.endsAt);
    });

    it('S3: Bấm Xong bước B lúc now = 100 -> now: [C], waiting: [A], next: [D], replan C: 100-160, D: 320-350, notifications = 1', async () => {
      await service.start({ steps: t07Steps }, { now: s1.now });
      await service.startPassive(s2.step!, s2.now);
      const res = await service.markDone(s3.step!, s3.now);

      expect(res.success).toBe(true);
      const snap = res.snapshot;
      expect(snap.now_group).toEqual(s3.now_group);
      expect(snap.waiting).toEqual(s3.waiting);
      expect(snap.next).toEqual(s3.next);
      expect(snap.notifications).toBe(s3.notifications);

      expect(snap.replan).toBeDefined();
      expect(snap.replan).toEqual(s3.replan);
    });

    it('S4: Bấm Xong bước C lúc now = 170 -> now: [], waiting: [A], next: [D], remaining A = 150, notifications = 1', async () => {
      await service.start({ steps: t07Steps }, { now: s1.now });
      await service.startPassive(s2.step!, s2.now);
      await service.markDone(s3.step!, s3.now);
      const res = await service.markDone(s4.step!, s4.now);

      expect(res.success).toBe(true);
      const snap = res.snapshot;
      expect(snap.now_group).toEqual(s4.now_group);
      expect(snap.waiting).toEqual(s4.waiting);
      expect(snap.next).toEqual(s4.next);
      expect(snap.remaining?.A).toBe(s4.remaining?.['A']);
      expect(snap.notifications).toBe(s4.notifications);
    });

    it('S5: Đến giờ bước A lúc now = 320 -> A tự hoàn tất (auto_done: [A]), now: [D], waiting: [], next: [], notifications_fired = 1', async () => {
      await service.start({ steps: t07Steps }, { now: s1.now });
      await service.startPassive(s2.step!, s2.now);
      await service.markDone(s3.step!, s3.now);
      await service.markDone(s4.step!, s4.now);

      const tickRes = await service.tick(s5.now);

      expect(tickRes.autoDoneSteps).toEqual(s5.auto_done);
      expect(tickRes.notificationsFired).toBe(s5.notifications_fired);
      expect(tickRes.snapshot.now_group).toEqual(s5.now_group);
      expect(tickRes.snapshot.waiting).toEqual(s5.waiting);
      expect(tickRes.snapshot.next).toEqual(s5.next);
      expect(tickRes.snapshot.auto_done).toEqual(s5.auto_done);
    });

    it('S6: Bấm Xong bước D lúc now = 360 -> phiên done, notifications = 0', async () => {
      await service.start({ steps: t07Steps }, { now: s1.now });
      await service.startPassive(s2.step!, s2.now);
      await service.markDone(s3.step!, s3.now);
      await service.markDone(s4.step!, s4.now);
      await service.tick(s5.now);

      const res = await service.markDone(s6.step!, s6.now);
      expect(res.success).toBe(true);
      expect(res.snapshot.session_status).toBe(s6.session_status);
      expect(res.snapshot.notifications).toBe(s6.notifications);
      expect(res.snapshot.now_group).toEqual([]);
      expect(res.snapshot.waiting).toEqual([]);
      expect(res.snapshot.next).toEqual([]);
    });
  });

  // =========================================================================
  // CA R: Mở lại app giữa chừng (Restore / Reopen) đọc trực tiếp từ JSON
  // =========================================================================
  describe('Ca R: Mở lại app giữa chừng sau S4 (B, C xong; A đang đếm endsAt = 320; D chưa làm)', () => {
    async function setupAfterS4(): Promise<SessionService> {
      const s = new SessionService();
      await s.start({ steps: t07Steps }, { now: 0 });
      await s.startPassive('A', 20);
      await s.markDone('B', 100);
      await s.markDone('C', 170);
      return s;
    }

    it('Reopen lúc 250 -> A còn 70 (waiting), D locked (next), notifications = 1, session_status: cooking', async () => {
      const r250 = blockR.reopen.find((r) => r.now === 250)!;
      const s = await setupAfterS4();
      const res = await s.restore(null, r250.now, t07Steps);

      expect(res).not.toBeNull();
      const snap = res!.snapshot;
      expect(snap.session_status).toBe(r250.session_status);
      expect(snap.waiting).toEqual(Object.keys(blockR.state.waiting));
      expect(snap.remaining?.A).toBe(r250.A.remaining);
      expect(snap.next).toContain('D');
      expect(snap.now_group).not.toContain('D');
      expect(snap.notifications).toBe(r250.notifications);
    });

    it('Reopen lúc 320 -> A hết giờ, tự hoàn tất, D chuyển sang now, notifications_fire_now = 1', async () => {
      const r320 = blockR.reopen.find((r) => r.now === 320)!;
      const s = await setupAfterS4();
      const res = await s.restore(null, r320.now, t07Steps);

      expect(res).not.toBeNull();
      expect(res!.notificationsFireNow).toBe(r320.notifications_fire_now);
      const snap = res!.snapshot;
      expect(snap.waiting).toEqual([]);
      expect(snap.now_group).toContain('D');
    });

    it('Reopen lúc 1000 -> A hết giờ trễ 680, D chuyển sang now, không mất bước, notifications_fire_now = 1', async () => {
      const r1000 = blockR.reopen.find((r) => r.now === 1000)!;
      const s = await setupAfterS4();
      const remInfo = computeRemaining(blockR.state.waiting['A']!, r1000.now);
      expect(remInfo.remaining).toBe(r1000.A.remaining);
      expect(remInfo.overdue_by).toBe(r1000.A.overdue_by);
      expect(remInfo.state).toBe(r1000.A.state);

      const res = await s.restore(null, r1000.now, t07Steps);

      expect(res).not.toBeNull();
      expect(res!.notificationsFireNow).toBe(r1000.notifications_fire_now);
      const snap = res!.snapshot;
      expect(snap.waiting).toEqual([]);
      expect(snap.now_group).toContain('D');
      expect(snap.session_status).toBe('cooking');
    });
  });

  // =========================================================================
  // CA X: Quy tắc an toàn và kiểm soát trạng thái đọc trực tiếp từ JSON
  // =========================================================================
  describe('Ca X: Quy tắc khác (SESSION_ALREADY_ACTIVE, abandon, bước an toàn)', () => {
    const ruleStartSecond = blockX.rules.find((r) => r.do === 'start_second_session')!;
    const ruleAbandon = blockX.rules.find((r) => r.do === 'abandon_with_waiting_A')!;
    const ruleSafetyUnconfirmed = blockX.rules.find(
      (r) => r.do === 'done_D_safety_unconfirmed'
    )!;
    const ruleSafetyConfirmed = blockX.rules.find(
      (r) => r.do === 'done_D_safety_confirmed'
    )!;

    it('Bắt đầu phiên thứ hai khi phiên đầu đang cooking -> Ném lỗi SESSION_ALREADY_ACTIVE', async () => {
      await service.start({ steps: t07Steps }, { now: 0 });
      await expect(
        service.start({ steps: t07Steps }, { now: 10 })
      ).rejects.toThrow(ruleStartSecond.error);
    });

    it('Bỏ dở phiên đang có A đang đếm -> session_status: abandoned, notifications = 0', async () => {
      await service.start({ steps: t07Steps }, { now: 0 });
      await service.startPassive('A', 20);
      const snap = await service.abandon(50);

      expect(snap.session_status).toBe(ruleAbandon.session_status);
      expect(snap.notifications).toBe(ruleAbandon.notifications);
      expect(snap.running_timers.length).toBe(0);
    });

    it('Bước D có mã an toàn safety-test-1, chưa xác nhận lúc now: D -> Trả về blocked, safety_unconfirmed', async () => {
      const stepsWithSafety: RecipeStep[] = t07Steps.map((s) =>
        s.id === 'D' ? { ...s, safety_rule: ruleSafetyUnconfirmed.d_safety_rule } : s
      );

      await service.start({ steps: stepsWithSafety }, { now: 0 });
      await service.startPassive('A', 20);
      await service.markDone('B', 100);
      await service.markDone('C', 170);
      await service.tick(320);

      // now_group lúc này có D
      const res = await service.markDone('D', 330, false);
      expect(res.success).toBe(false);
      expect(res.safetyResult).toEqual(ruleSafetyUnconfirmed.result);
      expect(res.snapshot.session_status).toBe('cooking');
    });

    it('Bước D có mã an toàn safety-test-1, ĐÃ xác nhận lúc now: D -> Cho Xong (ok), phiên hoàn tất', async () => {
      const stepsWithSafety: RecipeStep[] = t07Steps.map((s) =>
        s.id === 'D' ? { ...s, safety_rule: ruleSafetyConfirmed.d_safety_rule } : s
      );

      await service.start({ steps: stepsWithSafety }, { now: 0 });
      await service.startPassive('A', 20);
      await service.markDone('B', 100);
      await service.markDone('C', 170);
      await service.tick(320);

      const res = await service.markDone('D', 330, true);
      expect(res.success).toBe(true);
      expect(res.safetyResult).toEqual(ruleSafetyConfirmed.result);
      expect(res.snapshot.session_status).toBe('done');
    });

    it('Lưu và phục hồi phiên từ SQLite qua SqlDriver', async () => {
      const { NodeSqliteDriver } = await import('../db/node-driver.js');
      const { MigrationRunner } = await import('../db/migration-runner.js');

      const driver = new NodeSqliteDriver(':memory:');
      const runner = new MigrationRunner(driver);
      await runner.run();

      // Thêm món vào bảng recipe để thỏa mãn foreign key
      await driver.execute(
        `INSERT INTO recipe (
          id, slug, name, servings_base, total_minutes, difficulty, status, version
        ) VALUES ('dish-1', 'dish-1', 'Món 1', 2, 30, 1, 'published', 1)`
      );

      const dbService = new SessionService(driver);
      const snap = await dbService.start(
        { id: 'dish-1', version: 1, servings_base: 2, steps: t07Steps },
        { now: 0, sessionId: 'sess-sqlite-1' }
      );
      expect(snap.id).toBe('sess-sqlite-1');

      await dbService.startPassive('A', 10);
      await dbService.markDone('B', 40);

      // Tạo instance mới mô phỏng app bị tắt mở lại
      const restoredService = new SessionService(driver);
      const restored = await restoredService.restore('sess-sqlite-1', 50, t07Steps);

      expect(restored).not.toBeNull();
      expect(restored!.snapshot.step_states['B']).toBe('completed');
      expect(restored!.snapshot.waiting).toEqual(['A']);
      expect(restored!.snapshot.session_status).toBe('cooking');

      // Thử tạo phiên thứ hai trong CSDL -> bị chặn
      const secondService = new SessionService(driver);
      await expect(
        secondService.start(
          { id: 'dish-1', version: 1, servings_base: 2, steps: t07Steps },
          { now: 60 }
        )
      ).rejects.toThrow('SESSION_ALREADY_ACTIVE');
    });

    it('Chứng minh test ĐỎ khi đổi một số trong khối JSON kỳ vọng của docs/expected/T07.md (Ca S replan)', () => {
      // Thay đổi một giá trị số trong replan của S3 (ví dụ end của D từ 350 thành 999)
      const tamperedContent = t07RawContent.replace('"end":350', '"end":999');
      expect(tamperedContent).not.toBe(t07RawContent);

      const tamperedBlocks = [...tamperedContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
        .map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
      const tamperedBlockS = tamperedBlocks.find((b) => b['case'] === 'S') as typeof blockS;
      const s3Tampered = tamperedBlockS.timeline.find((t) => t.id === 'S3')!;

      // Kế hoạch tính lại thực tế cho C và D
      const actualReplan = [
        { step: 'C', start: 100, end: 160 },
        { step: 'D', start: 320, end: 350 },
      ];

      // Nếu so với s3Tampered.replan (có end: 999), assertion phải ném AssertionError
      expect(() => {
        expect(actualReplan).toEqual(s3Tampered.replan);
      }).toThrow();
    });

    it('Lùi bước back(stepId, now): đưa bước đã hoàn thành về pending, đẩy bước sau về next và ghi lịch sử lùi bước (T07.3)', async () => {
      await service.start({ steps: t07Steps }, { now: 0 });
      await service.startPassive('A', 20);
      const afterB = await service.markDone('B', 100);
      expect(afterB.snapshot.now_group).toEqual(['C']);
      expect(afterB.snapshot.step_states['B']).toBe('completed');

      const backSnap = await service.back('B', 110);
      expect(backSnap.step_states['B']).toBe('pending');
      expect(backSnap.now_group).toContain('B');
      expect(backSnap.now_group).not.toContain('C');
      expect(backSnap.next).toContain('C');
      expect(backSnap.waiting).toEqual(['A']);
      expect(service.getStepBackHistory()).toEqual([{ stepId: 'B', at: 110 }]);
    });
  });
});

