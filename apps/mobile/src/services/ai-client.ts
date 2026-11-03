/**
 * File: apps/mobile/src/services/ai-client.ts
 * Làm gì: Client gọi backend Spring Boot cho các tính năng AI (T17):
 *         - substitute(...): tư vấn thay thế hoặc bỏ nguyên liệu.
 *         - ask(...): hỏi nhanh khi đang nấu.
 *         - reportFeedback(...): báo câu trả lời sai (T18.4).
 *         - Xử lý timeout (AbortController), mất mạng không treo app, không gián đoạn hẹn giờ.
 *         - Tự động gắn Header X-Device-Id (mã thiết bị ẩn danh).
 *         - Không chứa bất kỳ khóa API nào trong ứng dụng di động.
 * Nhận vào: DTO yêu cầu thay/bỏ nguyên liệu hoặc câu hỏi nấu ăn.
 * Trả ra: AiResult<T> có cờ success, dữ liệu hoặc mã lỗi thân thiện ("Thử lại").
 * Ai gọi: RecipeDetailScreen ("Thay hoặc bỏ"), CookScreen (hỏi AI).
 * Bám theo: docs/tasks.md mục T17, T18.
 */

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
  | { success: true; data: T }
  | { success: false; errorCode: AiErrorCode; message: string; retryAfter?: number };

export interface AiClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  deviceId?: string;
}

// Bộ nhớ đệm ID thiết bị cục bộ cho phiên ứng dụng
let cachedDeviceId: string | null = null;

export function getAnonymousDeviceId(): string {
  if (!cachedDeviceId) {
    const randomPart = Math.random().toString(36).substring(2, 10);
    cachedDeviceId = `device_${Date.now().toString(36)}_${randomPart}`;
  }
  return cachedDeviceId;
}

export function setAnonymousDeviceIdForTesting(id: string | null): void {
  cachedDeviceId = id;
}

export class AiClient {
  private baseUrl: string;
  private timeoutMs: number;
  private deviceId: string;

  constructor(config: AiClientConfig = {}) {
    // Mặc định địa chỉ backend cục bộ; trong build production lấy từ process.env.EXPO_PUBLIC_BACKEND_URL
    this.baseUrl = config.baseUrl || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://10.0.2.2:8080';
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.deviceId = config.deviceId || getAnonymousDeviceId();
  }

  /**
   * Gọi backend tư vấn thay thế hoặc bỏ nguyên liệu.
   */
  async substitute(params: SubstituteParams): Promise<AiResult<SubstituteResultData>> {
    return this.postWithResilience<SubstituteResultData>('/v1/ai/substitute', params);
  }

  /**
   * Gọi backend hỏi đáp nhanh trong quá trình nấu.
   */
  async ask(params: AskParams): Promise<AiResult<AskResultData>> {
    return this.postWithResilience<AskResultData>('/v1/ai/ask', params);
  }

  /**
   * Gửi phản hồi "Câu trả lời sai" về hệ thống (T18.4).
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
   * Gửi POST request với cơ chế ngắt khi quá thời gian (timeout) và bắt lỗi mạng an toàn,
   * đảm bảo không bao giờ ném Exception làm treo màn hình hay gián đoạn hẹn giờ (T17.2).
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

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
        return {
          success: false,
          errorCode: 'RATE_LIMIT',
          message: `Bạn đã vượt quá số lượt gọi AI. Vui lòng thử lại sau ${retryAfter} giây.`,
          retryAfter,
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          errorCode: 'FEATURE_DISABLED',
          message: 'Tính năng hỏi đáp AI hiện đang tạm tắt.',
        };
      }

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const errMsg = errorJson?.message || `Lỗi máy chủ (${response.status}).`;
        return {
          success: false,
          errorCode: response.status >= 500 ? 'BAD_RESPONSE' : 'UNKNOWN',
          message: errMsg,
        };
      }

      const data = (await response.json()) as T;
      return {
        success: true,
        data,
      };
    } catch (err: unknown) {
      clearTimeout(timer);

      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('timeout')) {
          return {
            success: false,
            errorCode: 'TIMEOUT',
            message: 'Yêu cầu vượt quá thời gian chờ (5 giây). Vui lòng thử lại.',
          };
        }
      }

      // Lỗi mất mạng hoặc không kết nối được backend
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        message: 'Mất kết nối mạng hoặc không thể kết nối tới máy chủ. Vui lòng thử lại.',
      };
    }
  }
}

export const defaultAiClient = new AiClient();
