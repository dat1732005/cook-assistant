/**
 * File: apps/mobile/src/screens/SubstituteModal.tsx
 * Làm gì: Modal "Thay hoặc bỏ" nguyên liệu trước khi nấu (T18):
 *         - Cho phép chọn nguyên liệu và chọn hành động "Bỏ" hoặc "Thay".
 *         - Nguyên liệu có role = preservation hoặc dính dị ứng luôn hiện CẢNH BÁO CỐ ĐỊNH (không hiện kết luận AI) (T18.2).
 *         - Với nguyên liệu thông thường: gọi AI tư vấn mức ảnh hưởng, gợi ý và dòng "AI có thể mắc lỗi" (T18.1).
 *         - Nút "Câu trả lời sai" gửi phản hồi góp ý về backend (T18.4).
 * Nhận vào: recipe, userAllergies, aiClient, visible, onClose, onApply.
 * Trả ra: Giao diện Modal tương tác hoàn chỉnh.
 * Ai gọi: RecipeDetailScreen.
 * Bám theo: docs/tasks.md mục T18.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { Recipe, RecipeDetail } from '@cook/core';
import {
  AiClient,
  defaultAiClient,
  formatAiMockNotice,
  SubstituteResultData,
} from '../services/ai-client.js';
import type { TelemetryService } from '../services/telemetry-service.js';

export interface SubstituteModalProps {
  visible: boolean;
  onClose: () => void;
  recipe: Recipe | RecipeDetail;
  userAllergies?: string[];
  ingredientAllergenMap?: Record<string, string[]>;
  aiClient?: AiClient;
  telemetryService?: TelemetryService;
  sessionId?: string;
  onApplySubstitute?: (ingredient: string, action: 'omit' | 'substitute', replacement?: string) => void;
}

export function SubstituteModal({
  visible,
  onClose,
  recipe,
  userAllergies = [],
  ingredientAllergenMap = {},
  aiClient = defaultAiClient,
  telemetryService,
  sessionId,
  onApplySubstitute,
}: SubstituteModalProps): React.JSX.Element {
  const [selectedIngredient, setSelectedIngredient] = useState<string>(
    recipe.ingredients[0]?.ingredient || ''
  );
  const [action, setAction] = useState<'omit' | 'substitute'>('substitute');
  const [loading, setLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<SubstituteResultData | null>(null);
  const [isAiMock, setIsAiMock] = useState<boolean>(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<boolean>(false);
  const [helpfulMarked, setHelpfulMarked] = useState<boolean | null>(null);
  const [aiTelemetryEventId, setAiTelemetryEventId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tìm nguyên liệu được chọn trong công thức
  const currentIngredientObj = useMemo(() => {
    return recipe.ingredients.find((item) => item.ingredient === selectedIngredient);
  }, [recipe.ingredients, selectedIngredient]);

  // Kiểm tra vai trò bảo quản (preservation)
  const isPreservationRole = currentIngredientObj?.role === 'preservation';

  // Kiểm tra nguyên liệu có dính dị ứng của người dùng không
  const hasAllergyConflict = useMemo(() => {
    const allergens = ingredientAllergenMap[selectedIngredient] || [];
    return allergens.some((code) => userAllergies.includes(code));
  }, [ingredientAllergenMap, selectedIngredient, userAllergies]);

  // Gọi AI tư vấn
  const handleConsultAi = useCallback(async () => {
    // Nếu là nguyên liệu bảo quản hoặc dính dị ứng, hiển thị cảnh báo cố định mà không cần AI
    if (isPreservationRole || hasAllergyConflict) {
      setIsAiMock(false);
      setAiResult({
        severity: 'high',
        impact: isPreservationRole
          ? 'Nguyên liệu bảo quản thực phẩm quan trọng. Bỏ hoặc thay đổi có thể gây hỏng món hoặc ngộ độc.'
          : 'Nguyên liệu chứa thành phần gây dị ứng đã khai báo.',
        suggestions: [],
        confirm_required: true,
      });
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setFeedbackSent(false);
    setHelpfulMarked(null);
    setAiTelemetryEventId(null);
    setIsAiMock(false);

    try {
      // Ghi nhận lượt hỏi AI thay nguyên liệu ẩn danh (tuyệt đối không gửi tên nguyên liệu/dị ứng trong telemetry)
      if (telemetryService) {
        const telemetryEvt = await telemetryService.recordAiAsked({
          sessionId,
          recipeSlug: recipe.slug,
          aiKind: 'substitute',
        });
        setAiTelemetryEventId(telemetryEvt?.eventId ?? null);
        void telemetryService.flushPendingEvents();
      }

      const res = await aiClient.substitute({
        recipeId: recipe.slug || 'recipe',
        action,
        ingredientId: selectedIngredient,
        role: currentIngredientObj?.role,
        flavorGroup: currentIngredientObj?.flavor_group,
        allergies: userAllergies,
        knownIngredients: recipe.ingredients.map((i) => i.ingredient),
        ingredientAllergens: ingredientAllergenMap,
      });

      // Ghi nhận trạng thái bản giả từ header X-AI-Mock của backend
      setIsAiMock(Boolean(res.isMock));

      if (res.success) {
        setAiResult(res.data);
        if (res.data.suggestions && res.data.suggestions.length > 0) {
          setSelectedSuggestion(res.data.suggestions[0] || null);
        }
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setIsAiMock(false);
      setErrorMessage('Không thể kết nối tới máy chủ AI. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [
    isPreservationRole,
    hasAllergyConflict,
    telemetryService,
    sessionId,
    aiClient,
    recipe.slug,
    recipe.ingredients,
    action,
    selectedIngredient,
    currentIngredientObj,
    userAllergies,
    ingredientAllergenMap,
  ]);

  // Đánh dấu câu trả lời AI hữu ích (T19.1)
  const handleMarkHelpful = useCallback(async () => {
    setHelpfulMarked(true);
    if (telemetryService && aiTelemetryEventId) {
      await telemetryService.updateAiHelpful(aiTelemetryEventId, true);
      void telemetryService.flushPendingEvents();
    }
  }, [telemetryService, aiTelemetryEventId]);

  // Báo cáo câu trả lời sai (T18.4, T19.1)
  const handleReportWrongAnswer = useCallback(async () => {
    setHelpfulMarked(false);
    if (telemetryService && aiTelemetryEventId) {
      await telemetryService.updateAiHelpful(aiTelemetryEventId, false);
      void telemetryService.flushPendingEvents();
    }
    try {
      await aiClient.reportFeedback({
        ingredientId: selectedIngredient,
        comment: `Báo cáo câu trả lời không chính xác cho nguyên liệu ${selectedIngredient}`,
      });
      setFeedbackSent(true);
      Alert.alert('Đã gửi phản hồi', 'Cảm ơn bạn! Đóng góp của bạn giúp cải thiện trợ lý nấu ăn.');
    } catch {
      setFeedbackSent(true);
      Alert.alert('Ghi nhận', 'Đã ghi nhận phản hồi câu trả lời sai.');
    }
  }, [aiClient, selectedIngredient, telemetryService, aiTelemetryEventId]);

  // Áp dụng thay/bỏ nguyên liệu
  const handleConfirm = useCallback(() => {
    if (onApplySubstitute) {
      onApplySubstitute(
        selectedIngredient,
        action,
        action === 'substitute' ? selectedSuggestion || undefined : undefined
      );
    }
    onClose();
  }, [onApplySubstitute, selectedIngredient, action, selectedSuggestion, onClose]);

  const mockNoticeText = formatAiMockNotice(isAiMock);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>✨ Thay hoặc bỏ nguyên liệu</Text>
          <Text style={styles.modalSubtitle}>Tùy chỉnh thành phần theo sở thích và kho đồ</Text>

          <ScrollView style={styles.scrollArea}>
            {/* Chọn nguyên liệu */}
            <Text style={styles.sectionHeader}>Chọn nguyên liệu:</Text>
            <View style={styles.pillRow}>
              {recipe.ingredients.map((item) => {
                const isSelected = item.ingredient === selectedIngredient;
                return (
                  <TouchableOpacity
                    key={item.ingredient}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    onPress={() => {
                      setSelectedIngredient(item.ingredient);
                      setAiResult(null);
                      setIsAiMock(false);
                      setFeedbackSent(false);
                    }}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {item.ingredient}
                      {item.role === 'preservation' ? ' 🛡️' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Chọn hành động */}
            <Text style={styles.sectionHeader}>Hành động:</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, action === 'omit' && styles.actionButtonActive]}
                onPress={() => setAction('omit')}
              >
                <Text style={[styles.actionButtonText, action === 'omit' && styles.actionButtonTextActive]}>
                  🚫 Bỏ nguyên liệu
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, action === 'substitute' && styles.actionButtonActive]}
                onPress={() => setAction('substitute')}
              >
                <Text style={[styles.actionButtonText, action === 'substitute' && styles.actionButtonTextActive]}>
                  🔄 Tìm thay thế
                </Text>
              </TouchableOpacity>
            </View>

            {/* CẢNH BÁO CỐ ĐỊNH KHI ROLE = PRESERVATION (T18.2) */}
            {isPreservationRole ? (
              <View style={styles.fixedWarningBox}>
                <Text style={styles.fixedWarningTitle}>⚠️ CẢNH BÁO AN TOÀN CỐ ĐỊNH</Text>
                <Text style={styles.fixedWarningText}>
                  Nguyên liệu "{selectedIngredient}" đóng vai trò bảo quản (preservation).
                  Việc bỏ hoặc thay thế nguyên liệu này có thể làm thực phẩm nhanh hỏng hoặc sinh độc tố.
                </Text>
                <Text style={styles.severityHighBadge}>MỨC ĐỘ ẢNH HƯỞNG: CAO (BẮT BUỘC XÁC NHẬN)</Text>
              </View>
            ) : null}

            {/* CẢNH BÁO CỐ ĐỊNH KHI DÍNH DỊ ỨNG (T18.2) */}
            {hasAllergyConflict ? (
              <View style={styles.allergyWarningBox}>
                <Text style={styles.allergyWarningTitle}>⚠️ CẢNH BÁO DỊ ỨNG CỐ ĐỊNH</Text>
                <Text style={styles.allergyWarningText}>
                  Nguyên liệu "{selectedIngredient}" dính mã dị ứng bạn đã khai báo trong hồ sơ.
                  Khuyến nghị bỏ hoặc thay thế hoàn toàn để đảm bảo an toàn sức khỏe.
                </Text>
              </View>
            ) : null}

            {/* Nút Tư vấn AI (khi không phải preservation) */}
            {!isPreservationRole && !hasAllergyConflict ? (
              <TouchableOpacity
                style={styles.consultButton}
                onPress={handleConsultAi}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.consultButtonText}>🤖 Hỏi trợ lý AI</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {/* Thông báo lỗi nếu có */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                {mockNoticeText ? (
                  <Text style={styles.mockNoticeText} testID="ai-mock-notice">
                    {mockNoticeText}
                  </Text>
                ) : null}
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleConsultAi}>
                  <Text style={styles.retryButtonText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Kết quả tư vấn từ AI */}
            {aiResult ? (
              <View style={styles.resultBox}>
                {mockNoticeText ? (
                  <Text style={styles.mockNoticeText} testID="ai-mock-notice">
                    {mockNoticeText}
                  </Text>
                ) : null}
                <View style={styles.severityRow}>
                  <Text style={styles.severityLabel}>Mức ảnh hưởng:</Text>
                  <Text
                    style={[
                      styles.severityValue,
                      aiResult.severity === 'high' && styles.severityHigh,
                      aiResult.severity === 'medium' && styles.severityMedium,
                      aiResult.severity === 'low' && styles.severityLow,
                    ]}
                  >
                    {aiResult.severity.toUpperCase()}
                  </Text>
                </View>

                {aiResult.impact ? (
                  <Text style={styles.impactText}>{aiResult.impact}</Text>
                ) : null}

                {/* Gợi ý thay thế */}
                {action === 'substitute' ? (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsHeader}>Gợi ý nguyên liệu thay thế:</Text>
                    {aiResult.suggestions && aiResult.suggestions.length > 0 ? (
                      aiResult.suggestions.map((sug) => {
                        const isChosen = sug === selectedSuggestion;
                        return (
                          <TouchableOpacity
                            key={sug}
                            style={[styles.suggestionItem, isChosen && styles.suggestionItemSelected]}
                            onPress={() => setSelectedSuggestion(sug)}
                          >
                            <Text style={[styles.suggestionText, isChosen && styles.suggestionTextSelected]}>
                              ✓ {sug}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <Text style={styles.emptySuggestions}>Không có gợi ý thay thế nào khả dụng.</Text>
                    )}
                  </View>
                ) : null}

                {/* DÒNG BẮT BUỘC: AI CÓ THỂ MẮC LỖI (T18.1) */}
                <Text style={styles.disclaimerText}>
                  ⚠️ Trợ lý AI có thể mắc lỗi. Vui lòng cân nhắc kỹ thói quen ẩm thực của bạn.
                </Text>

                {/* Đánh giá hữu ích & nút Câu trả lời sai (T18.4, T19.1) */}
                <View style={styles.feedbackRow}>
                  <TouchableOpacity
                    style={[
                      styles.helpfulButton,
                      helpfulMarked === true && styles.helpfulButtonSelected,
                    ]}
                    onPress={handleMarkHelpful}
                    disabled={helpfulMarked !== null}
                    testID="substitute-helpful-button"
                  >
                    <Text style={styles.helpfulButtonText}>
                      {helpfulMarked === true ? '✓ Đã chọn Hữu ích' : '👍 Hữu ích'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.wrongAnswerButton, feedbackSent && styles.wrongAnswerButtonDisabled]}
                    onPress={handleReportWrongAnswer}
                    disabled={feedbackSent}
                    testID="substitute-wrong-button"
                  >
                    <Text style={styles.wrongAnswerButtonText}>
                      {feedbackSent ? '✓ Đã ghi nhận phản hồi' : '👎 Câu trả lời sai'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Hàng nút cuối */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleConfirm}>
              <Text style={styles.applyButtonText}>Áp dụng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  scrollArea: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginTop: 8,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#10b981',
  },
  pillText: {
    fontSize: 14,
    color: '#334155',
  },
  pillTextSelected: {
    color: '#047857',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  fixedWarningBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  fixedWarningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 4,
  },
  fixedWarningText: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
    marginBottom: 8,
  },
  severityHighBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  allergyWarningBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  allergyWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 4,
  },
  allergyWarningText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  consultButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  consultButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    marginBottom: 6,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  resultBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  severityLabel: {
    fontSize: 14,
    color: '#475569',
    marginRight: 8,
  },
  severityValue: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityLow: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  severityMedium: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
  },
  severityHigh: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  impactText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 8,
  },
  suggestionsContainer: {
    marginTop: 6,
    marginBottom: 8,
  },
  suggestionsHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  suggestionItem: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 6,
  },
  suggestionItemSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  suggestionText: {
    fontSize: 14,
    color: '#334155',
  },
  suggestionTextSelected: {
    color: '#059669',
    fontWeight: '600',
  },
  emptySuggestions: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#64748b',
  },
  disclaimerText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#d97706',
    marginTop: 8,
    marginBottom: 8,
  },
  mockNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c3aed',
    marginBottom: 6,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  helpfulButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  helpfulButtonSelected: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  helpfulButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  wrongAnswerButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
  },
  wrongAnswerButtonDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  wrongAnswerButtonText: {
    fontSize: 12,
    color: '#64748b',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
