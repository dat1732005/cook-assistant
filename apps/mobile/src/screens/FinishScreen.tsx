/**
 * File: apps/mobile/src/screens/FinishScreen.tsx
 * Làm gì: Màn hình Hoàn tất món ăn (T09) hiển thị lời chúc mừng sau khi toàn bộ các bước nấu hoàn thành.
 * Nhận vào: recipe (Recipe), totalSeconds (number tùy chọn).
 * Trả ra: Giao diện chúc mừng và nút Về trang chủ.
 * Ai gọi: CookScreen khi bước cuối cùng hoàn tất.
 * Bám theo: Mục T09 trong docs/tasks.md và docs/expected/T07.md.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import type { Recipe } from '@cook/core';
import { useNavigation } from '../navigation/router.js';
import { STRINGS } from '../constants/strings.js';

export interface FinishScreenProps {
  recipe?: Recipe;
  dishName?: string;
}

export function FinishScreen({
  recipe,
  dishName,
}: FinishScreenProps): React.JSX.Element {
  const { replace } = useNavigation();
  const name = dishName || recipe?.name || 'Món ăn';

  const handleBackHome = () => {
    replace('Home');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.celebrationIcon}>🎉 🍳 🍲</Text>
        <Text style={styles.title}>{STRINGS.finish.title}</Text>
        <Text style={styles.dishName}>{name}</Text>
        <Text style={styles.subtitle}>{STRINGS.finish.subtitle}</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleBackHome}
          testID="finish-back-home-button"
        >
          <Text style={styles.homeButtonText}>
            {STRINGS.finish.backToHomeButton}
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
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  celebrationIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#D9531E',
    textAlign: 'center',
    marginBottom: 10,
  },
  dishName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222222',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  footer: {
    width: '100%',
  },
  homeButton: {
    backgroundColor: '#D9531E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
