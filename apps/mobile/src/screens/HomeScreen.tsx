/**
 * File: apps/mobile/src/screens/HomeScreen.tsx
 * Làm gì: Màn hình Trang chủ hiển thị danh sách món ăn gợi ý an toàn từ SQLite, bộ lọc thời gian và nút mở lại hồ sơ.
 * Nhận vào: recipeRepo, profile, callback onOpenProfile, callback onSelectRecipe.
 * Trả ra: Giao diện Trang chủ với danh sách món đã lọc sạch dị ứng và sắp xếp theo tên.
 * Ai gọi: Navigation router / App.tsx.
 * Bám theo: Mục T06.3, T06.6 trong docs/tasks.md và docs/expected/T06.md mục C (C1-C8).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { RecipeRepo, RecipeSummary, UserProfile, getHomeRecipes } from '@cook/core';
import { STRINGS } from '../constants/strings.js';

export interface HomeScreenProps {
  recipeRepo: RecipeRepo;
  profile: UserProfile | null;
  onOpenProfile: () => void;
  onSelectRecipe: (slug: string) => void;
}

/** Các mốc thời gian lọc phổ biến (phút) */
const TIME_FILTER_PRESETS = [null, 9, 15, 20, 30] as const;

export function HomeScreen({
  recipeRepo,
  profile,
  onOpenProfile,
  onSelectRecipe,
}: HomeScreenProps): React.JSX.Element {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [selectedMaxMinutes, setSelectedMaxMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Tải danh sách món ăn từ CSDL SQLite kết hợp lọc an toàn dị ứng và thời gian (C1-C8)
  const loadDishes = useCallback(async () => {
    setLoading(true);
    try {
      // Phân nhánh an toàn: Nếu profile là null (C1), trả về mảng rỗng
      if (!profile) {
        setRecipes([]);
        return;
      }

      const list = await getHomeRecipes(recipeRepo, profile, {
        max_minutes: selectedMaxMinutes ?? undefined,
      });

      setRecipes(list);
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [recipeRepo, profile, selectedMaxMinutes]);

  // Tự động tải lại khi profile hoặc bộ lọc thời gian thay đổi (C5, C6, C7)
  useEffect(() => {
    void loadDishes();
  }, [loadDishes]);

  // Nhãn độ khó hiển thị theo enum 1..3
  const getDifficultyLabel = useCallback((diff: number) => {
    // Phân nhánh độ khó
    if (diff <= 1) {
      return STRINGS.home.difficultyEasy;
    }
    if (diff === 2) {
      return STRINGS.home.difficultyMedium;
    }
    return STRINGS.home.difficultyHard;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Thanh tiêu đề và nút Hồ sơ */}
        <View style={styles.topBar}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.appName}>{STRINGS.common.appName}</Text>
            <Text style={styles.greeting}>{STRINGS.home.greeting}</Text>
          </View>
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

        <Text style={styles.subtitle}>{STRINGS.home.subtitle}</Text>

        {/* Khối bộ lọc thời gian (T06.3, C6, C7) */}
        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>
            {STRINGS.home.filterSectionTitle}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
          <Text style={styles.listTitle}>{STRINGS.home.dishListTitle}</Text>
          <Text style={styles.dishCountBadge}>
            {recipes.length} {STRINGS.common.servingsUnit}
          </Text>
        </View>

        {/* Trạng thái tải dữ liệu */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>{STRINGS.common.loading}</Text>
          </View>
        ) : recipes.length === 0 ? (
          /* Trạng thái danh sách rỗng (khi lọc hoặc dị ứng) */
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
            {recipes.map((dish) => (
              <TouchableOpacity
                key={dish.slug}
                style={styles.dishCard}
                onPress={() => onSelectRecipe(dish.slug)}
                activeOpacity={0.8}
              >
                <View style={styles.dishCardHeader}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeBadgeText}>
                      ⏱ {dish.total_minutes} {STRINGS.common.minutesUnit}
                    </Text>
                  </View>
                </View>

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
            ))}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTextGroup: {
    flex: 1,
  },
  appName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 22,
  },
  profileButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileButtonText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  filterCard: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterChip: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipSelected: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  filterChipTextSelected: {
    color: '#34d399',
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  dishCountBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#94a3b8',
  },
  emptyCard: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  dishList: {
    gap: 14,
  },
  dishCard: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dishCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dishName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
    marginRight: 10,
  },
  timeBadge: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#38bdf8',
  },
  dishMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  metaValue: {
    color: '#cbd5e1',
    fontWeight: '500',
  },
  metaDot: {
    color: '#475569',
    fontSize: 12,
  },
  dishCardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  viewDetailText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
});
