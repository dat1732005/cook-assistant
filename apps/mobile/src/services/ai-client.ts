/**
 * File: apps/mobile/src/services/ai-client.ts
 * Làm gì: Client gọi backend Spring Boot cho các tính năng AI (T17):
 *         - substitute(...): tư vấn thay thế hoặc bỏ nguyên liệu.
 *         - ask(...): hỏi nhanh khi đang nấu.
 *         - reportFeedback(...): báo câu trả lời sai (T18.4).
 *         - Nhận biết header X-AI-Mock: true để thông báo "(chế độ thử, không phải AI thật)".
 *         - Xử lý timeout (AbortController), mất mạng không treo app, không gián đoạn hẹn giờ.
 *         - Tự động gắn Header X-Device-Id (mã thiết bị ẩn danh).
 *         - Không chứa bất kỳ khóa API nào trong ứng dụng di động.
 * Nhận vào: DTO yêu cầu thay/bỏ nguyên liệu hoặc câu hỏi nấu ăn.
 * Trả ra: AiResult<T> có cờ success, cờ isMock, dữ liệu hoặc mã lỗi thân thiện ("Thử lại").
 * Ai gọi: RecipeDetailScreen / SubstituteModal ("Thay hoặc bỏ"), CookScreen (hỏi AI).
 * Bám theo: docs/tasks.md mục T17, T18.
 */

import { STRINGS } from '../constants/strings.js';

/** Tên HTTP header do backend trả về khi đang chạy chế độ AI giả lập (mock) */
export const AI_MOCK_HEADER_NAME = 'X-AI-Mock';

/** Thời gian chờ mặc định (mili-giây) cho mỗi lượt gọi AI, tránh treo giao diện khi mạng yếu */
const DEFAULT_AI_TIMEOUT_MS = 5000;

export interface SubstituteParams {
  recipeId: string;
  action: 'omit' | 'substitute';
  ingredientId: string;
  role?: string;
  flavorGroup?: string;
  allergies?: string[];
  knownIngredients?: string[];
  ingredientAllergens?: Record<string, string[]>;
  scenarioId?: string;
}

export interface SubstituteResultData {
  severity: 'low' | 'medium' | 'high';
  impact?: string;
  suggestions: string[];
  confirm_required?: boolean;
}

export interface AskParams {
  question: string;
  currentStep?: string;
  remainingSteps?: string[];
  scenarioId?: string;
}

export interface AskResultData {
  answer: string;
  action?: string | null;
}

export type AiErrorCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT'
  | 'FEATURE_DISABLED'
  | 'BAD_RESPONSE'
  | 'UNKNOWN';

export type AiResult<T> =
  | { success: true; data: T; isMock: boolean }
  | { success: false; errorCode: AiErrorCode; message: string; retryAfter?: number; isMock: boolean };

export interface AiClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  deviceId?: string;
}

// Bộ nhớ đệm ID thiết bị cục bộ cho phiên ứng dụng
let cachedDeviceId: string | null = null;

/**
 * Làm gì: Tạo một mã thiết bị ẩn danh ngẫu nhiên một lần và lưu tạm trong phiên để giới hạn lượt AI.
 * Vào: Không có.
 * Ra: Chuỗi mã thiết bị ẩn danh (không chứa thông tin cá nhân).
 * Ví dụ: "device_m1abc_x9k2p"
 * Gọi bởi: AiClient.constructor().
 */
export function getAnonymousDeviceId(): string {
  // Chỉ sinh mã mới khi chưa có mã lưu sẵn trong bộ nhớ đệm
  if (!cachedDeviceId) {
    const randomPart = Math.random().toString(36).substring(2, 10);
    cachedDeviceId = `device_${Date.now().toString(36)}_${randomPart}`;
  }
  return cachedDeviceId;
}

/**
 * Làm gì: Ghi đè mã thiết bị phục vụ kiểm thử đơn vị.
 * Vào: id (chuỗi mã thiết bị giả lập hoặc null để xóa).
 * Ra: Không có.
 * Gọi bởi: Bộ test Vitest (ai-client.test.ts, t18-screens.test.ts).
 */
export function setAnonymousDeviceIdForTesting(id: string | null): void {
  cachedDeviceId = id;
}

/**
 * Làm gì: Kiểm tra phản hồi HTTP từ backend có gắn header X-AI-Mock: true hay không.
 * Vào: headers (đối tượng Fetch Headers, map thuần hoặc undefined/null).
 * Ra: true nếu header X-AI-Mock mang giá trị "true" (không phân biệt hoa thường), ngược lại false.
 * Ví dụ: Headers({"X-AI-Mock": "true"}) -> true; Headers({}) -> false.
 * Gọi bởi: AiClient.postWithResilience().
 */
export function hasMockAiHeader(
  headers?: Pick<Headers, 'get'> | Record<string, string | undefined> | null
): boolean {
  // Thoát sớm khi phản hồi không có đối tượng headers
  if (!headers) {
    return false;
  }

  let rawValue: string | null | undefined;
  // Nhánh 1: headers chuẩn Fetch API có phương thức get()
  if (typeof (headers as Pick<Headers, 'get'>).get === 'function') {
    const fetchHeaders = headers as Pick<Headers, 'get'>;
    rawValue = fetchHeaders.get(AI_MOCK_HEADER_NAME) ?? fetchHeaders.get(AI_MOCK_HEADER_NAME.toLowerCase());
  } else {
    // Nhánh 2: headers dạng object key-value trong môi trường mock đơn giản
    const recordHeaders = headers as Record<string, string | undefined>;
    rawValue = recordHeaders[AI_MOCK_HEADER_NAME] ?? recordHeaders[AI_MOCK_HEADER_NAME.toLowerCase()];
  }

  return typeof rawValue === 'string' && rawValue.trim().toLowerCase() === 'true';
}

/**
 * Làm gì: Trả về dòng cảnh báo chế độ thử khi phản hồi AI xuất phát từ bản giả lập.
 * Vào: isMock (cờ đánh dấu bản giả từ header X-AI-Mock).
 * Ra: Chuỗi "(chế độ thử, không phải AI thật)" nếu isMock = true, hoặc null nếu là AI thật.
 * Ví dụ: formatAiMockNotice(true) -> "(chế độ thử, không phải AI thật)"; formatAiMockNotice(false) -> null.
 * Gọi bởi: SubstituteModal, CookScreen và unit test giao diện T18.
 */
export function formatAiMockNotice(isMock?: boolean): string | null {
  // Chỉ hiện cảnh báo khi có xác nhận phản hồi đến từ chế độ giả lập
  if (isMock === true) {
    return STRINGS.ai.mockNotice;
  }
  return null;
}

export class AiClient {
  private baseUrl: string;
  private timeoutMs: number;
  private deviceId: string;

  constructor(config: AiClientConfig = {}) {
    // Mặc định địa chỉ backend cục bộ; trong build production lấy từ process.env.EXPO_PUBLIC_BACKEND_URL
    this.baseUrl = config.baseUrl || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://10.0.2.2:8080';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
    this.deviceId = config.deviceId || getAnonymousDeviceId();
  }

  /**
   * Làm gì: Gọi backend tư vấn thay thế hoặc bỏ nguyên liệu.
   * Vào: params (SubstituteParams chứa món, hành động, nguyên liệu, dị ứng).
   * Ra: Promise<AiResult<SubstituteResultData>> kèm cờ isMock.
   * Gọi bởi: SubstituteModal.
   */
  async substitute(params: SubstituteParams): Promise<AiResult<SubstituteResultData>> {
    return this.postWithResilience<SubstituteResultData>('/v1/ai/substitute', params);
  }

  /**
   * Làm gì: Gọi backend hỏi đáp nhanh trong quá trình nấu.
   * Vào: params (AskParams chứa câu hỏi và bước hiện tại/còn lại).
   * Ra: Promise<AiResult<AskResultData>> kèm cờ isMock.
   * Gọi bởi: CookScreen.
   */
  async ask(params: AskParams): Promise<AiResult<AskResultData>> {
    return this.postWithResilience<AskResultData>('/v1/ai/ask', params);
  }

  /**
   * Làm gì: Gửi phản hồi "Câu trả lời sai" về hệ thống (T18.4).
   * Vào: feedbackData (câu hỏi, câu trả lời, mã nguyên liệu và nhận xét).
   * Ra: Promise<AiResult<{ status: string }>>.
   * Gọi bởi: SubstituteModal, CookScreen.
   */
  async reportFeedback(feedbackData: {
    question?: string;
    answer?: string;
    ingredientId?: string;
    comment?: string;
  }): Promise<AiResult<{ status: string }>> {
    return this.postWithResilience<{ status: string }>('/v1/ai/feedback', feedbackData);
  }

  /**
   * Làm gì: Gửi POST request với cơ chế ngắt khi quá thời gian (timeout) và bắt lỗi mạng an toàn,
   *         đảm bảo không bao giờ ném Exception làm treo màn hình hay gián đoạn hẹn giờ (T17.2).
   * Vào: endpoint (đường dẫn API), body (dữ liệu JSON gửi lên).
   * Ra: AiResult<T> có cờ isMock đọc từ header X-AI-Mock.
   * Gọi bởi: substitute(), ask(), reportFeedback().
   */
  private async postWithResilience<T>(endpoint: string, body: unknown): Promise<AiResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}${endpoint}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': this.deviceId,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const isMock = hasMockAiHeader(response.headers);

      // Xử lý vượt giới hạn lượt gọi AI (HTTP 429) để hẹn giờ và app tiếp tục bình thường
      if (response.status === 429) {
        const retryAfterHeader = response.headers?.get?.('Retry-After');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        return {
          success: false,
          errorCode: 'RATE_LIMIT',
          message: `Bạn đã vượt quá số lượt gọi AI. Vui lòng thử lại sau ${retryAfter} giây.`,
          retryAfter,
          isMock,
        };
      }

      // Xử lý khi tính năng hỏi đáp đang bị tắt theo cờ cấu hình backend (HTTP 403)
      if (response.status === 403) {
        return {
          success: false,
          errorCode: 'FEATURE_DISABLED',
          message: 'Tính năng hỏi đáp AI hiện đang tạm tắt.',
          isMock,
        };
      }

      // Xử lý các lỗi HTTP khác từ máy chủ
      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const errMsg = errorJson?.message || `Lỗi máy chủ (${response.status}).`;
        return {
          success: false,
          errorCode: response.status >= 500 ? 'BAD_RESPONSE' : 'UNKNOWN',
          message: errMsg,
          isMock,
        };
      }

      const data = (await response.json()) as T;
      return {
        success: true,
        data,
        isMock,
      };
    } catch (err: unknown) {
      clearTimeout(timer);

      // Phân biệt lỗi quá thời gian chờ với lỗi mất kết nối mạng
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('timeout')) {
          return {
            success: false,
            errorCode: 'TIMEOUT',
            message: 'Yêu cầu vượt quá thời gian chờ (5 giây). Vui lòng thử lại.',
            isMock: false,
          };
        }
      }

      // Lỗi mất mạng hoặc không kết nối được backend
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        message: 'Mất kết nối mạng hoặc không thể kết nối tới máy chủ. Vui lòng thử lại.',
        isMock: false,
      };
    }
  }
}

export const defaultAiClient = new AiClient();
