/**
 * File: packages/core/src/timer/timer-service.ts
 * Module: @cook/core
 *
 * Triển khai phần tính toán thuần cho bộ hẹn giờ (TimerService) tách biệt hoàn toàn khỏi Expo / React Native.
 * Chỉ đặt thông báo cho bước passive và hẹn giờ tay, TUYỆT ĐỐI không đặt thông báo cho bước active.
 * Nhận vào: NotificationAdapter (Mock trong Node/test, ExpoNotificationAdapter trên thiết bị).
 * Trả ra: Tính toán thời gian còn lại (remaining), trễ (overdue_by), trạng thái waiting/elapsed, và quản lý lịch thông báo.
 * Ai gọi: Màn hình Nấu (CookScreen), CookSession (T07), Acceptance tests Ca T.
 * Bám theo: docs/expected/T07.md (Ca T) và docs/tasks.md mục T08.
 */

export interface RemainingResult {
  endsAt?: number;
  now?: number;
  remaining: number;
  overdue_by: number;
  state: 'waiting' | 'elapsed';
}

/**
 * Tính toán thuần túy thời gian còn lại và độ trễ (Ca T).
 *
 * @param endsAt Mốc thời gian kết thúc dự kiến (giây)
 * @param now Mốc thời gian hiện tại (giây)
 * @returns { remaining: number; overdue_by: number; state: 'waiting' | 'elapsed' }
 *
 * @example
 * remaining(310, 100) // -> { remaining: 210, overdue_by: 0, state: 'waiting' }
 * remaining(310, 310) // -> { remaining: 0, overdue_by: 0, state: 'elapsed' }
 * remaining(310, 400) // -> { remaining: 0, overdue_by: 90, state: 'elapsed' }
 */
export function remaining(endsAt: number, now: number): RemainingResult {
  if (now < endsAt) {
    return {
      endsAt,
      now,
      remaining: endsAt - now,
      overdue_by: 0,
      state: 'waiting',
    };
  }
  return {
    endsAt,
    now,
    remaining: 0,
    overdue_by: now - endsAt,
    state: 'elapsed',
  };
}

export interface NotificationRequest {
  id: string;
  title: string;
  body: string;
  triggerAtSeconds: number;
  stepId?: string;
  type: 'passive' | 'manual';
}

export interface NotificationAdapter {
  schedule(req: NotificationRequest): Promise<string>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  requestPermissions(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  getScheduledNotifications(): Promise<NotificationRequest[]>;
}

/**
 * Adapter giả lập phục vụ kiểm thử và môi trường Node.js.
 */
export class MockNotificationAdapter implements NotificationAdapter {
  private scheduled = new Map<string, NotificationRequest>();

  async schedule(req: NotificationRequest): Promise<string> {
    this.scheduled.set(req.id, req);
    return req.id;
  }

  async cancel(id: string): Promise<void> {
    this.scheduled.delete(id);
  }

  async cancelAll(): Promise<void> {
    this.scheduled.clear();
  }

  async requestPermissions(): Promise<{ granted: boolean; canAskAgain: boolean }> {
    return { granted: true, canAskAgain: true };
  }

  async getScheduledNotifications(): Promise<NotificationRequest[]> {
    return Array.from(this.scheduled.values());
  }

  get count(): number {
    return this.scheduled.size;
  }
}

export interface ScheduledTimerItem {
  id: string;
  stepId?: string;
  kind: 'passive' | 'manual';
  endsAt: number;
  label?: string;
}

export class TimerService {
  private adapter: NotificationAdapter;
  private timers = new Map<string, ScheduledTimerItem>();

  constructor(adapter?: NotificationAdapter) {
    this.adapter = adapter || new MockNotificationAdapter();
  }

  /**
   * Tính toán thời gian còn lại (alias cho hàm thuần remaining).
   */
  remaining(endsAt: number, now: number): RemainingResult {
    return remaining(endsAt, now);
  }

  /**
   * Bắt đầu một bước passive lúc now:
   * endsAt = now + step.seconds, đặt đúng 1 thông báo vào adapter.
   */
  async startPassive(
    step: { id: string; kind: string; seconds: number; title?: string },
    now: number
  ): Promise<{ timer: ScheduledTimerItem; notifications: number }> {
    if (step.kind !== 'passive') {
      throw new Error(`Bước ${step.id} không phải là bước passive`);
    }

    const endsAt = now + step.seconds;
    const timerId = `passive_${step.id}`;
    const timerItem: ScheduledTimerItem = {
      id: timerId,
      stepId: step.id,
      kind: 'passive',
      endsAt,
      label: step.title || step.id,
    };

    this.timers.set(timerId, timerItem);

    await this.adapter.schedule({
      id: timerId,
      title: 'Hết giờ bước nấu',
      body: `Bước ${step.title || step.id} đã hoàn tất, sẵn sàng làm bước tiếp theo!`,
      triggerAtSeconds: endsAt,
      stepId: step.id,
      type: 'passive',
    });

    const notifications = await this.getNotificationCount();
    return { timer: timerItem, notifications };
  }

  /**
   * Bắt đầu một bước active lúc now:
   * TUYỆT ĐỐI KHÔNG ĐẶT THÔNG BÁO. Số thông báo giữ nguyên (Ca T).
   */
  async startActive(
    step: { id: string; kind: string; seconds?: number; title?: string },
    now: number
  ): Promise<{ notifications: number }> {
    void step;
    void now;
    // Bước active: không có đếm giờ, không có thông báo. Người dùng bấm "Xong".
    const notifications = await this.getNotificationCount();
    return { notifications };
  }

  /**
   * Hẹn giờ tay (tùy chọn) cho bất kỳ bước nào lúc now:
   * endsAt = now + seconds, đặt 1 thông báo riêng vào adapter (Ca T).
   */
  async setManualTimer(
    seconds: number,
    now: number,
    label?: string,
    stepId?: string
  ): Promise<{ timer: ScheduledTimerItem; notifications: number }> {
    const endsAt = now + seconds;
    const timerId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timerItem: ScheduledTimerItem = {
      id: timerId,
      stepId,
      kind: 'manual',
      endsAt,
      label: label || 'Hẹn giờ tay',
    };

    this.timers.set(timerId, timerItem);

    await this.adapter.schedule({
      id: timerId,
      title: 'Hẹn giờ nấu ăn',
      body: label || 'Đã hết thời gian hẹn giờ nấu ăn!',
      triggerAtSeconds: endsAt,
      stepId,
      type: 'manual',
    });

    const notifications = await this.getNotificationCount();
    return { timer: timerItem, notifications };
  }

  /**
   * Phục hồi trạng thái bộ hẹn giờ khi mở lại app giữa chừng (Ca R).
   */
  restore(
    timers: Array<{ id: string; endsAt: number; step_id?: string; label?: string }>,
    now: number
  ): Array<ScheduledTimerItem & RemainingResult> {
    const results: Array<ScheduledTimerItem & RemainingResult> = [];

    this.timers.clear();
    for (const t of timers) {
      const endsAt = Number(t.endsAt);
      const rem = remaining(endsAt, now);
      const timerItem: ScheduledTimerItem = {
        id: t.id,
        stepId: t.step_id,
        kind: t.id.startsWith('manual') ? 'manual' : 'passive',
        endsAt,
        label: t.label,
      };

      if (rem.state === 'waiting') {
        this.timers.set(t.id, timerItem);
      }

      results.push({
        ...timerItem,
        ...rem,
      });
    }

    return results;
  }

  /**
   * Hủy toàn bộ thông báo đang đặt khi phiên bị bỏ dở (abandoned) hoặc hoàn thành.
   */
  async cancelAll(): Promise<void> {
    this.timers.clear();
    await this.adapter.cancelAll();
  }

  /**
   * Lấy tổng số thông báo đang được đặt.
   */
  async getNotificationCount(): Promise<number> {
    const scheduled = await this.adapter.getScheduledNotifications();
    return scheduled.length;
  }
}
