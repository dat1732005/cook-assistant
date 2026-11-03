/**
 * File: apps/mobile/src/screens/CookScreen.tsx
 * Làm gì: Màn hình Nấu trực tiếp (T09) hỗ trợ người nấu từng bước theo 3 nhóm (now, waiting, next):
 *         - Bước active: nút "Xong" cỡ lớn, hiện "khoảng X phút", cue dấu hiệu nhận biết, nút "Hẹn giờ" tùy chọn.
 *         - Bước passive: nút "Đã bắt đầu" rồi đồng hồ đếm ngược tính từ endsAt.
 *         - Giữ sáng màn hình.
 *         - Hộp xác nhận khi lùi hoặc thoát / bỏ dở phiên.
 *         - Bước an toàn: hiện hộp xác nhận kèm nguồn, chặn Xong nếu chưa xác nhận.
 * Nhận vào: recipe (Recipe), servings (number), mode (OptimizationMode), driver (SqlDriver tùy chọn).
 * Trả ra: Giao diện điều phối phiên nấu hoàn chỉnh.
 * Ai gọi: PrepareScreen khi bấm "Bắt đầu nấu", router.
 * Bám theo: Mục T09 trong docs/tasks.md và docs/expected/T07.md.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import type { Recipe, RecipeStep, SqlDriver } from '@cook/core';
import { SessionService, type SessionSnapshot } from '@cook/core';
import { useNavigation } from '../navigation/router.js';
import { STRINGS } from '../constants/strings.js';
import { defaultAiClient } from '../services/ai-client.js';

export interface CookScreenProps {
  recipe: Recipe;
  servings?: number;
  mode?: 'fastest' | 'fewest_tools';
  driver?: SqlDriver;
  serviceOverride?: SessionService;
  initialNow?: number;
}

export function CookScreen({
  recipe,
  servings = 2,
  mode = 'fastest',
  driver,
  serviceOverride,
  initialNow = 0,
}: CookScreenProps): React.JSX.Element {
  const { navigate, goBack, replace } = useNavigation();

  // Khởi tạo SessionService (dùng override phục vụ test hoặc tạo mới)
  const sessionService = useMemo(() => {
    return serviceOverride || new SessionService(driver);
  }, [serviceOverride, driver]);

  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [currentTime] = useState<number>(initialNow);
  const [safetyConfirmedMap, setSafetyConfirmedMap] = useState<Record<string, boolean>>({});
  const [isKeepAwakeActive, setIsKeepAwakeActive] = useState<boolean>(true);
  const [manualModalStepId, setManualModalStepId] = useState<string | null>(null);
  const [manualSecondsInput, setManualSecondsInput] = useState<string>('60');

  // Khối hỏi đáp AI trong màn Nấu (T18.3, T18.4)
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; action?: string | null } | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);

  const handleAskAi = useCallback(async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setFeedbackSent(false);

    try {
      const res = await defaultAiClient.ask({
        question: aiQuestion.trim(),
        currentStep: snapshot?.now_group[0],
        remainingSteps: snapshot?.next,
      });

      if (res.success) {
        setAiAnswer(res.data);
      } else {
        setAiAnswer({ answer: res.message, action: null });
      }
    } catch {
      setAiAnswer({ answer: 'Không thể kết nối trợ lý AI lúc này.', action: null });
    } finally {
      setAiLoading(false);
    }
  }, [aiQuestion, snapshot]);

  // Áp dụng hành động đề xuất từ AI (hẹn giờ chỉ đổi khi người dùng bấm) (T18.3)
  const handleApplyAiAction = useCallback(async () => {
    if (!aiAnswer?.action) return;
    // Ví dụ đề xuất thêm 120s cho bước hiện tại
    const targetStep = snapshot?.now_group[0];
    if (targetStep) {
      const res = await sessionService.setManualTimer(120, currentTime, 'Đề xuất AI', targetStep);
      setSnapshot(res.snapshot);
      Alert.alert('Đã cập nhật', 'Đã đặt thêm hẹn giờ theo đề xuất.');
    }
  }, [aiAnswer, snapshot, sessionService, currentTime]);

  const handleReportWrongAnswer = useCallback(async () => {
    try {
      await defaultAiClient.reportFeedback({
        question: aiQuestion,
        answer: aiAnswer?.answer,
      });
      setFeedbackSent(true);
      Alert.alert('Đã gửi', 'Cảm ơn bạn đã phản hồi câu trả lời sai.');
    } catch {
      setFeedbackSent(true);
    }
  }, [aiQuestion, aiAnswer]);

  // Khởi tạo phiên nấu khi vào màn hình
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const snap = await sessionService.start(recipe, {
          now: initialNow,
          servings,
          mode,
        });
        if (isMounted) {
          setSnapshot(snap);
        }
      } catch (err: unknown) {
        // Nếu đã có phiên đang chạy thì cố gắng phục hồi
        if (err instanceof Error && err.message === 'SESSION_ALREADY_ACTIVE') {
          const restored = await sessionService.restore(null, initialNow, recipe.steps);
          if (isMounted && restored) {
            setSnapshot(restored.snapshot);
          }
        }
      }
    }

    void initSession();

    return () => {
      isMounted = false;
    };
  }, [sessionService, recipe, servings, mode, initialNow]);

  // Tìm đối tượng RecipeStep từ mã bước
  const getStep = useCallback(
    (stepId: string): RecipeStep | undefined => {
      return recipe.steps?.find((s) => s.id === stepId);
    },
    [recipe.steps]
  );

  // Định dạng thời lượng "khoảng X phút" hoặc "X giây"
  const formatApproxTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} ${STRINGS.cook.secondsSuffix}`;
    }
    const mins = Math.ceil(seconds / 60);
    return `${STRINGS.cook.approxMinutesPrefix} ${mins} ${STRINGS.cook.minutesSuffix}`;
  };

  // Định dạng đồng hồ đếm ngược mm:ss
  const formatCountdown = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Xử lý người dùng bấm "Đã bắt đầu" bước passive
  const handleStartPassive = async (stepId: string) => {
    try {
      const snap = await sessionService.startPassive(stepId, currentTime);
      setSnapshot(snap);
    } catch (err: unknown) {
      Alert.alert(STRINGS.common.error, String(err));
    }
  };

  // Xử lý người dùng bấm nút "Xong" cỡ lớn cho bước active
  const handleMarkDone = async (stepId: string) => {
    const isSafetyConfirmed = Boolean(safetyConfirmedMap[stepId]);
    const res = await sessionService.markDone(stepId, currentTime, isSafetyConfirmed);

    if (!res.success && res.safetyResult?.level === 'blocked') {
      Alert.alert(
        STRINGS.cook.safetyConfirmTitle,
        STRINGS.cook.safetyBlockedAlert
      );
      return;
    }

    setSnapshot(res.snapshot);

    // Nếu toàn bộ món ăn đã hoàn tất -> chuyển sang FinishScreen
    if (res.snapshot.session_status === 'done') {
      navigate('Finish', {
        recipe,
        dishName: recipe.name,
      });
    }
  };

  // Bật/tắt xác nhận an toàn cho bước có safety_rule
  const toggleSafetyConfirm = (stepId: string) => {
    setSafetyConfirmedMap((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Mở hộp thoại hẹn giờ tay
  const openManualTimerModal = (stepId: string) => {
    setManualModalStepId(stepId);
    setManualSecondsInput('60');
  };

  // Xác nhận hẹn giờ tay
  const confirmManualTimer = async () => {
    const sec = parseInt(manualSecondsInput, 10);
    if (isNaN(sec) || sec <= 0) {
      Alert.alert(STRINGS.common.error, 'Vui lòng nhập số giây hợp lệ lớn hơn 0');
      return;
    }

    const res = await sessionService.setManualTimer(
      sec,
      currentTime,
      `Hẹn giờ bước ${manualModalStepId || ''}`,
      manualModalStepId || undefined
    );
    setSnapshot(res.snapshot);
    setManualModalStepId(null);
  };

  // Hộp thoại xác nhận khi lùi hoặc thoát
  const handleBackPress = () => {
    Alert.alert(
      STRINGS.cook.exitConfirmTitle,
      STRINGS.cook.exitConfirmMessage,
      [
        {
          text: STRINGS.cook.resumeButton,
          style: 'cancel',
        },
        {
          text: STRINGS.common.back,
          style: 'default',
          onPress: () => goBack(),
        },
      ]
    );
  };

  // Hộp thoại xác nhận bỏ dở phiên
  const handleAbandonPress = () => {
    Alert.alert(
      STRINGS.cook.abandonConfirmTitle,
      STRINGS.cook.abandonConfirmMessage,
      [
        {
          text: STRINGS.common.cancel,
          style: 'cancel',
        },
        {
          text: STRINGS.cook.abandonButton,
          style: 'destructive',
          onPress: async () => {
            await sessionService.abandon(currentTime);
            replace('Home');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Thanh điều hướng đầu trang */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel={STRINGS.common.back}
          onPress={handleBackPress}
          style={styles.backButton}
          testID="cook-back-button"
        >
          <Text style={styles.backText}>‹ {STRINGS.common.back}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipe.name}</Text>
        <TouchableOpacity
          onPress={handleAbandonPress}
          style={styles.abandonButton}
          testID="abandon-session-button"
        >
          <Text style={styles.abandonText}>Thoát</Text>
        </TouchableOpacity>
      </View>

      {/* Dải trạng thái giữ sáng màn hình */}
      <TouchableOpacity
        style={styles.keepAwakeBar}
        onPress={() => setIsKeepAwakeActive((prev) => !prev)}
        testID="keep-awake-badge"
      >
        <Text style={styles.keepAwakeDot}>{isKeepAwakeActive ? '●' : '○'}</Text>
        <Text style={styles.keepAwakeText}>
          {isKeepAwakeActive ? STRINGS.cook.keepAwakeActive : 'Màn hình tự tắt'}
        </Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ======================================================== */}
        {/* NHÓM 1: BÂY GIỜ LÀM (NOW) */}
        {/* ======================================================== */}
        <View style={styles.groupContainer}>
          <Text style={styles.groupTitle}>⚡ {STRINGS.cook.nowGroupTitle}</Text>

          {(!snapshot || snapshot.now_group.length === 0) && (
            <View style={styles.emptyGroupBox}>
              <Text style={styles.emptyGroupText}>
                Hiện không có thao tác tay cần làm ngay. Vui lòng chờ các bước đang chạy nền bên dưới!
              </Text>
            </View>
          )}

          {snapshot?.now_group.map((stepId) => {
            const step = getStep(stepId);
            if (!step) return null;

            const isPassive = step.kind === 'passive';
            const hasSafetyRule = Boolean(step.safety_rule);
            const isSafetyConfirmed = Boolean(safetyConfirmedMap[stepId]);

            return (
              <View
                key={stepId}
                style={[styles.stepCard, styles.stepCardNow]}
                testID={`step-card-${stepId}`}
              >
                <View style={styles.stepHeaderRow}>
                  <Text style={styles.stepName}>
                    {step.title || step.text || `Bước ${stepId}`}
                  </Text>
                  <View style={isPassive ? styles.passiveBadge : styles.activeBadge}>
                    <Text style={styles.badgeText}>
                      {isPassive ? 'Chạy nền' : 'Thao tác tay'}
                    </Text>
                  </View>
                </View>

                {/* Thời lượng ước tính */}
                <Text style={styles.timeEstimateText}>
                  ⏱ {formatApproxTime(step.seconds)}
                </Text>

                {/* Dấu hiệu nhận biết (cue) */}
                {step.cue ? (
                  <View style={styles.cueBox}>
                    <Text style={styles.cueTitle}>{STRINGS.cook.cuePrefix}</Text>
                    <Text style={styles.cueText}>{step.cue}</Text>
                  </View>
                ) : null}

                {/* Hộp xác nhận an toàn nếu bước có mã an toàn */}
                {hasSafetyRule && (
                  <View style={styles.safetyBox} testID={`safety-box-${stepId}`}>
                    <Text style={styles.safetyTitle}>
                      🛡️ {STRINGS.cook.safetyConfirmTitle} ({step.safety_rule})
                    </Text>
                    <Text style={styles.safetySource}>
                      {STRINGS.cook.safetySourcePrefix}{' '}
                      {recipe.source || 'Tài liệu an toàn vệ sinh thực phẩm'}
                    </Text>
                    <TouchableOpacity
                      style={styles.safetyCheckRow}
                      onPress={() => toggleSafetyConfirm(stepId)}
                      testID={`safety-checkbox-${stepId}`}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          isSafetyConfirmed && styles.checkboxChecked,
                        ]}
                      >
                        {isSafetyConfirmed && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.safetyCheckLabel}>
                        {STRINGS.cook.safetyCheckboxLabel}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Các nút hành động */}
                <View style={styles.actionsRow}>
                  {isPassive ? (
                    // Bước passive: Nút "Đã bắt đầu"
                    <TouchableOpacity
                      style={styles.startPassiveButton}
                      onPress={() => handleStartPassive(stepId)}
                      testID={`start-passive-button-${stepId}`}
                    >
                      <Text style={styles.startPassiveButtonText}>
                        ▶ {STRINGS.cook.passiveStartedButton}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    // Bước active: Nút hẹn giờ phụ + Nút "Xong" cỡ lớn
                    <>
                      <TouchableOpacity
                        style={styles.timerButton}
                        onPress={() => openManualTimerModal(stepId)}
                        testID={`manual-timer-button-${stepId}`}
                      >
                        <Text style={styles.timerButtonText}>
                          ⏱ {STRINGS.cook.timerButton}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.largeDoneButton,
                          hasSafetyRule &&
                            !isSafetyConfirmed &&
                            styles.largeDoneButtonDisabled,
                        ]}
                        onPress={() => handleMarkDone(stepId)}
                        testID={`large-done-button-${stepId}`}
                      >
                        <Text style={styles.largeDoneButtonText}>
                          ✓ {STRINGS.cook.largeDoneButton}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* ======================================================== */}
        {/* NHÓM 2: ĐANG CHỜ ĐẾM GIỜ (WAITING) */}
        {/* ======================================================== */}
        {snapshot && snapshot.waiting.length > 0 && (
          <View style={styles.groupContainer}>
            <Text style={styles.groupTitle}>
              ⏳ {STRINGS.cook.waitingGroupTitle}
            </Text>

            {snapshot.waiting.map((stepId) => {
              const step = getStep(stepId);
              const timer = snapshot.running_timers.find(
                (t) => t.step_id === stepId
              );
              const remainingSec = timer
                ? Math.max(0, Number(timer.endsAt) - currentTime)
                : 0;

              return (
                <View
                  key={stepId}
                  style={[styles.stepCard, styles.stepCardWaiting]}
                  testID={`waiting-step-${stepId}`}
                >
                  <Text style={styles.waitingStepName}>
                    {step?.title || step?.text || `Bước ${stepId}`}
                  </Text>
                  <View style={styles.countdownContainer}>
                    <Text style={styles.countdownLabel}>
                      {STRINGS.cook.timerRunningBadge}
                    </Text>
                    <Text style={styles.countdownValue}>
                      {formatCountdown(remainingSec)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ======================================================== */}
        {/* NHÓM 3: TIẾP THEO (NEXT) */}
        {/* ======================================================== */}
        {snapshot && snapshot.next.length > 0 && (
          <View style={styles.groupContainer}>
            <Text style={styles.groupTitle}>📋 {STRINGS.cook.nextGroupTitle}</Text>

            {snapshot.next.map((stepId) => {
              const step = getStep(stepId);
              return (
                <View
                  key={stepId}
                  style={[styles.stepCard, styles.stepCardNext]}
                >
                  <Text style={styles.nextStepName}>
                    {step?.title || step?.text || `Bước ${stepId}`}
                  </Text>
                  <Text style={styles.nextStepTime}>
                    {step ? formatApproxTime(step.seconds) : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ======================================================== */}
        {/* KHỐI HỎI NHANH TRỢ LÝ AI KHI ĐANG NẤU (T18.3, T18.4) */}
        {/* ======================================================== */}
        <View style={styles.aiAskContainer} testID="ai-ask-container">
          <Text style={styles.groupTitle}>🤖 Hỏi nhanh trợ lý AI</Text>
          <View style={styles.aiInputRow}>
            <TextInput
              style={styles.aiTextInput}
              placeholder="Hỏi về bước hiện tại, thay thế, thời gian..."
              value={aiQuestion}
              onChangeText={setAiQuestion}
              testID="ai-question-input"
            />
            <TouchableOpacity
              style={styles.aiSendButton}
              onPress={handleAskAi}
              disabled={aiLoading}
              testID="ai-ask-button"
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.aiSendButtonText}>Hỏi</Text>
              )}
            </TouchableOpacity>
          </View>

          {aiAnswer && (
            <View style={styles.aiAnswerCard} testID="ai-answer-card">
              <Text style={styles.aiAnswerText}>{aiAnswer.answer}</Text>

              {aiAnswer.action && (
                <TouchableOpacity
                  style={styles.aiActionButton}
                  onPress={handleApplyAiAction}
                  testID="ai-apply-action-button"
                >
                  <Text style={styles.aiActionButtonText}>
                    ⚡ Áp dụng đề xuất: {aiAnswer.action}
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={styles.aiDisclaimerText}>
                ⚠️ AI có thể mắc lỗi. Vui lòng kiểm tra lại trước khi thực hiện.
              </Text>

              <TouchableOpacity
                style={styles.wrongAnswerButton}
                onPress={handleReportWrongAnswer}
                disabled={feedbackSent}
                testID="wrong-answer-button"
              >
                <Text style={styles.wrongAnswerText}>
                  {feedbackSent ? '✓ Đã báo cáo' : '🚩 Câu trả lời sai'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Hẹn giờ tay */}
      <Modal
        visible={manualModalStepId !== null}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              ⏱ {STRINGS.cook.timerButton}
            </Text>
            <Text style={styles.modalPrompt}>
              {STRINGS.cook.manualTimerPrompt}
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={manualSecondsInput}
              onChangeText={setManualSecondsInput}
              placeholder="Ví dụ: 120"
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setManualModalStepId(null)}
              >
                <Text style={styles.modalCancelText}>
                  {STRINGS.common.cancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmManualTimer}
              >
                <Text style={styles.modalConfirmText}>
                  {STRINGS.common.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  backText: {
    fontSize: 16,
    color: '#D9531E',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222222',
    maxWidth: '65%',
  },
  abandonButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  abandonText: {
    fontSize: 15,
    color: '#999999',
  },
  keepAwakeBar: {
    backgroundColor: '#FFF8E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  keepAwakeDot: {
    color: '#F57C00',
    fontSize: 10,
    marginRight: 6,
  },
  keepAwakeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  groupContainer: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 10,
  },
  emptyGroupBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  emptyGroupText: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 20,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  stepCardNow: {
    borderColor: '#D9531E',
    borderWidth: 2,
    shadowColor: '#D9531E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  stepCardWaiting: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
  },
  stepCardNext: {
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    opacity: 0.85,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222222',
    flex: 1,
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: '#FEF08A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  passiveBadge: {
    backgroundColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  timeEstimateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D9531E',
    marginBottom: 8,
  },
  cueBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  cueTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 2,
  },
  cueText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 18,
  },
  safetyBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  safetySource: {
    fontSize: 12,
    color: '#B91C1C',
    marginBottom: 10,
  },
  safetyCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#DC2626',
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  safetyCheckLabel: {
    fontSize: 13,
    color: '#7F1D1D',
    fontWeight: '600',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  timerButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  largeDoneButton: {
    flex: 1,
    backgroundColor: '#D9531E',
    borderRadius: 12,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeDoneButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  largeDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  startPassiveButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startPassiveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  waitingStepName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  countdownContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownLabel: {
    fontSize: 14,
    color: '#475569',
  },
  countdownValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563EB',
  },
  nextStepName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  nextStepTime: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#222222',
  },
  modalPrompt: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    fontSize: 15,
    color: '#666666',
  },
  modalConfirmButton: {
    backgroundColor: '#D9531E',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aiAskContainer: {
    marginTop: 10,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  aiInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  aiTextInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  aiSendButton: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  aiAnswerCard: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  aiAnswerText: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
    marginBottom: 8,
  },
  aiActionButton: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  aiActionButtonText: {
    color: '#0369A1',
    fontWeight: '600',
    fontSize: 13,
  },
  aiDisclaimerText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  wrongAnswerButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  wrongAnswerText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
});
