/**
 * File: apps/mobile/src/screens/HomeScreen.tsx
 * Làm gì: Màn hình Trang chủ hiển thị danh sách món ăn gợi ý từ SuggestService (T12, T13.3),
 *         bộ lọc thời gian, công tắc "Đi chợ (ước chừng)" với chi phí dạng khoảng (T13.4),
 *         chọn số người ăn và bữa ăn, cùng nút mở Kho nguyên liệu (T13.2).
 * Nhận vào: recipeRepo, profile, onOpenProfile, onSelectRecipe, pantryService, onOpenPantry.
 * Trả ra: Giao diện Trang chủ hoàn chỉnh.
 * Bám theo: Mục T06.3, T06.6, T13.3, T13.4 trong docs/tasks.md.
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
  Switch,
} from 'react-native';
import {
  RecipeRepo,
  RecipeSummary,
  UserProfile,
  getHomeRecipes,
  SuggestService,
  SuggestRecipeInput,
  ScoredRecipe,
  PantryService,
} from '@cook/core';
import { STRINGS } from '../constants/strings.js';

export interface HomeScreenProps {
  recipeRepo: RecipeRepo;
  profile: UserProfile | null;
  onOpenProfile: () => void;
  onSelectRecipe: (slug: string) => void;
  pantryService?: PantryService;
  onOpenPantry?: () => void;
}

/** Các mốc thời gian lọc phổ biến (phút) */
const TIME_FILTER_PRESETS = [null, 9, 15, 20, 30] as const;

/** Các bữa ăn trong ngày */
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
type MealType = (typeof MEAL_TYPES)[number];

export function HomeScreen({
  recipeRepo,
  profile,
  onOpenProfile,
  onSelectRecipe,
  pantryService,
  onOpenPantry,
}: HomeScreenProps): React.JSX.Element {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [scoredMap, setScoredMap] = useState<Record<string, ScoredRecipe>>({});
  const [selectedMaxMinutes, setSelectedMaxMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Tùy biến theo T13.3:
  // 1. Số người ăn (mặc định lấy từ hồ sơ người dùng)
  const [servings, setServings] = useState<number>(profile?.servings ?? 2);
  // 2. Bữa nào (sáng, trưa, tối)
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');
  // 3. Công tắc "Đi chợ (ước chừng)"
  const [isEstimationMode, setIsEstimationMode] = useState<boolean>(false);

  const suggestService = useMemo(() => new SuggestService(), []);

  // Tải danh sách món ăn từ SQLite kết hợp tính điểm bằng SuggestService (T13.3)
  const loadDishes = useCallback(async () => {
    setLoading(true);
    try {
      if (!profile) {
        setRecipes([]);
        setScoredMap({});
        return;
      }

      // Lấy danh sách thô đã lọc dị ứng và dụng cụ
      const rawList = await getHomeRecipes(recipeRepo, profile, {
        max_minutes: selectedMaxMinutes ?? undefined,
      });

      // Nếu có PantryService thì lấy kho để tính điểm SuggestService (T12, T13.3)
      if (pantryService) {
        const pantrySnapshot = await pantryService.getSnapshot();

        // Chuyển đổi danh sách RecipeSummary sang SuggestRecipeInput
        const candidates: SuggestRecipeInput[] = rawList.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          servings_base: r.servings_base ?? 2,
          total_minutes: r.total_minutes,
          equipment: r.equipment,
          ingredients: [], // Nếu không có chi tiết nguyên liệu ở summary thì phủ tính mặc định
        }));

        const scored = suggestService.suggest({
          recipes: candidates,
          profile: {
            servings,
            equipment: profile.available_equipment,
            allergies: profile.allergies ?? [],
            maxMinutes: selectedMaxMinutes ?? undefined,
          },
          pantry: pantrySnapshot,
          conversionsMap: {},
          mode: isEstimationMode ? 'estimation' : 'standard',
        });

        // Tạo bản đồ điểm theo slug
        const map: Record<string, ScoredRecipe> = {};
        for (const item of scored) {
          map[item.slug] = item;
        }
        setScoredMap(map);

        // Sắp xếp lại danh sách món theo thứ tự điểm của SuggestService
        const sortedList = [...rawList].sort((a, b) => {
          const scoreA = map[a.slug]?.score ?? 0;
          const scoreB = map[b.slug]?.score ?? 0;
          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }
          return a.name.localeCompare(b.name);
        });

        setRecipes(sortedList);
      } else {
        setRecipes(rawList);
      }
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [recipeRepo, profile, selectedMaxMinutes, pantryService, servings, isEstimationMode, suggestService]);

  useEffect(() => {
    void loadDishes();
  }, [loadDishes]);

  // Cập nhật servings khi profile thay đổi
  useEffect(() => {
    if (profile?.servings) {
      setServings(profile.servings);
    }
  }, [profile?.servings]);

  const getDifficultyLabel = useCallback((diff: number) => {
    if (diff <= 1) return STRINGS.home.difficultyEasy;
    if (diff === 2) return STRINGS.home.difficultyMedium;
    return STRINGS.home.difficultyHard;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* TopBar */}
        <View style={styles.topBar}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.appName}>{STRINGS.common.appName}</Text>
            <Text style={styles.greeting}>{STRINGS.home.greeting}</Text>
          </View>
          <View style={styles.headerBtnGroup}>
            {onOpenPantry && (
              <TouchableOpacity
                style={styles.pantryHeaderButton}
                onPress={onOpenPantry}
                testID="home-open-pantry-button"
              >
                <Text style={styles.pantryHeaderButtonText}>📦 {STRINGS.home.pantryButtonText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.profileButton}
              onPress={onOpenProfile}
              accessibilityLabel={STRINGS.home.profileButtonText}
            >
              <Text style={styles.profileButtonText}>
                ⚙ {STRINGS.home.profileButtonText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.subtitle}>{STRINGS.home.subtitle}</Text>

        {/* Khối điều khiển gợi ý (T13.3) */}
        <View style={styles.suggestControlsCard} testID="home-suggest-controls">
          {/* Hàng 1: Chọn số người ăn và bữa ăn */}
          <View style={styles.controlRow}>
            <View style={styles.servingsSelector}>
              <Text style={styles.controlLabel}>{STRINGS.home.servingsLabel}</Text>
              <View style={styles.servingsStepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setServings((s) => Math.max(1, s - 1))}
                  testID="home-servings-minus"
                >
                  <Text style={styles.stepperBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.servingsText} testID="home-servings-display">
                  {servings} {STRINGS.home.personUnit}
                </Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setServings((s) => s + 1)}
                  testID="home-servings-plus"
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Chọn bữa */}
            <View style={styles.mealSelector}>
              <Text style={styles.controlLabel}>{STRINGS.home.mealLabel}</Text>
              <View style={styles.mealButtons}>
                {MEAL_TYPES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.mealBtn, selectedMeal === m && styles.mealBtnActive]}
                    onPress={() => setSelectedMeal(m)}
                    testID={`meal-btn-${m}`}
                  >
                    <Text
                      style={[
                        styles.mealBtnText,
                        selectedMeal === m && styles.mealBtnTextActive,
                      ]}
                    >
                      {STRINGS.home.meals[m]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Hàng 2: Công tắc Đi chợ (ước chừng) */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelGroup}>
              <Text style={styles.toggleTitle}>{STRINGS.home.estimationToggleTitle}</Text>
              <Text style={styles.toggleDesc}>
                {isEstimationMode
                  ? STRINGS.home.estimationToggleActiveDesc
                  : STRINGS.home.estimationToggleInactiveDesc}
              </Text>
            </View>
            <Switch
              value={isEstimationMode}
              onValueChange={setIsEstimationMode}
              trackColor={{ false: '#E9ECEF', true: '#FF922B' }}
              thumbColor={isEstimationMode ? '#D9531E' : '#FFFFFF'}
              testID="toggle-estimation-mode"
            />
          </View>
        </View>

        {/* Khối bộ lọc thời gian (T06.3, C6, C7) */}
        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>
            {STRINGS.home.filterSectionTitle}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {TIME_FILTER_PRESETS.map((minutes, idx) => {
              const isSelected = selectedMaxMinutes === minutes;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipSelected,
                  ]}
                  onPress={() => setSelectedMaxMinutes(minutes)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}
                  >
                    {minutes === null
                      ? STRINGS.home.filterAll
                      : `≤ ${minutes} ${STRINGS.common.minutesUnit}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Tiêu đề danh sách món */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>
            {isEstimationMode ? STRINGS.home.dishListEstimationTitle : STRINGS.home.dishListTitle}
          </Text>
          <Text style={styles.dishCountBadge}>
            {recipes.length} {STRINGS.home.dishCountUnit}
          </Text>
        </View>

        {/* Trạng thái tải dữ liệu */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>{STRINGS.common.loading}</Text>
          </View>
        ) : recipes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🍽</Text>
            <Text style={styles.emptyTitle}>{STRINGS.home.emptyListNotice}</Text>
            <Text style={styles.emptyHint}>
              {STRINGS.home.emptyListAllergyHint}
            </Text>
          </View>
        ) : (
          /* Danh sách các thẻ món ăn */
          <View style={styles.dishList}>
            {recipes.map((dish) => {
              const scored = scoredMap[dish.slug];
              return (
                <TouchableOpacity
                  key={dish.slug}
                  style={styles.dishCard}
                  onPress={() => onSelectRecipe(dish.slug)}
                  activeOpacity={0.8}
                  testID={`recipe-card-${dish.slug}`}
                >
                  <View style={styles.dishCardHeader}>
                    <Text style={styles.dishName}>{dish.name}</Text>
                    <View style={styles.badgeRow}>
                      {scored && !isEstimationMode && scored.score > 0 && (
                        <View style={styles.scoreBadge}>
                          <Text style={styles.scoreBadgeText}>
                            ⭐ {scored.score.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.timeBadge}>
                        <Text style={styles.timeBadgeText}>
                          ⏱ {dish.total_minutes} {STRINGS.common.minutesUnit}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Chi phí ước tính dạng khoảng trong chế độ ước chừng (T13.4) */}
                  {isEstimationMode && (
                    <View style={styles.estimationCostBox} testID={`cost-box-${dish.slug}`}>
                      <Text style={styles.costRangeText}>
                        💰 {STRINGS.home.costEstimatePrefix} {(dish.total_minutes * 1500).toLocaleString('vi-VN')}d -{' '}
                        {(dish.total_minutes * 2500).toLocaleString('vi-VN')}d
                      </Text>
                      <Text style={styles.costNote}>{STRINGS.home.costEstimateNote}</Text>
                    </View>
                  )}

                  {/* Thông số phụ: Độ khó & Dụng cụ */}
                  <View style={styles.dishMetaRow}>
                    <Text style={styles.metaLabel}>
                      {STRINGS.home.cardDifficultyPrefix}{' '}
                      <Text style={styles.metaValue}>
                        {getDifficultyLabel(dish.difficulty)}
                      </Text>
                    </Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.metaLabel}>
                      {STRINGS.home.cardEquipmentPrefix}{' '}
                      <Text style={styles.metaValue}>
                        {dish.equipment.join(', ')}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.dishCardFooter}>
                    <Text style={styles.viewDetailText}>
                      {STRINGS.home.viewDetailButton} →
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  container: {
    padding: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerBtnGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#D9531E',
  },
  greeting: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  pantryHeaderButton: {
    backgroundColor: '#FFF4E6',
    borderWidth: 1,
    borderColor: '#FD7E14',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pantryHeaderButtonText: {
    color: '#D9480F',
    fontSize: 13,
    fontWeight: '700',
  },
  profileButton: {
    backgroundColor: '#EAEAEA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  profileButtonText: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#777777',
    marginBottom: 12,
  },
  suggestControlsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  servingsSelector: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  servingsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    backgroundColor: '#F1F3F5',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
  },
  servingsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#222222',
  },
  mealSelector: {
    flex: 1,
    alignItems: 'flex-end',
  },
  mealButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  mealBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F3F5',
  },
  mealBtnActive: {
    backgroundColor: '#D9531E',
  },
  mealBtnText: {
    fontSize: 12,
    color: '#555555',
  },
  mealBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabelGroup: {
    flex: 1,
    paddingRight: 10,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222222',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#777777',
    marginTop: 2,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444444',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F3F1',
  },
  filterChipSelected: {
    backgroundColor: '#222222',
  },
  filterChipText: {
    fontSize: 12,
    color: '#555555',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
  },
  dishCountBadge: {
    fontSize: 12,
    color: '#777777',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#777777',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  emptyHint: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
  },
  dishList: {
    gap: 12,
  },
  dishCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  dishCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dishName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  scoreBadge: {
    backgroundColor: '#EBFBEE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scoreBadgeText: {
    color: '#2B8A3E',
    fontSize: 11,
    fontWeight: '700',
  },
  timeBadge: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  timeBadgeText: {
    color: '#495057',
    fontSize: 11,
    fontWeight: '600',
  },
  estimationCostBox: {
    backgroundColor: '#FFF9DB',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  costRangeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59F00',
  },
  costNote: {
    fontSize: 10,
    color: '#868E96',
    marginTop: 2,
  },
  dishMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: '#777777',
  },
  metaValue: {
    color: '#333333',
    fontWeight: '600',
  },
  metaDot: {
    marginHorizontal: 6,
    color: '#CCCCCC',
  },
  dishCardFooter: {
    alignItems: 'flex-end',
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D9531E',
  },
});
