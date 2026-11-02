/**
 * File: apps/mobile/src/services/notification-service.ts
 * Làm gì: Triển khai NotificationAdapter dùng thư viện expo-notifications trên ứng dụng di động React Native / Expo,
 *         cung cấp chức năng xin quyền thông báo và hướng dẫn người dùng tắt tính năng tối ưu hóa pin trên Android.
 * Nhận vào: NotificationRequest từ TimerService / CookSession.
 * Trả ra: Đặt lịch thông báo đẩy cục bộ, hủy thông báo, và chuỗi hướng dẫn thiết lập pin.
 * Ai gọi: CookScreen, TimerService, App khởi tạo.
 * Bám theo: Mục T08 trong docs/tasks.md và docs/expected/T07.md.
 */

import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import type {
  NotificationAdapter,
  NotificationRequest,
} from '@cook/core';

// Cấu hình trình xử lý thông báo khi ứng dụng đang mở ở tiền cảnh (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Adapter thông báo đẩy cục bộ trên thiết bị di động sử dụng Expo Notifications.
 */
export class ExpoNotificationAdapter implements NotificationAdapter {
  private activeMap = new Map<string, string>(); // Map id tùy chỉnh -> notificationIdentifier của Expo

  /**
   * Xin quyền gửi thông báo từ người dùng.
   */
  async requestPermissions(): Promise<{ granted: boolean; canAskAgain: boolean }> {
    const settings = await Notifications.getPermissionsAsync();
    let granted =
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted && settings.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      granted = requested.granted;
    }

    return {
      granted,
      canAskAgain: settings.canAskAgain,
    };
  }

  /**
   * Đặt lịch thông báo tại mốc thời gian tương lai (tính bằng giây).
   */
  async schedule(req: NotificationRequest): Promise<string> {
    // Hủy thông báo cũ nếu trùng ID
    await this.cancel(req.id);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const triggerInSeconds = Math.max(1, req.triggerAtSeconds - nowSeconds);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: req.title,
        body: req.body,
        sound: true,
        data: {
          stepId: req.stepId,
          type: req.type,
          customId: req.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerInSeconds,
        repeats: false,
      },
    });

    this.activeMap.set(req.id, notificationId);
    return notificationId;
  }

  /**
   * Hủy một thông báo cụ thể.
   */
  async cancel(id: string): Promise<void> {
    const expoId = this.activeMap.get(id);
    if (expoId) {
      await Notifications.cancelScheduledNotificationAsync(expoId);
      this.activeMap.delete(id);
    }
  }

  /**
   * Hủy toàn bộ thông báo của ứng dụng (khi kết thúc hoặc bỏ dở phiên).
   */
  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.activeMap.clear();
  }

  /**
   * Lấy danh sách các thông báo đang chờ kích hoạt.
   */
  async getScheduledNotifications(): Promise<NotificationRequest[]> {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.map((n) => {
      const data = n.content.data as Record<string, unknown> | undefined;
      return {
        id: (data?.customId as string) || n.identifier,
        title: n.content.title || '',
        body: n.content.body || '',
        triggerAtSeconds: 0,
        stepId: data?.stepId as string | undefined,
        type: (data?.type as 'passive' | 'manual') || 'passive',
      };
    });
  }
}

/**
 * Hướng dẫn từng bước tắt tối ưu hóa pin cho ứng dụng trên Android (T08).
 * Giúp đảm bảo chuông báo giờ reo chính xác 100% ngay cả khi khóa màn hình hoặc ứng dụng chạy ngầm.
 */
export const BATTERY_OPTIMIZATION_GUIDE = {
  title: 'Tắt tối ưu hóa pin để hẹn giờ chính xác',
  subtitle:
    'Android có cơ chế tự động tạm dừng ứng dụng để tiết kiệm pin, có thể làm chuông hẹn giờ bị trễ khi khóa màn hình.',
  steps: [
    '1. Mở Cài đặt (Settings) trên điện thoại.',
    '2. Tìm và chọn Ứng dụng (Apps) -> Trợ lý nấu ăn.',
    '3. Chọn mục "Pin" (Battery).',
    '4. Chuyển sang tùy chọn "Không hạn chế" (Unrestricted) hoặc "Không tối ưu hóa" (Don\'t optimize).',
    '5. Cho phép quyền "Báo thức & Nhắc nhở" (Alarms & Reminders) nếu máy yêu cầu.',
  ],
  samsungNote:
    'Đối với máy Samsung (OneUI): Vào Cài đặt -> Ứng dụng -> Trợ lý nấu ăn -> Pin -> chọn "Không hạn chế".',
  xiaomiNote:
    'Đối với máy Xiaomi (MIUI / HyperOS): Vào Cài đặt -> Ứng dụng -> Quản lý ứng dụng -> Trợ lý nấu ăn -> Tiết kiệm pin -> chọn "Không hạn chế", và bật "Tự khởi chạy" (Autostart).',
};

/**
 * Hiển thị hộp thoại hướng dẫn người dùng tắt tối ưu pin trên Android.
 */
export function showBatteryOptimizationAlert(): void {
  if (Platform.OS !== 'android') return;

  Alert.alert(
    BATTERY_OPTIMIZATION_GUIDE.title,
    `${BATTERY_OPTIMIZATION_GUIDE.subtitle}\n\n${BATTERY_OPTIMIZATION_GUIDE.steps.join('\n')}`,
    [
      {
        text: 'Đã hiểu',
        style: 'default',
      },
    ]
  );
}
