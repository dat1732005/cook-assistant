/**
 * File: apps/mobile/src/screens/PrepareScreen.tsx
 * Làm gì: Màn hình Chuẩn bị (T09) hiển thị nguyên liệu đã scale, dụng cụ cần thiết, và kiểm tra quy tắc an toàn thực phẩm.
 *         Nếu công thức có quy tắc an toàn còn thiếu thông tin (MISSING), chặn bắt đầu món ăn đó để bảo vệ người dùng.
 * Nhận vào: recipe (Recipe), servings (number), mode (OptimizationMode).
 * Trả ra: Giao diện chuẩn bị kèm nút Bắt đầu nấu hoặc thông báo chặn an toàn.
 * Ai gọi: RecipeDetailScreen khi bấm "Bắt đầu nấu món này", router.
 * Bám theo: Mục T09 trong docs/tasks.md và docs/expected/T07.md.
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import type { Recipe } from '@cook/core';
import { scaleIngredients } from '@cook/core';
import { useNavigation } from '../navigation/router.js';
import { STRINGS } from '../constants/strings.js';

export interface PrepareScreenProps {
  recipe: Recipe;
  servings: number;
  mode?: 'fastest' | 'fewest_tools';
}

export function PrepareScreen({
  recipe,
  servings,
  mode = 'fastest',
}: PrepareScreenProps): React.JSX.Element {
  const { navigate, goBack } = useNavigation();

  // Kiểm tra xem công thức có quy tắc an toàn bị thiếu (MISSING) hay không
  const isSafetyMissing = useMemo(() => {
    // 1. Kiểm tra trường missing_fields của công thức
    if (recipe.missing_fields && Array.isArray(recipe.missing_fields)) {
      const hasMissingSafety = recipe.missing_fields.some(
        (f) =>
          typeof f === 'string' &&
          (f.includes('safety') || f.includes('MISSING') || f === 'safety_rule')
      );
      if (hasMissingSafety) return true;
    }

    // 2. Kiểm tra các bước nấu xem có gắn safety_rule là MISSING không
    if (recipe.steps && Array.isArray(recipe.steps)) {
      for (const step of recipe.steps) {
        if (
          step.safety_rule &&
          (step.safety_rule === 'MISSING' ||
            step.safety_rule.toLowerCase().includes('missing'))
        ) {
          return true;
        }
      }
    }

    return false;
  }, [recipe]);

  // Danh sách nguyên liệu đã scale
  const scaledIngredients = useMemo(() => {
    return scaleIngredients(
      recipe.ingredients || [],
      servings,
      recipe.servings_base || 2
    );
  }, [recipe, servings]);

  const handleStart = () => {
    if (isSafetyMissing) {
      Alert.alert(
        STRINGS.prepare.safetyMissingBlockTitle,
        STRINGS.prepare.safetyMissingBlockMessage
      );
      return;
    }

    navigate('Cook', {
      recipe,
      servings,
      mode,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel={STRINGS.common.back}
          onPress={goBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ {STRINGS.common.back}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STRINGS.prepare.headerTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.dishName}>{recipe.name}</Text>
        <Text style={styles.subtitle}>{STRINGS.prepare.subtitle}</Text>

        {/* Khối cảnh báo chặn nếu quy tắc an toàn còn MISSING */}
        {isSafetyMissing && (
          <View style={styles.blockedCard} testID="safety-blocked-card">
            <Text style={styles.blockedTitle}>
              ⚠️ {STRINGS.prepare.safetyMissingBlockTitle}
            </Text>
            <Text style={styles.blockedMessage}>
              {STRINGS.prepare.safetyMissingBlockMessage}
            </Text>
          </View>
        )}

        {/* Danh sách nguyên liệu cần chuẩn bị */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🥗 {STRINGS.prepare.ingredientsHeader} ({servings}{' '}
            {STRINGS.common.servingsUnit})
          </Text>
          {scaledIngredients.map((ing, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.itemText}>
                {ing.ingredient}: {ing.display_amount} {ing.unit}
                {ing.optional ? ` (${STRINGS.common.optionalBadge})` : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* Danh sách dụng cụ cần chuẩn bị */}
        {recipe.equipment && recipe.equipment.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              🍳 {STRINGS.prepare.equipmentHeader}
            </Text>
            {recipe.equipment.map((eq, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemText}>{eq}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Nút bắt đầu nấu hoặc nút bị vô hiệu hóa */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.startButton,
            isSafetyMissing && styles.startButtonDisabled,
          ]}
          onPress={handleStart}
          disabled={isSafetyMissing}
          testID="start-cooking-button"
        >
          <Text style={styles.startButtonText}>
            {STRINGS.prepare.startCookingButton}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 16,
    color: '#D9531E',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222222',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  dishName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#222222',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  blockedCard: {
    backgroundColor: '#FDE8E8',
    borderColor: '#E02424',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  blockedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9B1C1C',
    marginBottom: 6,
  },
  blockedMessage: {
    fontSize: 13,
    color: '#9B1C1C',
    lineHeight: 18,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  bullet: {
    fontSize: 16,
    color: '#D9531E',
    marginRight: 8,
  },
  itemText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  startButton: {
    backgroundColor: '#D9531E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
