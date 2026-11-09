import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AiClient,
  formatAiMockNotice,
  setAnonymousDeviceIdForTesting,
} from '../services/ai-client';

describe('T17: AiClient trong ứng dụng di động', () => {
  beforeEach(() => {
    setAnonymousDeviceIdForTesting('test-device-uuid-1234');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('substitute thành công: gửi đúng X-Device-Id và trả về dữ liệu chuẩn', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        severity: 'low',
        impact: 'Có thể thay thế',
        suggestions: ['hanh-tay'],
        confirm_required: false,
      }),
    });
    global.fetch = mockFetch;

    const client = new AiClient({ baseUrl: 'http://localhost:8080' });
    const result = await client.substitute({
      recipeId: 'mon-1',
      action: 'substitute',
      ingredientId: 'hanh-la',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severity).toBe('low');
      expect(result.data.suggestions).toContain('hanh-tay');
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs?.[1].headers['X-Device-Id']).toBe('test-device-uuid-1234');
  });

  it('Quá giới hạn 429: trả về mã RATE_LIMIT và retryAfter từ header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '30' }),
      json: async () => ({ code: 'RATE_LIMIT_EXCEEDED' }),
    });
    global.fetch = mockFetch;

    const client = new AiClient({ baseUrl: 'http://localhost:8080' });
    const result = await client.ask({ question: 'Hỏi nhiều quá' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('RATE_LIMIT');
      expect(result.retryAfter).toBe(30);
      expect(result.message).toContain('30 giây');
    }
  });

  it('Mất mạng hoặc fetch bị lỗi: không throw exception, trả về NETWORK_ERROR để hiện "Thử lại"', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Network request failed'));
    global.fetch = mockFetch;

    const client = new AiClient({ baseUrl: 'http://localhost:8080' });
    const result = await client.substitute({
      recipeId: 'mon-2',
      action: 'omit',
      ingredientId: 'muoi',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('NETWORK_ERROR');
      expect(result.message).toContain('Mất kết nối mạng');
    }
  });

  it('Quá thời gian chờ (Timeout): ngắt request và trả về TIMEOUT', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    const mockFetch = vi.fn().mockRejectedValue(abortError);
    global.fetch = mockFetch;

    const client = new AiClient({ baseUrl: 'http://localhost:8080', timeoutMs: 100 });
    const result = await client.ask({ question: 'Hỏi lâu' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('TIMEOUT');
      expect(result.message).toContain('thời gian chờ');
    }
  });

  it('Tính năng hỏi đáp AI bị tắt (403): trả về FEATURE_DISABLED', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ code: 'FEATURE_DISABLED' }),
    });
    global.fetch = mockFetch;

    const client = new AiClient({ baseUrl: 'http://localhost:8080' });
    const result = await client.ask({ question: 'Hỏi khi tắt' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('FEATURE_DISABLED');
      expect(result.message).toContain('tạm tắt');
    }
  });

  it('Header X-AI-Mock: true -> đánh dấu isMock = true và formatAiMockNotice hiển thị đúng thông báo chế độ thử', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-AI-Mock': 'true' }),
      json: async () => ({
        severity: 'low',
        impact: 'Thử thay thế',
        suggestions: ['hanh-tay'],
        confirm_required: false,
      }),
    });
    global.fetch = mockFetch;

    const client = new AiClient({ baseUrl: 'http://localhost:8080' });
    const result = await client.substitute({
      recipeId: 'mon-1',
      action: 'substitute',
      ingredientId: 'hanh-la',
    });

    expect(result.success).toBe(true);
    expect(result.isMock).toBe(true);
    expect(formatAiMockNotice(result.isMock)).toBe('(chế độ thử, không phải AI thật)');
  });

  it('Không có header X-AI-Mock -> isMock = false và không hiển thị thông báo chế độ thử', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        answer: 'Đun sôi thêm 2 phút.',
        action: null,
      }),
    });
    global.fetch = mockFetch;

    const client = new AiClient({ baseUrl: 'http://localhost:8080' });
    const result = await client.ask({ question: 'Đun bao lâu?' });

    expect(result.success).toBe(true);
    expect(result.isMock).toBe(false);
    expect(formatAiMockNotice(result.isMock)).toBeNull();
  });
});
