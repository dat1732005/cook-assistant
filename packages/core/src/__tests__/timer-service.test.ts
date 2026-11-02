/**
 * File: packages/core/src/__tests__/timer-service.test.ts
 * Làm gì: Kiểm thử bộ hẹn giờ TimerService đọc kỳ vọng trực tiếp từ khối JSON Ca T trong docs/expected/T07.md.
 * Toàn bộ thời gian truyền qua tham số now, không sử dụng đồng hồ thật.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TimerService,
  MockNotificationAdapter,
  remaining,
} from '../timer/timer-service.js';

// Đọc và phân tích cú pháp trực tiếp từ docs/expected/T07.md
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const expectedFilePath = path.resolve(__dirname, '../../../../docs/expected/T07.md');
const t07RawContent = fs.readFileSync(expectedFilePath, 'utf-8');

const jsonBlocks = [...t07RawContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
  .map((m) => (m && m[1] ? (JSON.parse(m[1]) as Record<string, unknown>) : null))
  .filter((b): b is Record<string, unknown> => b !== null);

const blockT = jsonBlocks.find((b) => b['case'] === 'T') as {
  case: 'T';
  remaining: Array<{
    endsAt: number;
    now: number;
    remaining: number;
    overdue_by: number;
    state: 'waiting' | 'elapsed';
  }>;
  actions: Array<{
    do: string;
    step: string;
    now: number;
    endsAt?: number;
    seconds?: number;
    notifications: number;
  }>;
};

if (!blockT) {
  throw new Error('Không tìm thấy khối JSON Ca T trong docs/expected/T07.md');
}

describe('T08: TimerService & Tính toán hẹn giờ thuần (đối chiếu docs/expected/T07.md - Ca T)', () => {
  // =========================================================================
  // CA T - PHẦN 1: Bảng kiểm tra hàm remaining(endsAt, now) đọc trực tiếp từ JSON
  // =========================================================================
  describe('Ca T: Bảng tính toán thời gian còn lại remaining(endsAt, now)', () => {
    it('endsAt = 310, now = 100 -> remaining: 210, overdue_by: 0, state: waiting', () => {
      const exp = blockT.remaining[0]!;
      const res = remaining(exp.endsAt, exp.now);
      expect(res.remaining).toBe(exp.remaining);
      expect(res.overdue_by).toBe(exp.overdue_by);
      expect(res.state).toBe(exp.state);
    });

    it('endsAt = 310, now = 310 -> remaining: 0, overdue_by: 0, state: elapsed', () => {
      const exp = blockT.remaining[1]!;
      const res = remaining(exp.endsAt, exp.now);
      expect(res.remaining).toBe(exp.remaining);
      expect(res.overdue_by).toBe(exp.overdue_by);
      expect(res.state).toBe(exp.state);
    });

    it('endsAt = 310, now = 400 -> remaining: 0, overdue_by: 90, state: elapsed', () => {
      const exp = blockT.remaining[2]!;
      const res = remaining(exp.endsAt, exp.now);
      expect(res.remaining).toBe(exp.remaining);
      expect(res.overdue_by).toBe(exp.overdue_by);
      expect(res.state).toBe(exp.state);
    });
  });

  // =========================================================================
  // CA T - PHẦN 2: Bảng hành động và số thông báo đặt lịch đọc trực tiếp từ JSON
  // =========================================================================
  describe('Ca T: Chuỗi hành động và số thông báo đặt lịch', () => {
    it('Thực hiện chuỗi hành động Ca T: start_passive A -> start_active B -> manual_timer B', async () => {
      const adapter = new MockNotificationAdapter();
      const timerService = new TimerService(adapter);

      const actA = blockT.actions.find((a) => a.do === 'start_passive')!;
      const actB = blockT.actions.find((a) => a.do === 'start_active')!;
      const actManual = blockT.actions.find((a) => a.do === 'manual_timer')!;

      // Bước 1: Bấm "Đã bắt đầu" bước A lúc 10 -> endsAt = 310, số thông báo đã đặt = 1
      const resA = await timerService.startPassive(
        { id: actA.step, kind: 'passive', seconds: actA.endsAt! - actA.now, title: 'Nấu nước sôi' },
        actA.now
      );
      expect(resA.timer.endsAt).toBe(actA.endsAt);
      expect(resA.notifications).toBe(actA.notifications);
      expect(await timerService.getNotificationCount()).toBe(actA.notifications);

      // Bước 2: Sau đó bắt đầu bước active B lúc 20 -> số thông báo VẪN = 1 (B không tạo thông báo)
      const resB = await timerService.startActive(
        { id: actB.step, kind: 'active', seconds: 60, title: 'Thái hành thịt' },
        actB.now
      );
      expect(resB.notifications).toBe(actB.notifications);
      expect(await timerService.getNotificationCount()).toBe(actB.notifications);

      // Bước 3: Hẹn giờ tay 120 giây lúc 50 -> endsAt = 170, số thông báo = 2
      const resManual = await timerService.setManualTimer(
        actManual.seconds!,
        actManual.now,
        'Lật mặt trứng',
        actManual.step
      );
      expect(resManual.timer.endsAt).toBe(actManual.endsAt);
      expect(resManual.notifications).toBe(actManual.notifications);
      expect(await timerService.getNotificationCount()).toBe(actManual.notifications);

      // Kiểm tra danh sách thông báo đã lên lịch trong adapter
      const scheduledList = await adapter.getScheduledNotifications();
      expect(scheduledList.length).toBe(actManual.notifications);
      expect(scheduledList[0]?.triggerAtSeconds).toBe(actA.endsAt);
      expect(scheduledList[1]?.triggerAtSeconds).toBe(actManual.endsAt);

      // Hủy tất cả thông báo
      await timerService.cancelAll();
      expect(await timerService.getNotificationCount()).toBe(0);
    });

    it('Restore danh sách timer tính toán đúng remaining và state lúc mở lại app', () => {
      const timerService = new TimerService();
      const expWaiting = blockT.remaining[0]!; // now = 100, endsAt = 310 -> remaining: 210, waiting
      const restored = timerService.restore(
        [
          { id: 'passive_A', endsAt: expWaiting.endsAt, step_id: 'A' },
          { id: 'manual_1', endsAt: 170, label: 'Chiên trứng' },
        ],
        expWaiting.now
      );

      expect(restored.length).toBe(2);
      expect(restored[0]?.remaining).toBe(expWaiting.remaining);
      expect(restored[0]?.state).toBe(expWaiting.state);
      expect(restored[1]?.remaining).toBe(70);
      expect(restored[1]?.state).toBe('waiting');
    });

    it('Chứng minh test ĐỎ khi đổi một số trong khối JSON kỳ vọng của docs/expected/T07.md', () => {
      // Thay đổi một giá trị số trong khối JSON của T07.md (ví dụ remaining: 210 thành 999)
      const tamperedContent = t07RawContent.replace('"remaining":210', '"remaining":999');
      expect(tamperedContent).not.toBe(t07RawContent);

      const tamperedBlocks = [...tamperedContent.matchAll(/```json\s*(\{[\s\S]*?\})\s*```/g)]
        .map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
      const tamperedBlockT = tamperedBlocks.find((b) => b['case'] === 'T') as typeof blockT;

      const firstCase = tamperedBlockT.remaining[0]!;
      const actual = remaining(firstCase.endsAt, firstCase.now);

      // actual.remaining thực tế là 210, nếu so sánh với số bị sửa 999 thì expect phải quăng lỗi AssertionError
      expect(() => {
        expect(actual.remaining).toBe(firstCase.remaining);
      }).toThrow();
    });
  });
});
