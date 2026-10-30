/**
 * File: packages/core/src/__tests__/session-service.test.ts
 * Làm gì: Kiểm thử toàn diện SessionService đối chiếu 100% từng ca S, R, X trong docs/expected/T07.md.
 * Không dùng đồng hồ thật, toàn bộ thời gian truyền qua tham số now.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionService, computeRemaining } from '../db/session-service.js';
import type { RecipeStep } from '../schemas/recipe.js';

describe('T07: SessionService & Trạng thái phiên nấu (đối chiếu docs/expected/T07.md)', () => {
  // Bộ 4 bước mẫu từ Ca C của T04
  const caseCSteps: RecipeStep[] = [
    {
      id: 'A',
      title: 'Nấu nước sôi',
      kind: 'passive',
      seconds: 300,
      after: [],
      resources: ['noi'],
      text: 'Đun sôi nước trong nồi',
    },
    {
      id: 'B',
      title: 'Thái hành thịt',
      kind: 'active',
      seconds: 60,
      after: [],
      resources: ['dao'],
      text: 'Thái hành và thịt',
    },
    {
      id: 'C',
      title: 'Đập trứng',
      kind: 'active',
      seconds: 60,
      after: [],
      resources: ['to'],
      text: 'Đập trứng vào tô',
    },
    {
      id: 'D',
      title: 'Bày ra đĩa',
      kind: 'active',
      seconds: 30,
      after: ['A', 'B', 'C'],
      resources: ['dia'],
      text: 'Bày món ăn ra đĩa',
    },
  ];

  let service: SessionService;

  beforeEach(() => {
    service = new SessionService();
  });

  // =========================================================================
  // CA S: Phiên nấu theo dòng thời gian (S1 đến S6)
  // =========================================================================
  describe('Ca S: Dòng thời gian phiên nấu (S1 -> S6)', () => {
    it('S1: Bắt đầu phiên lúc now = 0 -> now: [A, B], waiting: [], next: [C, D], notifications = 0', async () => {
      const snap = await service.start(
        { steps: caseCSteps },
        { now: 0, mode: 'fastest' }
      );

      expect(snap.now_group).toEqual(['A', 'B']);
      expect(snap.waiting).toEqual([]);
      expect(snap.next).toEqual(['C', 'D']);
      expect(snap.notifications).toBe(0);
      expect(snap.session_status).toBe('cooking');
    });

    it('S2: Bấm "Đã bắt đầu" bước A lúc now = 20 -> endsAt = 320, now: [B], waiting: [A], next: [C, D], notifications = 1', async () => {
      await service.start({ steps: caseCSteps }, { now: 0 });
      const snap = await service.startPassive('A', 20);

      expect(snap.now_group).toEqual(['B']);
      expect(snap.waiting).toEqual(['A']);
      expect(snap.next).toEqual(['C', 'D']);
      expect(snap.notifications).toBe(1);

      const timerA = snap.running_timers.find((t) => t.step_id === 'A');
      expect(timerA).toBeDefined();
      expect(timerA?.endsAt).toBe(320);
    });

    it('S3: Bấm Xong bước B lúc now = 100 -> now: [C], waiting: [A], next: [D], replan C: 100-160, D: 320-350, notifications = 1', async () => {
      await service.start({ steps: caseCSteps }, { now: 0 });
      await service.startPassive('A', 20);
      const res = await service.markDone('B', 100);

      expect(res.success).toBe(true);
      const snap = res.snapshot;
      expect(snap.now_group).toEqual(['C']);
      expect(snap.waiting).toEqual(['A']);
      expect(snap.next).toEqual(['D']);
      expect(snap.notifications).toBe(1);

      expect(snap.replan).toBeDefined();
      const planC = snap.replan?.find((r) => r.step === 'C');
      const planD = snap.replan?.find((r) => r.step === 'D');
      expect(planC).toEqual({ step: 'C', start: 100, end: 160 });
      expect(planD).toEqual({ step: 'D', start: 320, end: 350 });
    });

    it('S4: Bấm Xong bước C lúc now = 170 -> now: [], waiting: [A], next: [D], remaining A = 150, notifications = 1', async () => {
      await service.start({ steps: caseCSteps }, { now: 0 });
      await service.startPassive('A', 20);
      await service.markDone('B', 100);
      const res = await service.markDone('C', 170);

      expect(res.success).toBe(true);
      const snap = res.snapshot;
      expect(snap.now_group).toEqual([]);
      expect(snap.waiting).toEqual(['A']);
      expect(snap.next).toEqual(['D']);
      expect(snap.remaining?.A).toBe(150);
      expect(snap.notifications).toBe(1);
    });

    it('S5: Đến giờ bước A lúc now = 320 -> A tự hoàn tất (auto_done: [A]), now: [D], waiting: [], next: [], notifications_fired = 1', async () => {
      await service.start({ steps: caseCSteps }, { now: 0 });
      await service.startPassive('A', 20);
      await service.markDone('B', 100);
      await service.markDone('C', 170);

      const tickRes = await service.tick(320);

      expect(tickRes.autoDoneSteps).toEqual(['A']);
      expect(tickRes.notificationsFired).toBe(1);
      expect(tickRes.snapshot.now_group).toEqual(['D']);
      expect(tickRes.snapshot.waiting).toEqual([]);
      expect(tickRes.snapshot.next).toEqual([]);
      expect(tickRes.snapshot.auto_done).toEqual(['A']);
    });

    it('S6: Bấm Xong bước D lúc now = 360 -> phiên done, notifications = 0', async () => {
      await service.start({ steps: caseCSteps }, { now: 0 });
      await service.startPassive('A', 20);
      await service.markDone('B', 100);
      await service.markDone('C', 170);
      await service.tick(320);

      const res = await service.markDone('D', 360);
      expect(res.success).toBe(true);
      expect(res.snapshot.session_status).toBe('done');
      expect(res.snapshot.notifications).toBe(0);
      expect(res.snapshot.now_group).toEqual([]);
      expect(res.snapshot.waiting).toEqual([]);
      expect(res.snapshot.next).toEqual([]);
    });
  });

  // =========================================================================
  // CA R: Mở lại app giữa chừng (Restore / Reopen)
  // =========================================================================
  describe('Ca R: Mở lại app giữa chừng sau S4 (B, C xong; A đang đếm endsAt = 320; D chưa làm)', () => {
    async function setupAfterS4(): Promise<SessionService> {
      const s = new SessionService();
      await s.start({ steps: caseCSteps }, { now: 0 });
      await s.startPassive('A', 20);
      await s.markDone('B', 100);
      await s.markDone('C', 170);
      return s;
    }

    it('Reopen lúc 250 -> A còn 70 (waiting), D locked (next), notifications = 1, session_status: cooking', async () => {
      const s = await setupAfterS4();
      const res = await s.restore(null, 250, caseCSteps);

      expect(res).not.toBeNull();
      const snap = res!.snapshot;
      expect(snap.session_status).toBe('cooking');
      expect(snap.waiting).toEqual(['A']);
      expect(snap.remaining?.A).toBe(70);
      expect(snap.next).toContain('D');
      expect(snap.now_group).not.toContain('D');
      expect(snap.notifications).toBe(1);
    });

    it('Reopen lúc 320 -> A hết giờ, tự hoàn tất, D chuyển sang now, notifications_fire_now = 1', async () => {
      const s = await setupAfterS4();
      const res = await s.restore(null, 320, caseCSteps);

      expect(res).not.toBeNull();
      expect(res!.notificationsFireNow).toBe(1);
      const snap = res!.snapshot;
      expect(snap.waiting).toEqual([]);
      expect(snap.now_group).toContain('D');
    });

    it('Reopen lúc 1000 -> A hết giờ trễ 680, D chuyển sang now, không mất bước, notifications_fire_now = 1', async () => {
      const s = await setupAfterS4();
      const remInfo = computeRemaining(320, 1000);
      expect(remInfo.remaining).toBe(0);
      expect(remInfo.overdue_by).toBe(680);
      expect(remInfo.state).toBe('elapsed');

      const res = await s.restore(null, 1000, caseCSteps);

      expect(res).not.toBeNull();
      expect(res!.notificationsFireNow).toBe(1);
      const snap = res!.snapshot;
      expect(snap.waiting).toEqual([]);
      expect(snap.now_group).toContain('D');
      expect(snap.session_status).toBe('cooking');
    });
  });

  // =========================================================================
  // CA X: Quy tắc an toàn và kiểm soát trạng thái
  // =========================================================================
  describe('Ca X: Quy tắc khác (SESSION_ALREADY_ACTIVE, abandon, bước an toàn)', () => {
    it('Bắt đầu phiên thứ hai khi phiên đầu đang cooking -> Ném lỗi SESSION_ALREADY_ACTIVE', async () => {
      await service.start({ steps: caseCSteps }, { now: 0 });
      await expect(
        service.start({ steps: caseCSteps }, { now: 10 })
      ).rejects.toThrow('SESSION_ALREADY_ACTIVE');
    });

    it('Bỏ dở phiên đang có A đang đếm -> session_status: abandoned, notifications = 0', async () => {
      await service.start({ steps: caseCSteps }, { now: 0 });
      await service.startPassive('A', 20);
      const snap = await service.abandon(50);

      expect(snap.session_status).toBe('abandoned');
      expect(snap.notifications).toBe(0);
      expect(snap.running_timers.length).toBe(0);
    });

    it('Bước D có mã an toàn safety-test-1, chưa xác nhận lúc now: D -> Trả về blocked, safety_unconfirmed', async () => {
      const stepsWithSafety: RecipeStep[] = caseCSteps.map((s) =>
        s.id === 'D' ? { ...s, safety_rule: 'safety-test-1' } : s
      );

      await service.start({ steps: stepsWithSafety }, { now: 0 });
      await service.startPassive('A', 20);
      await service.markDone('B', 100);
      await service.markDone('C', 170);
      await service.tick(320);

      // now_group lúc này có D
      const res = await service.markDone('D', 330, false);
      expect(res.success).toBe(false);
      expect(res.safetyResult).toEqual({
        level: 'blocked',
        reason: 'safety_unconfirmed',
      });
      expect(res.snapshot.session_status).toBe('cooking');
    });

    it('Bước D có mã an toàn safety-test-1, ĐÃ xác nhận lúc now: D -> Cho Xong (ok), phiên hoàn tất', async () => {
      const stepsWithSafety: RecipeStep[] = caseCSteps.map((s) =>
        s.id === 'D' ? { ...s, safety_rule: 'safety-test-1' } : s
      );

      await service.start({ steps: stepsWithSafety }, { now: 0 });
      await service.startPassive('A', 20);
      await service.markDone('B', 100);
      await service.markDone('C', 170);
      await service.tick(320);

      const res = await service.markDone('D', 330, true);
      expect(res.success).toBe(true);
      expect(res.safetyResult).toEqual({ level: 'ok' });
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
        { id: 'dish-1', version: 1, servings_base: 2, steps: caseCSteps },
        { now: 0, sessionId: 'sess-sqlite-1' }
      );
      expect(snap.id).toBe('sess-sqlite-1');

      await dbService.startPassive('A', 10);
      await dbService.markDone('B', 40);

      // Tạo instance mới mô phỏng app bị tắt mở lại
      const restoredService = new SessionService(driver);
      const restored = await restoredService.restore('sess-sqlite-1', 50, caseCSteps);

      expect(restored).not.toBeNull();
      expect(restored!.snapshot.step_states['B']).toBe('completed');
      expect(restored!.snapshot.waiting).toEqual(['A']);
      expect(restored!.snapshot.session_status).toBe('cooking');

      // Thử tạo phiên thứ hai trong CSDL -> bị chặn
      const secondService = new SessionService(driver);
      await expect(
        secondService.start(
          { id: 'dish-1', version: 1, servings_base: 2, steps: caseCSteps },
          { now: 60 }
        )
      ).rejects.toThrow('SESSION_ALREADY_ACTIVE');
    });
  });
});
