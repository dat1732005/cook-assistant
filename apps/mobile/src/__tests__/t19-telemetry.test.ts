/**
 * File: apps/mobile/src/__tests__/t19-telemetry.test.ts
 * Làm gì: Kiểm thử hệ thống đo lường ẩn danh T19 ở ứng dụng di động:
 *         - Ghi 6 loại sự kiện cục bộ vào SQLite và gửi lô POST /v1/events khi có mạng (T19.1, T19.2).
 *         - Tắt đo lường (opt-out) trong Cài đặt thì không ghi nhận và không gửi gì (T19.4).
 *         - Dữ liệu gửi đi chỉ dùng mã thiết bị ẩn danh, tuyệt đối không chứa trường nhạy cảm.
 * Nhận vào: NodeSqliteDriver trong bộ nhớ, TelemetryService, SessionService và mock fetch.
 * Trả ra: Kết quả kiểm thử tự động các ca T19.
 * Ai gọi: Vitest (`pnpm test`, `pnpm verify`).
 * Bám theo: docs/tasks.md mục T19 và docs/plan.md mục "Chỉ số thành công".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MigrationRunner, NodeSqliteDriver } from '@cook/core';
import {
  TelemetryService,
  assertBatchPayloadIsAnonymous,
  FORBIDDEN_SENSITIVE_FIELDS,
  TELEMETRY_ENABLED_METADATA_KEY,
  type RecordTelemetryEventInput,
} from '../services/telemetry-service.js';
import { setAnonymousDeviceIdForTesting } from '../services/ai-client.js';
import { STRINGS } from '../constants/strings.js';

describe('T19: Đo lường ẩn danh, gửi lô POST /v1/events và công tắc Cài đặt', () => {
  let driver: NodeSqliteDriver;

  beforeEach(async () => {
    setAnonymousDeviceIdForTesting('anon-device-t19');
    driver = new NodeSqliteDriver(':memory:');
    const runner = new MigrationRunner(driver);
    await runner.run();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await driver.close();
    vi.restoreAllMocks();
  });

  it('Tắt đo lường thì không ghi nhận và không gửi bất kỳ sự kiện nào lên backend (opt-out)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 1, deduplicated: 0 }),
    });
    global.fetch = mockFetch;

    const service = new TelemetryService({
      driver,
      baseUrl: 'http://test-backend',
      deviceId: 'anon-device-t19',
    });

    // Mặc định ban đầu đo lường đang bật
    expect(await service.isEnabled()).toBe(true);

    // Tạo sẵn một sự kiện lúc đang offline trước khi người dùng vào Cài đặt tắt đo lường
    await service.recordSessionStarted({
      sessionId: 'sess-queued-before-opt-out',
      recipeSlug: 'trung-chien-ca-chua',
    });
    expect((await service.getPendingEvents()).length).toBe(1);

    // Người dùng gạt công tắc tắt đo lường trong màn Cài đặt -> xóa hàng đợi chưa gửi và lưu vào SQLite
    await service.setEnabled(false);
    expect(await service.isEnabled()).toBe(false);

    // Một phiên bản TelemetryService mới đọc lại từ SQLite vẫn thấy trạng thái tắt
    const reopenedService = new TelemetryService({
      driver,
      baseUrl: 'http://test-backend',
      deviceId: 'anon-device-t19',
    });
    expect(await reopenedService.isEnabled()).toBe(false);

    // Thực hiện toàn bộ chuỗi sự kiện nấu ăn & AI khi đo lường đang tắt
    expect(
      await reopenedService.recordSessionStarted({
        sessionId: 'sess-opt-out-1',
        recipeSlug: 'trung-chien-ca-chua',
      })
    ).toBeNull();
    expect(
      await reopenedService.recordStepBack({
        sessionId: 'sess-opt-out-1',
        stepId: 'step-1',
        recipeSlug: 'trung-chien-ca-chua',
      })
    ).toBeNull();
    expect(
      await reopenedService.recordAiAsked({
        sessionId: 'sess-opt-out-1',
        aiKind: 'ask',
        helpful: true,
      })
    ).toBeNull();
    expect(
      await reopenedService.recordPantryAdjustedAfterCook({
        sessionId: 'sess-opt-out-1',
        recipeSlug: 'trung-chien-ca-chua',
      })
    ).toBeNull();
    expect(
      await reopenedService.recordSessionAbandoned({
        sessionId: 'sess-opt-out-1',
        stepId: 'step-2',
      })
    ).toBeNull();
    expect(
      await reopenedService.recordSessionCompleted({
        sessionId: 'sess-opt-out-1',
        recipeSlug: 'trung-chien-ca-chua',
      })
    ).toBeNull();

    // Khi có mạng và thử đồng bộ -> tuyệt đối không gọi POST /v1/events
    const flushRes = await reopenedService.flushPendingEvents({ isOnline: true });
    expect(flushRes.skippedReason).toBe('disabled');
    expect(flushRes.sent).toBe(0);
    expect(await reopenedService.getPendingEvents(true)).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();

    // Kiểm tra bản ghi app_metadata đã lưu đúng cờ tắt đo lường
    const metaRow = await driver.queryOne<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?;',
      [TELEMETRY_ENABLED_METADATA_KEY]
    );
    expect(metaRow?.value).toBe('false');
  });

  it('Dữ liệu gửi lên POST /v1/events dùng mã thiết bị ẩn danh và không chứa các trường nhạy cảm', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedRawBody = '';

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedRawBody = typeof init?.body === 'string' ? init.body : '';
      return {
        ok: true,
        status: 200,
        json: async () => ({ accepted: 2, deduplicated: 0 }),
      };
    });
    global.fetch = mockFetch;

    const service = new TelemetryService({
      driver,
      baseUrl: 'http://test-backend',
      deviceId: 'anon-device-t19',
    });

    // Cố tình truyền kèm dữ liệu nhạy cảm thông qua ép kiểu để kiểm tra bộ lọc whitelist
    const pollutedInput = {
      eventType: 'ai_asked',
      sessionId: 'sess-safe-1',
      recipeSlug: 'thit-kho-to',
      stepId: 'step-2',
      aiKind: 'ask',
      helpful: true,
      occurredAt: '2026-11-08T10:00:00Z',
      name: 'Nguyen Van Nhay Cam',
      display_name: 'Nguyen Van Nhay Cam',
      displayName: 'Nguyen Van Nhay Cam',
      allergies: ['peanut', 'crustacean'],
      dietary_preference: 'an-chay',
      question: 'Thịt bị mặn thì chữa thế nào?',
      answer: 'Cho thêm nước sôi.',
      prompt: 'Secret prompt text',
      comment: 'Sai rồi',
      ingredients: ['thit-ba-chi'],
      pantry: { 'nuoc-mam': 500 },
    } as unknown as RecordTelemetryEventInput;

    await service.recordEvent(pollutedInput);
    await service.recordSessionCompleted({
      sessionId: 'sess-safe-1',
      recipeSlug: 'thit-kho-to',
      occurredAt: '2026-11-08T10:15:00Z',
    });

    const flushRes = await service.flushPendingEvents({ isOnline: true });
    expect(flushRes.sent).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toBe('http://test-backend/v1/events');

    // Kiểm tra header dùng mã thiết bị ẩn danh, không có token hay thông tin cá nhân
    expect(capturedHeaders['X-Device-Id']).toBe('anon-device-t19');

    const parsedBody = JSON.parse(capturedRawBody) as {
      events: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(parsedBody.events)).toBe(true);
    expect(parsedBody.events).toHaveLength(2);

    // Mọi trường nhạy cảm và giá trị nhạy cảm đều không tồn tại trong payload gửi lên server
    for (const evt of parsedBody.events) {
      for (const sensitiveKey of FORBIDDEN_SENSITIVE_FIELDS) {
        expect(evt).not.toHaveProperty(sensitiveKey);
      }
      expect(Object.keys(evt).sort()).toEqual(
        expect.arrayContaining(['eventId', 'eventType', 'occurredAt'])
      );
    }

    expect(capturedRawBody).not.toContain('Nguyen Van Nhay Cam');
    expect(capturedRawBody).not.toContain('peanut');
    expect(capturedRawBody).not.toContain('crustacean');
    expect(capturedRawBody).not.toContain('an-chay');
    expect(capturedRawBody).not.toContain('Thịt bị mặn thì chữa thế nào?');
    expect(capturedRawBody).not.toContain('Cho thêm nước sôi.');

    // Hàm assertBatchPayloadIsAnonymous cũng phải chặn nếu payload bị chèn trường nhạy cảm trực tiếp
    expect(() =>
      assertBatchPayloadIsAnonymous({
        events: [
          {
            eventId: 'evt-leak',
            eventType: 'ai_asked',
            occurredAt: '2026-11-08T10:00:00Z',
            allergies: ['egg'],
          } as unknown as RecordTelemetryEventInput & { eventId: string; occurredAt: string },
        ],
      })
    ).toThrow(/nhạy cảm/);
  });

  it('Ghi nhận đủ 6 loại sự kiện cục bộ khi offline, cập nhật hữu ích AI và gửi lô khi có mạng', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accepted: 6, deduplicated: 0 }),
    });
    global.fetch = mockFetch;

    const service = new TelemetryService({
      driver,
      baseUrl: 'http://test-backend',
      deviceId: 'anon-device-offline-sync',
    });

    // Ghi cả 6 loại sự kiện T19.1 lúc đang mất mạng
    await service.recordSessionStarted({
      sessionId: 'sess-full-1',
      recipeSlug: 'trung-chien-ca-chua',
      occurredAt: '2026-11-08T08:00:00Z',
    });
    await service.recordStepBack({
      sessionId: 'sess-full-1',
      stepId: 's2',
      recipeSlug: 'trung-chien-ca-chua',
      occurredAt: '2026-11-08T08:02:00Z',
    });
    const aiEvt = await service.recordAiAsked({
      sessionId: 'sess-full-1',
      aiKind: 'substitute',
      recipeSlug: 'trung-chien-ca-chua',
      occurredAt: '2026-11-08T08:03:00Z',
    });
    expect(aiEvt).not.toBeNull();
    // Người dùng đánh giá hữu ích sau khi xem gợi ý AI
    expect(await service.updateAiHelpful(aiEvt!.eventId, true)).toBe(true);

    await service.recordPantryAdjustedAfterCook({
      sessionId: 'sess-full-1',
      recipeSlug: 'trung-chien-ca-chua',
      occurredAt: '2026-11-08T08:12:00Z',
    });
    await service.recordSessionCompleted({
      sessionId: 'sess-full-1',
      recipeSlug: 'trung-chien-ca-chua',
      occurredAt: '2026-11-08T08:11:00Z',
    });
    await service.recordSessionAbandoned({
      sessionId: 'sess-full-2',
      stepId: 's1',
      recipeSlug: 'canh-cai-thit-bam',
      occurredAt: '2026-11-08T09:00:00Z',
    });

    // Đang offline -> không gửi mạng, giữ đủ 6 sự kiện chờ trong SQLite
    const offlineRes = await service.flushPendingEvents({ isOnline: false });
    expect(offlineRes.skippedReason).toBe('offline');
    expect(offlineRes.remaining).toBe(6);
    expect(mockFetch).not.toHaveBeenCalled();

    // Khi có mạng trở lại -> gửi toàn bộ 6 sự kiện một lô
    const onlineRes = await service.flushPendingEvents({ isOnline: true });
    expect(onlineRes.sent).toBe(6);
    expect(onlineRes.remaining).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Hàng đợi chưa gửi bây giờ trống
    expect(await service.getPendingEvents(false)).toHaveLength(0);
    const allStored = await service.getPendingEvents(true);
    expect(allStored).toHaveLength(6);
    const storedAi = allStored.find((e) => e.eventType === 'ai_asked');
    expect(storedAi?.aiKind).toBe('substitute');
    expect(storedAi?.helpful).toBe(true);
  });

  it('Màn Cài đặt (STRINGS.settings) có đầy đủ công tắc đo lường và giải thích dữ liệu gửi/không gửi', () => {
    expect(STRINGS.home.settingsButtonText).toBe('Cài đặt');
    expect(STRINGS.settings.headerTitle).toBe('Cài đặt');
    expect(STRINGS.settings.telemetryToggleLabel.length).toBeGreaterThan(0);
    expect(STRINGS.settings.telemetryExplanation).toContain('ẩn danh');
    expect(STRINGS.settings.telemetryPrivacyGuarantee).toContain('KHÔNG');
    expect(STRINGS.settings.telemetryPrivacyGuarantee).toContain('dị ứng');
    expect(STRINGS.settings.telemetryPrivacyGuarantee).toContain('câu hỏi');
    expect(STRINGS.settings.telemetrySentListItems.length).toBeGreaterThanOrEqual(3);
    expect(STRINGS.settings.telemetryNeverSentItems.length).toBeGreaterThanOrEqual(2);
  });
});

