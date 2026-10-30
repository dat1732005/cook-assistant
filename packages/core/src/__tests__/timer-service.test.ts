/**
 * File: packages/core/src/__tests__/timer-service.test.ts
 * Làm gì: Kiểm thử bộ hẹn giờ TimerService đối chiếu 100% từng ca trong Ca T của docs/expected/T07.md.
 * Toàn bộ thời gian truyền qua tham số now, không sử dụng đồng hồ thật.
 */

import { describe, it, expect } from 'vitest';
import {
  TimerService,
  MockNotificationAdapter,
  remaining,
} from '../timer/timer-service.js';

describe('T08: TimerService & Tính toán hẹn giờ thuần (đối chiếu docs/expected/T07.md - Ca T)', () => {
  // =========================================================================
  // CA T - PHẦN 1: Bảng kiểm tra hàm remaining(endsAt, now)
  // =========================================================================
  describe('Ca T: Bảng tính toán thời gian còn lại remaining(endsAt, now)', () => {
    it('endsAt = 310, now = 100 -> remaining: 210, overdue_by: 0, state: waiting', () => {
      const res = remaining(310, 100);
      expect(res.remaining).toBe(210);
      expect(res.overdue_by).toBe(0);
      expect(res.state).toBe('waiting');
    });

    it('endsAt = 310, now = 310 -> remaining: 0, overdue_by: 0, state: elapsed', () => {
      const res = remaining(310, 310);
      expect(res.remaining).toBe(0);
      expect(res.overdue_by).toBe(0);
      expect(res.state).toBe('elapsed');
    });

    it('endsAt = 310, now = 400 -> remaining: 0, overdue_by: 90, state: elapsed', () => {
      const res = remaining(310, 400);
      expect(res.remaining).toBe(0);
      expect(res.overdue_by).toBe(90);
      expect(res.state).toBe('elapsed');
    });
  });

  // =========================================================================
  // CA T - PHẦN 2: Bảng hành động và số thông báo đặt lịch
  // =========================================================================
  describe('Ca T: Chuỗi hành động và số thông báo đặt lịch', () => {
    it('Thực hiện chuỗi hành động Ca T: start_passive A -> start_active B -> manual_timer B', async () => {
      const adapter = new MockNotificationAdapter();
      const timerService = new TimerService(adapter);

      // Bước 1: Bấm "Đã bắt đầu" bước A lúc 10 -> endsAt = 310, số thông báo đã đặt = 1
      const resA = await timerService.startPassive(
        { id: 'A', kind: 'passive', seconds: 300, title: 'Nấu nước sôi' },
        10
      );
      expect(resA.timer.endsAt).toBe(310);
      expect(resA.notifications).toBe(1);
      expect(await timerService.getNotificationCount()).toBe(1);

      // Bước 2: Sau đó bắt đầu bước active B lúc 20 -> số thông báo VẪN = 1 (B không tạo thông báo)
      const resB = await timerService.startActive(
        { id: 'B', kind: 'active', seconds: 60, title: 'Thái hành thịt' },
        20
      );
      expect(resB.notifications).toBe(1);
      expect(await timerService.getNotificationCount()).toBe(1);

      // Bước 3: Hẹn giờ tay 120 giây lúc 50 -> endsAt = 170, số thông báo = 2
      const resManual = await timerService.setManualTimer(120, 50, 'Lật mặt trứng', 'B');
      expect(resManual.timer.endsAt).toBe(170);
      expect(resManual.notifications).toBe(2);
      expect(await timerService.getNotificationCount()).toBe(2);

      // Kiểm tra danh sách thông báo đã lên lịch trong adapter
      const scheduledList = await adapter.getScheduledNotifications();
      expect(scheduledList.length).toBe(2);
      expect(scheduledList[0]?.triggerAtSeconds).toBe(310);
      expect(scheduledList[1]?.triggerAtSeconds).toBe(170);

      // Hủy tất cả thông báo
      await timerService.cancelAll();
      expect(await timerService.getNotificationCount()).toBe(0);
    });

    it('Restore danh sách timer tính toán đúng remaining và state lúc mở lại app', () => {
      const timerService = new TimerService();
      const restored = timerService.restore(
        [
          { id: 'passive_A', endsAt: 310, step_id: 'A' },
          { id: 'manual_1', endsAt: 170, label: 'Chiên trứng' },
        ],
        100
      );

      expect(restored.length).toBe(2);
      expect(restored[0]?.remaining).toBe(210);
      expect(restored[0]?.state).toBe('waiting');
      expect(restored[1]?.remaining).toBe(70);
      expect(restored[1]?.state).toBe('waiting');
    });
  });
});
