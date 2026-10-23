/**
 * File: apps/mobile/src/screens/RecipeDetailScreen.tsx
 * Làm gì: Màn hình Chi tiết món ăn hiển thị nguyên liệu đã nhân tỷ lệ theo số phần ăn, đổi số phần, bộ chọn tối ưu hóa lịch nấu, nút "Thay hoặc bỏ" bị khóa chờ AI, và nút Bắt đầu.
 * Nhận vào: recipeSlug, recipeRepo, userServings (số phần ăn từ user_profile), onBack, onStartCooking.
 * Trả ra: Giao diện chi tiết món tương tác đầy đủ các nghiệp vụ T06.4, T06.5.
 * Ai gọi: Navigation router / App.tsx.
 * Bám theo: Mục T06.4, T06.5 trong docs/tasks.md và docs/expected/T06.md mục B, D (B1-B8, D3-D5).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  RecipeRepo,
  RecipeDetail,
  OptimizationMode,
  ScaledIngredient,
  scaleIngredients,
} from '@cook/core';
import { STRINGS } from '../constants/strings.js';

/** Giá trị phần ăn nhỏ nhất cho phép trên màn hình */
const MIN_SERVINGS_LIMIT = 1;

export interface RecipeDetailScreenProps {
  recipeSlug: string;
  recipeRepo: RecipeRepo;
  userServings: number;
  onBack: () => void;
  onStartCooking?: () => void;
}

export function RecipeDetailScreen({
  recipeSlug,
  recipeRepo,
  userServings,
  onBack,
  onStartCooking,
}: RecipeDetailScreenProps): React.JSX.Element {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Số phần ăn khởi tạo theo user_profile.servings đã lưu trong SQLite (D3)
  const [servings, setServings] = useState<number>(userServings);

  // Tiêu chí tối ưu lịch nấu: mặc định 'fastest' (D5)
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('fastest');

  // Tải chi tiết món ăn từ CSDL SQLite
  useEffect(() => {
    let isMounted = true;
    async function fetchDetail() {
      setLoading(true);
      try {
        const data = await recipeRepo.get(recipeSlug);
        // Chỉ cập nhật state nếu component vẫn còn mounted
        if (isMounted) {
          setRecipe(data);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [recipeRepo, recipeSlug]);

  // Xử lý tăng số phần ăn
  const handleIncrease = useCallback(() => {
    setServings((prev) => prev + 1);
  }, []);

  // Xử lý giảm số phần ăn (bị khóa disabled khi servings = 1) (B8)
  const handleDecrease = useCallback(() => {
    setServings((prev) => {
      // Chặn không giảm xuống 0
      if (prev > MIN_SERVINGS_LIMIT) {
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // Tính toán lại lượng nguyên liệu theo số phần ăn mong muốn bằng hàm thuần scaleIngredients (B1-B7)
  const scaledIngredients = useMemo(() => {
    // Nếu chưa tải xong công thức, trả về mảng rỗng
    if (!recipe) {
      return [];
    }
    return scaleIngredients(recipe.ingredients, servings, recipe.servings_base);
  }, [recipe, servings]);

  // Nhấn nút Bắt đầu nấu (giữ chỗ chờ T09)
  const handleStartCooking = useCallback(() => {
    // Thông báo giữ chỗ chờ T09
    Alert.alert(
      STRINGS.detail.startCookingButton,
      STRINGS.detail.startCookingPlaceholderNotice
    );
    if (onStartCooking) {
      onStartCooking();
    }
  }, [onStartCooking]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Nút quay lại Trang chủ */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityLabel={STRINGS.common.back}
        >
          <Text style={styles.backButtonText}>← {STRINGS.common.back}</Text>
        </TouchableOpacity>

        {/* Trạng thái đang tải */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>{STRINGS.common.loading}</Text>
          </View>
        ) : !recipe ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{STRINGS.common.error}</Text>
          </View>
        ) : (
          <View>
            {/* Header món ăn */}
            <View style={styles.header}>
              <Text style={styles.recipeTitle}>{recipe.name}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    ⏱ {recipe.total_minutes} {STRINGS.common.minutesUnit}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    🍴 {STRINGS.detail.servingsSelectorTitle} {recipe.servings_base} {STRINGS.common.servingsUnit} {STRINGS.common.servingsBaseSuffix}
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    🍳 {recipe.equipment.join(', ')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Khối điều chỉnh số phần ăn (T06.4, B1-B8, D3) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {STRINGS.detail.servingsSelectorTitle}
              </Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    servings <= MIN_SERVINGS_LIMIT && styles.stepperButtonDisabled,
                  ]}
                  onPress={handleDecrease}
                  disabled={servings <= MIN_SERVINGS_LIMIT}
                  accessibilityLabel={STRINGS.detail.servingsDecreaseLabel}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </TouchableOpacity>

                <View style={styles.servingsTextGroup}>
                  <Text style={styles.servingsNumber}>{servings}</Text>
                  <Text style={styles.servingsUnitText}>
                    {STRINGS.detail.servingsUnit}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={handleIncrease}
                  accessibilityLabel={STRINGS.detail.servingsIncreaseLabel}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Khối danh sách nguyên liệu đã nhân tỷ lệ (B1-B7) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {STRINGS.detail.ingredientsTitle}
              </Text>
              <Text style={styles.cardSubtitle}>
                {STRINGS.detail.ingredientsSubtitle}
              </Text>

              <View style={styles.ingredientList}>
                {scaledIngredients.map((ing: ScaledIngredient, idx: number) => (
                  <View key={idx} style={styles.ingredientRow}>
                    <View style={styles.ingredientInfo}>
                      <Text style={styles.ingredientName}>{ing.ingredient}</Text>
                      {ing.optional ? (
                        <Text style={styles.optionalBadge}>
                          {STRINGS.common.optionalBadge}
                        </Text>
                      ) : null}
                    </View>
                    {/* Hiển thị định lượng đời thường sạch sẽ (B1-B7) */}
                    <Text style={styles.ingredientAmount}>
                      {ing.display_amount}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Nút "Thay hoặc bỏ" bị khóa disabled chờ T18 AI (D4) */}
              <TouchableOpacity
                style={styles.disabledAiButton}
                disabled={true}
                accessibilityLabel={STRINGS.detail.replaceOrRemoveButtonText}
              >
                <Text style={styles.disabledAiButtonText}>
                  ✨ {STRINGS.detail.replaceOrRemoveButtonText}
                </Text>
                <Text style={styles.disabledAiButtonSubtext}>
                  {STRINGS.detail.replaceOrRemoveDisabledNotice}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Khối chọn tiêu chí tối ưu hóa (D5) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {STRINGS.detail.optimizationTitle}
              </Text>

              <View style={styles.modeOptionGroup}>
                {/* Lựa chọn 'fastest' */}
                <TouchableOpacity
                  style={[
                    styles.modeOption,
                    optimizationMode === 'fastest' && styles.modeOptionSelected,
                  ]}
                  onPress={() => setOptimizationMode('fastest')}
                >
                  <View style={styles.modeRadio}>
                    {optimizationMode === 'fastest' ? (
                      <View style={styles.modeRadioInner} />
                    ) : null}
                  </View>
                  <View style={styles.modeTextGroup}>
                    <Text
                      style={[
                        styles.modeTitle,
                        optimizationMode === 'fastest' && styles.modeTitleSelected,
                      ]}
                    >
                      ⚡ {STRINGS.detail.modeFastestTitle}
                    </Text>
                    <Text style={styles.modeDesc}>
                      {STRINGS.detail.modeFastestDescription}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Lựa chọn 'fewest_tools' */}
                <TouchableOpacity
                  style={[
                    styles.modeOption,
                    optimizationMode === 'fewest_tools' && styles.modeOptionSelected,
                  ]}
                  onPress={() => setOptimizationMode('fewest_tools')}
                >
                  <View style={styles.modeRadio}>
                    {optimizationMode === 'fewest_tools' ? (
                      <View style={styles.modeRadioInner} />
                    ) : null}
                  </View>
                  <View style={styles.modeTextGroup}>
                    <Text
                      style={[
                        styles.modeTitle,
                        optimizationMode === 'fewest_tools' && styles.modeTitleSelected,
                      ]}
                    >
                      🧼 {STRINGS.detail.modeFewestToolsTitle}
                    </Text>
                    <Text style={styles.modeDesc}>
                      {STRINGS.detail.modeFewestToolsDescription}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Khối các bước thực hiện */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {STRINGS.detail.stepsTitle}
              </Text>
              <View style={styles.stepList}>
                {recipe.steps.map((st, idx) => (
                  <View key={st.id} style={styles.stepItem}>
                    <View style={styles.stepHeader}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.stepTitle}>{st.title}</Text>
                      <View
                        style={[
                          styles.kindBadge,
                          st.kind === 'active'
                            ? styles.kindActive
                            : styles.kindPassive,
                        ]}
                      >
                        <Text style={styles.kindBadgeText}>
                          {st.kind === 'active'
                            ? STRINGS.detail.stepActiveBadge
                            : STRINGS.detail.stepPassiveBadge}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.stepText}>{st.text}</Text>
                    {st.cue ? (
                      <View style={styles.cueBox}>
                        <Text style={styles.cueText}>
                          👀 {STRINGS.detail.stepCuePrefix} {st.cue}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>

            {/* Nút Bắt đầu nấu */}
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartCooking}
            >
              <Text style={styles.startButtonText}>
                🔥 {STRINGS.detail.startCookingButton}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  header: {
    marginBottom: 20,
  },
  recipeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 12,
    lineHeight: 36,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  stepperButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#38bdf8',
  },
  servingsTextGroup: {
    alignItems: 'center',
    minWidth: 90,
  },
  servingsNumber: {
    fontSize: 38,
    fontWeight: '800',
    color: '#f8fafc',
  },
  servingsUnitText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  ingredientList: {
    gap: 10,
    marginBottom: 16,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  ingredientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    color: '#f1f5f9',
    fontWeight: '500',
  },
  optionalBadge: {
    fontSize: 11,
    color: '#94a3b8',
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ingredientAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34d399',
  },
  disabledAiButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    opacity: 0.7,
  },
  disabledAiButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  disabledAiButtonSubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  modeOptionGroup: {
    gap: 12,
    marginTop: 8,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeOptionSelected: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  modeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  modeRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34d399',
  },
  modeTextGroup: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  modeTitleSelected: {
    color: '#34d399',
  },
  modeDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  stepList: {
    gap: 14,
    marginTop: 8,
  },
  stepItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#022c22',
    fontWeight: '800',
    fontSize: 13,
  },
  stepTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kindActive: {
    backgroundColor: '#0c4a6e',
  },
  kindPassive: {
    backgroundColor: '#4c1d95',
  },
  kindBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e0f2fe',
  },
  stepText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    marginBottom: 6,
  },
  cueBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  cueText: {
    fontSize: 13,
    color: '#fcd34d',
    fontStyle: 'italic',
  },
  startButton: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#022c22',
  },
});
