/**
 * File: apps/mobile/src/services/telemetry-service.ts
 * Làm gì: Ghi nhận sự kiện ẩn danh cục bộ (T19.1), quản lý công tắc tắt đo lường (T19.4)
 *         và gửi lô sự kiện không chứa thông tin nhạy cảm lên POST /v1/events khi có mạng (T19.2).
 * Nhận vào: SqlDriver (tùy chọn), baseUrl, deviceId và các hàm ghi nhận sự kiện nấu ăn / AI / kho.
 * Trả ra: Trạng thái đo lường, hàng đợi cục bộ và kết quả đồng bộ lên backend.
 * Ai gọi: App.tsx, SettingsScreen, CookScreen, SubstituteModal, FinishScreen, t19-telemetry.test.ts.
 * Bám theo: docs/tasks.md mục T19 và docs/plan.md mục "Chỉ số thành công".
 */

import type { SqlDriver } from '@cook/core';
import { getAnonymousDeviceId } from './ai-client.js';
import { getAppConfig } from '../config/env.js';

/** Khóa lưu trạng thái bật/tắt đo lường trong bảng app_metadata */
export const TELEMETRY_ENABLED_METADATA_KEY = 'telemetry_enabled';

/** Thời gian chờ tối đa (ms) khi gửi lô sự kiện để không chặn thao tác nấu */
const DEFAULT_TELEMETRY_TIMEOUT_MS = 5000;

/** Số sự kiện tối đa trong mỗi lần gửi lô lên backend */
const DEFAULT_MAX_BATCH_SIZE = 50;

/** Danh sách 6 loại sự kiện ẩn danh hợp lệ theo T19.1 */
export const TELEMETRY_EVENT_TYPES = [
  'session_started',
  'session_completed',
  'step_back',
  'session_abandoned',
  'pantry_adjusted_after_cook',
  'ai_asked',
] as const;

export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];
export type TelemetryAiKind = 'substitute' | 'ask';

/** Danh sách trường nhạy cảm tuyệt đối bị cấm xuất hiện trong payload gửi đi */
export const FORBIDDEN_SENSITIVE_FIELDS = [
  'name',
  'display_name',
  'displayName',
  'allergies',
  'dietary_preference',
  'dietaryPreference',
  'question',
  'answer',
  'prompt',
  'comment',
  'feedbackText',
  'ingredients',
  'pantry',
  'userProfile',
  'user_profile',
] as const;

/** Tập các khóa duy nhất được phép gửi ra ngoài mạng ở mỗi sự kiện */
const ALLOWED_WIRE_EVENT_KEYS = new Set<string>([
  'eventId',
  'eventType',
  'sessionId',
  'recipeSlug',
  'stepId',
  'aiKind',
  'helpful',
  'occurredAt',
]);

export interface LocalTelemetryEvent {
  eventId: string;
  eventType: TelemetryEventType;
  sessionId?: string;
  recipeSlug?: string;
  stepId?: string;
  aiKind?: TelemetryAiKind;
  helpful?: boolean;
  occurredAt: string;
  synced: number;
}

export interface WireTelemetryEvent {
  eventId: string;
  eventType: TelemetryEventType;
  sessionId?: string;
  recipeSlug?: string;
  stepId?: string;
  aiKind?: TelemetryAiKind;
  helpful?: boolean;
  occurredAt: string;
}

export interface RecordTelemetryEventInput {
  eventId?: string;
  eventType: TelemetryEventType;
  sessionId?: string;
  recipeSlug?: string;
  stepId?: string;
  aiKind?: TelemetryAiKind;
  helpful?: boolean;
  occurredAt?: string;
}

export interface TelemetryServiceConfig {
  driver?: SqlDriver;
  baseUrl?: string;
  timeoutMs?: number;
  deviceId?: string;
  defaultEnabled?: boolean;
  isOnlineProvider?: () => boolean | Promise<boolean>;
}

export interface FlushTelemetryResult {
  sent: number;
  deduplicated: number;
  remaining: number;
  skippedReason?: 'disabled' | 'offline' | 'empty' | 'network_error';
}

/**
 * Làm gì: Tạo mã định danh duy nhất cho một sự kiện đo lường cục bộ.
 * Vào: Không có.
 * Ra: Chuỗi eventId duy nhất (không chứa thông tin cá nhân).
 * Ví dụ: "evt_m3abc_k9p2q1".
 * Gọi bởi: TelemetryService.recordEvent().
 */
function generateEventId(): string {
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  return `evt_${Date.now().toString(36)}_${randomSuffix}`;
}

/**
 * Làm gì: Đóng gói đối tượng sự kiện theo danh sách whitelist nghiêm ngặt để loại trừ mọi trường nhạy cảm.
 * Vào: event (dữ liệu đầu vào có thể bị truyền dư trường nhạy cảm).
 * Ra: WireTelemetryEvent chỉ gồm đúng các trường ẩn danh cho phép.
 * Ví dụ: Input có { eventType: 'ai_asked', aiKind: 'ask', allergies: ['peanut'], question: '...' } -> chỉ giữ eventId, eventType, aiKind, occurredAt.
 * Gọi bởi: TelemetryService.recordEvent() và TelemetryService.buildBatchWirePayload().
 */
export function buildSafeWireEvent(event: WireTelemetryEvent): WireTelemetryEvent {
  const safe: WireTelemetryEvent = {
    eventId: String(event.eventId),
    eventType: event.eventType,
    occurredAt: String(event.occurredAt),
  };

  // Chỉ sao chép có chọn lọc từng trường ẩn danh không định danh cá nhân
  if (typeof event.sessionId === 'string' && event.sessionId.trim().length > 0) {
    safe.sessionId = event.sessionId.trim();
  }
  if (typeof event.recipeSlug === 'string' && event.recipeSlug.trim().length > 0) {
    safe.recipeSlug = event.recipeSlug.trim();
  }
  if (typeof event.stepId === 'string' && event.stepId.trim().length > 0) {
    safe.stepId = event.stepId.trim();
  }
  if (event.aiKind === 'substitute' || event.aiKind === 'ask') {
    safe.aiKind = event.aiKind;
  }
  if (typeof event.helpful === 'boolean') {
    safe.helpful = event.helpful;
  }

  return safe;
}

/**
 * Làm gì: Rà soát bảo vệ tầng cuối bảo đảm JSON gửi lên POST /v1/events hoàn toàn sạch trường nhạy cảm.
 * Vào: payload (đối tượng { events: WireTelemetryEvent[] }).
 * Ra: true nếu hợp lệ; ném Error nếu phát hiện khóa nhạy cảm hoặc khóa ngoài whitelist.
 * Ví dụ: Nếu event lọt trường "allergies" hoặc "question" -> ném Error ngay trước khi gọi fetch.
 * Gọi bởi: TelemetryService.flushPendingEvents() và test T19.
 */
export function assertBatchPayloadIsAnonymous(payload: { events: WireTelemetryEvent[] }): boolean {
  const topLevelKeys = Object.keys(payload);
  // Chỉ cho phép duy nhất khóa "events" ở cấp gốc của payload
  if (topLevelKeys.length !== 1 || topLevelKeys[0] !== 'events') {
    throw new Error(`Payload đo lường chứa khóa cấp gốc không hợp lệ: ${topLevelKeys.join(', ')}`);
  }

  for (const evt of payload.events) {
    const keys = Object.keys(evt);
    // Kiểm tra từng khóa trong mỗi sự kiện so với danh sách nhạy cảm và danh sách cho phép
    for (const key of keys) {
      if ((FORBIDDEN_SENSITIVE_FIELDS as readonly string[]).includes(key)) {
        throw new Error(`Phát hiện trường nhạy cảm bị cấm trong payload đo lường: ${key}`);
      }
      if (!ALLOWED_WIRE_EVENT_KEYS.has(key)) {
        throw new Error(`Phát hiện trường ngoài whitelist trong payload đo lường: ${key}`);
      }
    }
  }

  return true;
}

export class TelemetryService {
  private driver?: SqlDriver;
  private explicitBaseUrl?: string;
  private timeoutMs: number;
  private deviceId: string;
  private enabledInMemory: boolean;
  private isOnlineProvider?: () => boolean | Promise<boolean>;
  private inMemoryQueue: LocalTelemetryEvent[] = [];
  private schemaReady: boolean = false;

  constructor(config: TelemetryServiceConfig = {}) {
    this.driver = config.driver;
    // Dùng địa chỉ truyền tường minh khi kiểm thử hoặc đọc từ Constants.expoConfig.extra lúc chạy thật
    this.explicitBaseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TELEMETRY_TIMEOUT_MS;
    this.deviceId = config.deviceId || getAnonymousDeviceId();
    this.enabledInMemory = config.defaultEnabled ?? true;
    this.isOnlineProvider = config.isOnlineProvider;
  }

  /**
   * Làm gì: Lấy địa chỉ gốc máy chủ backend từ cấu hình kiểm thử hoặc Constants.expoConfig.extra (T20.1).
   * Vào: Không có.
   * Ra: Chuỗi baseUrl đã bỏ dấu '/' thừa ở cuối.
   * Gọi bởi: flushPendingEvents() và unit test t20-config.test.ts.
   */
  getResolvedBaseUrl(): string {
    const raw = this.explicitBaseUrl ?? getAppConfig().apiBaseUrl;
    return raw.trim().replace(/\/+$/, '');
  }

  /**
   * Làm gì: Khởi tạo bảng hàng đợi đo lường cục bộ và bảng metadata khi dùng SQLite.
   * Vào: Không có.
   * Ra: Promise<void>.
   * Ví dụ: Gọi khi khởi động app hoặc trước các thao tác SQLite đầu tiên.
   * Gọi bởi: isEnabled(), setEnabled(), recordEvent(), getPendingEvents(), flushPendingEvents().
   */
  async init(): Promise<void> {
    // Nếu chạy thuần trong bộ nhớ hoặc đã khởi tạo schema rồi thì bỏ qua
    if (!this.driver || this.schemaReady) {
      return;
    }

    await this.driver.execute(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await this.driver.execute(`
      CREATE TABLE IF NOT EXISTS local_telemetry_event (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        session_id TEXT,
        recipe_slug TEXT,
        step_id TEXT,
        ai_kind TEXT,
        helpful INTEGER,
        occurred_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0
      );
    `);

    this.schemaReady = true;
  }

  /**
   * Làm gì: Kiểm tra người dùng hiện đang bật hay tắt công tắc đo lường ẩn danh (T19.4).
   * Vào: Không có.
   * Ra: Promise<boolean> (true nếu đang bật, false nếu đã tắt đo lường).
   * Ví dụ: Khi app_metadata['telemetry_enabled'] = 'false' -> trả về false.
   * Gọi bởi: SettingsScreen, recordEvent(), updateAiHelpful(), flushPendingEvents().
   */
  async isEnabled(): Promise<boolean> {
    // Nếu không gắn SqlDriver, trả về trạng thái đang giữ trong bộ nhớ
    if (!this.driver) {
      return this.enabledInMemory;
    }

    await this.init();
    const row = await this.driver.queryOne<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?;',
      [TELEMETRY_ENABLED_METADATA_KEY]
    );

    // Nếu người dùng chưa từng gạt công tắc, dùng giá trị mặc định ban đầu
    if (!row) {
      return this.enabledInMemory;
    }

    return row.value !== 'false';
  }

  /**
   * Làm gì: Bật hoặc tắt đo lường ẩn danh (khi tắt sẽ xóa ngay hàng đợi chưa gửi) (T19.4).
   * Vào: enabled (true để cho phép đo lường, false để tắt hoàn toàn).
   * Ra: Promise<boolean> trạng thái sau khi lưu.
   * Ví dụ: setEnabled(false) -> lưu 'false' vào app_metadata và xóa sạch các sự kiện chưa gửi.
   * Gọi bởi: SettingsScreen và unit test T19.
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    this.enabledInMemory = enabled;

    // Khi người dùng tắt đo lường, xóa toàn bộ hàng đợi cục bộ chưa gửi để bảo đảm không gửi nhầm sau này
    if (!enabled) {
      this.inMemoryQueue = [];
    }

    if (this.driver) {
      await this.init();
      await this.driver.execute(
        `INSERT INTO app_metadata (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        [TELEMETRY_ENABLED_METADATA_KEY, enabled ? 'true' : 'false']
      );

      if (!enabled) {
        await this.driver.execute('DELETE FROM local_telemetry_event WHERE synced = 0;');
      }
    }

    return enabled;
  }

  /**
   * Làm gì: Ghi một sự kiện đo lường ẩn danh vào hàng đợi cục bộ nếu đo lường đang bật (T19.1).
   * Vào: input (RecordTelemetryEventInput gồm eventType và ngữ cảnh tối giản phi nhạy cảm).
   * Ra: LocalTelemetryEvent vừa ghi hoặc null nếu người dùng đã tắt đo lường.
   * Ví dụ: recordEvent({ eventType: 'session_started', sessionId: 's1', recipeSlug: 'mon-1' }).
   * Gọi bởi: Các hàm recordSessionStarted, recordStepBack, recordAiAsked...
   */
  async recordEvent(input: RecordTelemetryEventInput): Promise<LocalTelemetryEvent | null> {
    const enabled = await this.isEnabled();
    // Thoát sớm ngay lập tức nếu người dùng đã tắt đo lường
    if (!enabled) {
      return null;
    }

    if (!TELEMETRY_EVENT_TYPES.includes(input.eventType)) {
      throw new Error(`Loại sự kiện đo lường không hợp lệ: ${input.eventType}`);
    }

    const safeWire = buildSafeWireEvent({
      eventId: input.eventId || generateEventId(),
      eventType: input.eventType,
      sessionId: input.sessionId,
      recipeSlug: input.recipeSlug,
      stepId: input.stepId,
      aiKind: input.aiKind,
      helpful: input.helpful,
      occurredAt: input.occurredAt || new Date().toISOString(),
    });

    const record: LocalTelemetryEvent = {
      ...safeWire,
      synced: 0,
    };

    // Lưu vào SQLite nếu có driver, ngược lại đẩy vào hàng đợi trong bộ nhớ
    if (this.driver) {
      await this.init();
      await this.driver.execute(
        `INSERT OR REPLACE INTO local_telemetry_event (
          event_id, event_type, session_id, recipe_slug, step_id, ai_kind, helpful, occurred_at, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);`,
        [
          record.eventId,
          record.eventType,
          record.sessionId ?? null,
          record.recipeSlug ?? null,
          record.stepId ?? null,
          record.aiKind ?? null,
          typeof record.helpful === 'boolean' ? (record.helpful ? 1 : 0) : null,
          record.occurredAt,
        ]
      );
    } else {
      const existingIdx = this.inMemoryQueue.findIndex((e) => e.eventId === record.eventId);
      if (existingIdx >= 0) {
        this.inMemoryQueue[existingIdx] = record;
      } else {
        this.inMemoryQueue.push(record);
      }
    }

    return record;
  }

  /**
   * Làm gì: Ghi sự kiện bắt đầu một phiên nấu ăn (T19.1).
   * Vào: sessionId (mã phiên cục bộ), recipeSlug (slug món ăn), occurredAt (tùy chọn ISO-8601).
   * Ra: LocalTelemetryEvent hoặc null nếu tắt đo lường.
   * Gọi bởi: CookScreen khi khởi tạo phiên nấu mới.
   */
  async recordSessionStarted(params: {
    sessionId: string;
    recipeSlug?: string;
    occurredAt?: string;
  }): Promise<LocalTelemetryEvent | null> {
    return this.recordEvent({
      eventType: 'session_started',
      sessionId: params.sessionId,
      recipeSlug: params.recipeSlug,
      occurredAt: params.occurredAt,
    });
  }

  /**
   * Làm gì: Ghi sự kiện hoàn tất phiên nấu ăn (T19.1).
   * Vào: sessionId, recipeSlug, occurredAt.
   * Ra: LocalTelemetryEvent hoặc null nếu tắt đo lường.
   * Gọi bởi: CookScreen khi mọi bước hoàn thành.
   */
  async recordSessionCompleted(params: {
    sessionId: string;
    recipeSlug?: string;
    occurredAt?: string;
  }): Promise<LocalTelemetryEvent | null> {
    return this.recordEvent({
      eventType: 'session_completed',
      sessionId: params.sessionId,
      recipeSlug: params.recipeSlug,
      occurredAt: params.occurredAt,
    });
  }

  /**
   * Làm gì: Ghi sự kiện người dùng bấm lùi lại bước trước trong phiên nấu (T19.1).
   * Vào: sessionId, stepId, recipeSlug, occurredAt.
   * Ra: LocalTelemetryEvent hoặc null nếu tắt đo lường.
   * Gọi bởi: CookScreen khi người dùng bấm nút Lùi bước.
   */
  async recordStepBack(params: {
    sessionId?: string;
    stepId: string;
    recipeSlug?: string;
    occurredAt?: string;
  }): Promise<LocalTelemetryEvent | null> {
    return this.recordEvent({
      eventType: 'step_back',
      sessionId: params.sessionId,
      stepId: params.stepId,
      recipeSlug: params.recipeSlug,
      occurredAt: params.occurredAt,
    });
  }

  /**
   * Làm gì: Ghi sự kiện người dùng bỏ dở / thoát giữa chừng phiên nấu (T19.1).
   * Vào: sessionId, stepId (bước hiện tại nếu có), recipeSlug, occurredAt.
   * Ra: LocalTelemetryEvent hoặc null nếu tắt đo lường.
   * Gọi bởi: CookScreen khi người dùng xác nhận bỏ dở phiên.
   */
  async recordSessionAbandoned(params: {
    sessionId?: string;
    stepId?: string;
    recipeSlug?: string;
    occurredAt?: string;
  }): Promise<LocalTelemetryEvent | null> {
    return this.recordEvent({
      eventType: 'session_abandoned',
      sessionId: params.sessionId,
      stepId: params.stepId,
      recipeSlug: params.recipeSlug,
      occurredAt: params.occurredAt,
    });
  }

  /**
   * Làm gì: Ghi sự kiện người dùng sửa nhanh số lượng kho sau khi nấu ở màn Hoàn tất (T19.1).
   * Vào: sessionId, recipeSlug, occurredAt.
   * Ra: LocalTelemetryEvent hoặc null nếu tắt đo lường.
   * Gọi bởi: FinishScreen.saveEdit().
   */
  async recordPantryAdjustedAfterCook(params: {
    sessionId?: string;
    recipeSlug?: string;
    occurredAt?: string;
  }): Promise<LocalTelemetryEvent | null> {
    return this.recordEvent({
      eventType: 'pantry_adjusted_after_cook',
      sessionId: params.sessionId,
      recipeSlug: params.recipeSlug,
      occurredAt: params.occurredAt,
    });
  }

  /**
   * Làm gì: Ghi sự kiện một lượt hỏi AI (không lưu nội dung câu hỏi/câu trả lời) kèm đánh giá hữu ích (T19.1).
   * Vào: aiKind ('substitute' | 'ask'), helpful (boolean tùy chọn), sessionId, stepId, recipeSlug.
   * Ra: LocalTelemetryEvent (chứa eventId để cập nhật hữu ích sau nếu người dùng bấm) hoặc null.
   * Gọi bởi: SubstituteModal và CookScreen.
   */
  async recordAiAsked(params: {
    aiKind: TelemetryAiKind;
    helpful?: boolean;
    sessionId?: string;
    stepId?: string;
    recipeSlug?: string;
    occurredAt?: string;
  }): Promise<LocalTelemetryEvent | null> {
    return this.recordEvent({
      eventType: 'ai_asked',
      aiKind: params.aiKind,
      helpful: params.helpful,
      sessionId: params.sessionId,
      stepId: params.stepId,
      recipeSlug: params.recipeSlug,
      occurredAt: params.occurredAt,
    });
  }

  /**
   * Làm gì: Cập nhật đánh giá "hữu ích" hoặc "không hữu ích" cho lượt hỏi AI đã ghi trước đó (T19.1).
   * Vào: eventId (mã sự kiện ai_asked), helpful (true = hữu ích, false = sai/không hữu ích).
   * Ra: true nếu cập nhật thành công, false nếu tắt đo lường hoặc không tìm thấy sự kiện.
   * Gọi bởi: SubstituteModal và CookScreen khi bấm nút Hữu ích hoặc Câu trả lời sai.
   */
  async updateAiHelpful(eventId: string, helpful: boolean): Promise<boolean> {
    const enabled = await this.isEnabled();
    // Không cập nhật nếu người dùng đã tắt đo lường
    if (!enabled || !eventId) {
      return false;
    }

    if (this.driver) {
      await this.init();
      const existing = await this.driver.queryOne<{ event_id: string }>(
        'SELECT event_id FROM local_telemetry_event WHERE event_id = ?;',
        [eventId]
      );
      if (!existing) {
        return false;
      }
      await this.driver.execute(
        'UPDATE local_telemetry_event SET helpful = ?, synced = 0 WHERE event_id = ?;',
        [helpful ? 1 : 0, eventId]
      );
      return true;
    }

    const found = this.inMemoryQueue.find((e) => e.eventId === eventId);
    if (!found) {
      return false;
    }
    found.helpful = helpful;
    found.synced = 0;
    return true;
  }

  /**
   * Làm gì: Lấy danh sách sự kiện đang chờ đồng bộ trong hàng đợi cục bộ.
   * Vào: includeSynced (mặc định false để chỉ lấy sự kiện chưa gửi).
   * Ra: Mảng LocalTelemetryEvent.
   * Gọi bởi: flushPendingEvents() và bộ test T19.
   */
  async getPendingEvents(includeSynced: boolean = false): Promise<LocalTelemetryEvent[]> {
    if (this.driver) {
      await this.init();
      const sql = includeSynced
        ? 'SELECT * FROM local_telemetry_event ORDER BY occurred_at ASC;'
        : 'SELECT * FROM local_telemetry_event WHERE synced = 0 ORDER BY occurred_at ASC;';
      const rows = await this.driver.query<{
        event_id: string;
        event_type: TelemetryEventType;
        session_id: string | null;
        recipe_slug: string | null;
        step_id: string | null;
        ai_kind: TelemetryAiKind | null;
        helpful: number | null;
        occurred_at: string;
        synced: number;
      }>(sql);

      return rows.map((r) =>
        ({
          ...buildSafeWireEvent({
            eventId: r.event_id,
            eventType: r.event_type,
            sessionId: r.session_id ?? undefined,
            recipeSlug: r.recipe_slug ?? undefined,
            stepId: r.step_id ?? undefined,
            aiKind: r.ai_kind ?? undefined,
            helpful: r.helpful === null ? undefined : r.helpful === 1,
            occurredAt: r.occurred_at,
          }),
          synced: r.synced,
        })
      );
    }

    if (includeSynced) {
      return [...this.inMemoryQueue];
    }
    return this.inMemoryQueue.filter((e) => e.synced === 0);
  }

  /**
   * Làm gì: Gửi lô sự kiện ẩn danh chưa đồng bộ lên endpoint POST /v1/events khi có mạng (T19.2).
   * Vào: options ({ isOnline } tùy chọn để ép trạng thái mạng khi kiểm thử).
   * Ra: FlushTelemetryResult gồm số sự kiện đã gửi, trùng lặp và số còn tồn.
   * Ví dụ: Khi offline -> skippedReason='offline' và không gọi fetch; khi tắt đo lường -> skippedReason='disabled'.
   * Gọi bởi: App.tsx, CookScreen, FinishScreen, SubstituteModal và t19-telemetry.test.ts.
   */
  async flushPendingEvents(options?: { isOnline?: boolean }): Promise<FlushTelemetryResult> {
    const enabled = await this.isEnabled();
    // Tuyệt đối không gửi bất kỳ dữ liệu nào lên mạng khi công tắc đo lường đang tắt
    if (!enabled) {
      return {
        sent: 0,
        deduplicated: 0,
        remaining: 0,
        skippedReason: 'disabled',
      };
    }

    const pendingAll = await this.getPendingEvents(false);
    // Không gọi mạng khi hàng đợi trống
    if (pendingAll.length === 0) {
      return {
        sent: 0,
        deduplicated: 0,
        remaining: 0,
        skippedReason: 'empty',
      };
    }

    let isOnline = options?.isOnline;
    if (isOnline === undefined && this.isOnlineProvider) {
      isOnline = await this.isOnlineProvider();
    }
    if (isOnline === undefined) {
      isOnline = true;
    }

    // Nếu đang mất mạng thì giữ nguyên hàng đợi cục bộ để gửi bù sau
    if (!isOnline) {
      return {
        sent: 0,
        deduplicated: 0,
        remaining: pendingAll.length,
        skippedReason: 'offline',
      };
    }

    const batch = pendingAll.slice(0, DEFAULT_MAX_BATCH_SIZE);
    const wireEvents = batch.map((e) => buildSafeWireEvent(e));
    const payload = { events: wireEvents };

    // Kiểm tra chốt chặn an toàn trước khi đưa lên kết nối mạng
    assertBatchPayloadIsAnonymous(payload);

    const resolvedBaseUrl = this.getResolvedBaseUrl();
    // Nếu chưa có địa chỉ máy chủ backend trong cấu hình build thì giữ sự kiện ở hàng đợi cục bộ
    if (!resolvedBaseUrl) {
      return {
        sent: 0,
        deduplicated: 0,
        remaining: pendingAll.length,
        skippedReason: 'network_error',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const url = `${resolvedBaseUrl}/v1/events`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': this.deviceId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return {
          sent: 0,
          deduplicated: 0,
          remaining: pendingAll.length,
          skippedReason: 'network_error',
        };
      }

      const body = (await response.json().catch(() => ({}))) as {
        accepted?: number;
        deduplicated?: number;
      };

      // Đánh dấu các sự kiện trong lô đã gửi thành công (synced = 1)
      const sentIds = batch.map((e) => e.eventId);
      await this.markEventsAsSynced(sentIds);

      return {
        sent: body.accepted ?? batch.length,
        deduplicated: body.deduplicated ?? 0,
        remaining: Math.max(0, pendingAll.length - batch.length),
      };
    } catch {
      clearTimeout(timer);
      return {
        sent: 0,
        deduplicated: 0,
        remaining: pendingAll.length,
        skippedReason: 'network_error',
      };
    }
  }

  /**
   * Làm gì: Đánh dấu danh sách eventId đã được backend tiếp nhận thành công để không gửi lặp.
   * Vào: eventIds (danh sách mã sự kiện đã gửi).
   * Ra: Promise<void>.
   * Gọi bởi: flushPendingEvents().
   */
  private async markEventsAsSynced(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) {
      return;
    }

    if (this.driver) {
      await this.init();
      for (const id of eventIds) {
        await this.driver.execute(
          'UPDATE local_telemetry_event SET synced = 1 WHERE event_id = ?;',
          [id]
        );
      }
      return;
    }

    const sentSet = new Set(eventIds);
    for (const evt of this.inMemoryQueue) {
      if (sentSet.has(evt.eventId)) {
        evt.synced = 1;
      }
    }
  }
}

