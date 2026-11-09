/**
 * File: apps/mobile/src/__tests__/t20b-keep-awake-feedback.test.ts
 * Làm gì: Kiểm thử đơn vị cho T20b phía ứng dụng di động:
 *         1. Giữ sáng màn hình expo-keep-awake thông qua bản giả: bật khi vào phiên nấu,
 *            tắt khi hoàn tất ('done'), thoát/bỏ dở ('abandoned' / exited) hoặc tắt công tắc.
 *         2. AiClient.reportFeedback gọi POST /v1/ai/feedback chỉ gửi X-Device-Id, feedbackType,
 *            questionId và tuyệt đối không gửi nội dung câu hỏi hay câu trả lời.
 * Nhận vào: keep-awake-service, expo-keep-awake mock, AiClient và mock fetch.
 * Trả ra: Kết quả kiểm thử Vitest cho vòng đời keep-awake và phản hồi AI sai.
 * Ai gọi: `pnpm test`, `pnpm verify`.
 * Bám theo: Yêu cầu T20b mục (1) và (2).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  COOK_SESSION_KEEP_AWAKE_TAG,
  shouldKeepScreenAwakeForSession,
  syncCookKeepAwake,
  disableCookKeepAwake,
  enableCookKeepAwake,
} from '../services/keep-awake-service.js';
import {
  resetKeepAwakeMock,
  isKeepAwakeActiveForTest,
  getKeepAwakeHistoryForTest,
} from '../test-mocks/expo-keep-awake.js';
import {
  AiClient,
  FORBIDDEN_FEEDBACK_FIELDS,
  generateAnonymousQuestionId,
  setAnonymousDeviceIdForTesting,
} from '../services/ai-client.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const cookScreenPath = path.resolve(currentDir, '../screens/CookScreen.tsx');
const substituteModalPath = path.resolve(currentDir, '../screens/SubstituteModal.tsx');

describe('T20b: Tích hợp expo-keep-awake (bản giả) và POST /v1/ai/feedback', () => {
  beforeEach(() => {
    resetKeepAwakeMock();
    setAnonymousDeviceIdForTesting('anon-device-t20b');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetKeepAwakeMock();
    vi.restoreAllMocks();
  });

  describe('1. Giữ sáng màn hình (expo-keep-awake mock) theo vòng đời phiên nấu CookScreen', () => {
    it('Bật keep-awake khi vào phiên nấu và tắt ngay khi hoàn tất món ăn', async () => {
      // Vừa vào CookScreen (chưa xong snapshot) -> bật giữ sáng
      const onEnter = await syncCookKeepAwake({
        sessionStatus: undefined,
        userPreferenceEnabled: true,
        isExited: false,
      });
      expect(onEnter).toBe(true);
      expect(isKeepAwakeActiveForTest(COOK_SESSION_KEEP_AWAKE_TAG)).toBe(true);

      // Khi phiên chuyển sang 'cooking' -> vẫn giữ sáng
      const whileCooking = await syncCookKeepAwake({
        sessionStatus: 'cooking',
        userPreferenceEnabled: true,
        isExited: false,
      });
      expect(whileCooking).toBe(true);
      expect(isKeepAwakeActiveForTest(COOK_SESSION_KEEP_AWAKE_TAG)).toBe(true);

      // Khi hoàn tất mọi bước ('done') -> tự động gọi deactivateKeepAwake và tắt giữ sáng
      const onDone = await syncCookKeepAwake({
        sessionStatus: 'done',
        userPreferenceEnabled: true,
        isExited: false,
      });
      expect(onDone).toBe(false);
      expect(isKeepAwakeActiveForTest(COOK_SESSION_KEEP_AWAKE_TAG)).toBe(false);

      const history = getKeepAwakeHistoryForTest();
      expect(history[0]).toEqual({ action: 'activate', tag: COOK_SESSION_KEEP_AWAKE_TAG });
      expect(history[history.length - 1]).toEqual({
        action: 'deactivate',
        tag: COOK_SESSION_KEEP_AWAKE_TAG,
      });
    });

    it('Tắt keep-awake ngay khi người dùng thoát, bỏ dở phiên hoặc tắt công tắc trên màn nấu', async () => {
      await enableCookKeepAwake();
      expect(isKeepAwakeActiveForTest(COOK_SESSION_KEEP_AWAKE_TAG)).toBe(true);

      // Tắt công tắc giữ sáng trong khi đang nấu -> deactivate
      expect(
        await syncCookKeepAwake({
          sessionStatus: 'cooking',
          userPreferenceEnabled: false,
          isExited: false,
        })
      ).toBe(false);
      expect(isKeepAwakeActiveForTest(COOK_SESSION_KEEP_AWAKE_TAG)).toBe(false);

      // Bật lại rồi thoát màn hình (Quay lại / Unmount / Bỏ dở) -> deactivate
      expect(
        await syncCookKeepAwake({
          sessionStatus: 'cooking',
          userPreferenceEnabled: true,
          isExited: false,
        })
      ).toBe(true);
      expect(isKeepAwakeActiveForTest(COOK_SESSION_KEEP_AWAKE_TAG)).toBe(true);

      expect(
        shouldKeepScreenAwakeForSession({
          sessionStatus: 'abandoned',
          userPreferenceEnabled: true,
          isExited: false,
        })
      ).toBe(false);
      expect(
        await syncCookKeepAwake({
          sessionStatus: 'cooking',
          userPreferenceEnabled: true,
          isExited: true,
        })
      ).toBe(false);
      await disableCookKeepAwake();
      expect(isKeepAwakeActiveForTest(COOK_SESSION_KEEP_AWAKE_TAG)).toBe(false);
    });

    it('CookScreen.tsx nối trực tiếp keep-awake-service và reportFeedback không truyền question/answer', () => {
      const source = fs.readFileSync(cookScreenPath, 'utf-8');
      expect(source).toContain('syncCookKeepAwake');
      expect(source).toContain('disableCookKeepAwake');

      const feedbackCallMatch = source.match(/reportFeedback\(\{[\s\S]*?\}\)/);
      expect(feedbackCallMatch).not.toBeNull();
      const feedbackBlock = feedbackCallMatch ? feedbackCallMatch[0] : '';
      expect(feedbackBlock).toContain('questionId');
      expect(feedbackBlock).toContain('feedbackType');
      expect(feedbackBlock).not.toContain('question:');
      expect(feedbackBlock).not.toContain('answer:');
      expect(feedbackBlock).not.toContain('aiQuestion');
      expect(feedbackBlock).not.toContain('aiAnswer');
    });
  });

  describe('2. AiClient.reportFeedback gửi phản hồi ẩn danh lên POST /v1/ai/feedback', () => {
    it('Chỉ gửi questionId, feedbackType và ID ngữ cảnh; loại bỏ hoàn toàn câu hỏi và câu trả lời', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody = '';

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        capturedBody = typeof init?.body === 'string' ? init.body : '';
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            status: 'ok',
            eventId: 'fb_001',
            eventType: 'ai_wrong_answer',
          }),
        };
      });
      global.fetch = mockFetch;

      const client = new AiClient({ baseUrl: 'http://test-backend' });
      const qId = generateAnonymousQuestionId('ask');

      // Cố tình truyền dư nội dung nhạy cảm bằng ép kiểu để chứng minh bộ lọc chặn lọt
      const pollutedFeedback = {
        questionId: qId,
        feedbackType: 'ask_wrong_answer',
        sessionId: 'sess-cook-1',
        recipeSlug: 'trung-chien-ca-chua',
        stepId: 'step-2',
        question: 'Tại sao trứng bị cháy đen?',
        answer: 'Bạn cần bật lửa lớn tối đa 10 phút.',
        comment: 'Sai kiến thức hoàn toàn',
        allergies: ['egg'],
        name: 'Nguyen Van A',
      } as unknown as Parameters<AiClient['reportFeedback']>[0];

      const res = await client.reportFeedback(pollutedFeedback);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe('ok');
        expect(res.data.eventType).toBe('ai_wrong_answer');
      }

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(capturedUrl).toBe('http://test-backend/v1/ai/feedback');
      expect(capturedHeaders['X-Device-Id']).toBe('anon-device-t20b');

      const sentJson = JSON.parse(capturedBody) as Record<string, unknown>;
      expect(sentJson.questionId).toBe(qId);
      expect(sentJson.feedbackType).toBe('ask_wrong_answer');
      for (const forbidden of FORBIDDEN_FEEDBACK_FIELDS) {
        expect(sentJson).not.toHaveProperty(forbidden);
      }
      expect(capturedBody).not.toContain('Tại sao trứng bị cháy đen?');
      expect(capturedBody).not.toContain('Bạn cần bật lửa lớn tối đa 10 phút.');
    });

    it('Không gửi request nếu thiếu questionId hoặc không treo app khi mất mạng', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Network failed'));
      global.fetch = mockFetch;

      const client = new AiClient({ baseUrl: 'http://test-backend' });
      const invalidRes = await client.reportFeedback({
        questionId: '   ',
        feedbackType: 'wrong_answer',
      });
      expect(invalidRes.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();

      const netErrRes = await client.reportFeedback({
        questionId: 'q_sub_99',
        feedbackType: 'substitute_wrong_answer',
      });
      expect(netErrRes.success).toBe(false);
      if (!netErrRes.success) {
        expect(netErrRes.errorCode).toBe('NETWORK_ERROR');
      }

      const subSource = fs.readFileSync(substituteModalPath, 'utf-8');
      expect(subSource).not.toContain('comment:');
      expect(subSource).toContain('substitute_wrong_answer');
    });
  });
});

