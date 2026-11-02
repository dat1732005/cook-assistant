/**
 * File: apps/mobile/src/screens/FinishScreen.tsx
 * Làm gì: Màn hình Hoàn tất món ăn (T09, T13.1).
 *         Hiển thị lời chúc mừng, danh sách nguyên liệu vừa bị trừ kho,
 *         cho phép sửa nhanh từng dòng (adjust), và nút hoàn tác (undoSession).
 * Nhận vào: recipe (Recipe), dishName, sessionId, pantryService, initialDeductions.
 * Trả ra: Giao diện hoàn tất, danh sách đối soát kho, nút hoàn tác và nút về trang chủ.
 * Bám theo: Mục T13.1 trong docs/tasks.md và docs/expected/T10.md ca P9.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import type { Recipe, PantryService } from '@cook/core';
import { useNavigation } from '../navigation/router.js';
import { STRINGS } from '../constants/strings.js';

export interface DeductedItemSummary {
  lotId?: string;
  ingredientId: string;
  name: string;
  deductedAmount: number;
  baseUnit: string;
  currentQuantity: number;
}

export interface FinishScreenProps {
  recipe?: Recipe;
  dishName?: string;
  sessionId?: string;
  pantryService?: PantryService;
  deductedItems?: DeductedItemSummary[];
}

export function FinishScreen({
  recipe,
  dishName,
  sessionId,
  pantryService,
  deductedItems = [],
}: FinishScreenProps): React.JSX.Element {
  const { replace } = useNavigation();
  const name = dishName || recipe?.name || 'Món ăn';

  const [items, setItems] = useState<DeductedItemSummary[]>(deductedItems);
  const [isUndone, setIsUndone] = useState<boolean>(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleBackHome = () => {
    replace('Home');
  };

  // Hoàn tác trừ kho của phiên nấu (T13.1, P9)
  const handleUndo = async () => {
    if (!sessionId || !pantryService) {
      Alert.alert('Thông báo', 'Không có thông tin phiên nấu để hoàn tác.');
      return;
    }

    try {
      await pantryService.undoSession(sessionId);
      setIsUndone(true);
      setUndoError(null);
      Alert.alert('Thành công', 'Đã hoàn tác và khôi phục toàn bộ nguyên liệu vào kho!');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setUndoError(errMsg);
      if (errMsg.includes('ALREADY_UNDONE')) {
        Alert.alert('Lỗi hoàn tác', 'ALREADY_UNDONE: Phiên nấu này đã được hoàn tác trước đó.');
      } else {
        Alert.alert('Lỗi', errMsg);
      }
    }
  };

  // Bắt đầu sửa nhanh một dòng
  const startEdit = (item: DeductedItemSummary) => {
    setEditingLotId(item.lotId ?? item.ingredientId);
    setEditValue(item.currentQuantity.toString());
  };

  // Lưu sửa lượng nhanh của một lô (T13.1: adjust)
  const saveEdit = async (item: DeductedItemSummary) => {
    if (!pantryService || !item.lotId) {
      setEditingLotId(null);
      return;
    }

    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) {
      Alert.alert('Số lượng không hợp lệ', 'Số lượng phải là số không âm.');
      return;
    }

    try {
      await pantryService.adjust(item.lotId, val);
      setItems((prev) =>
        prev.map((i) =>
          (i.lotId ?? i.ingredientId) === (item.lotId ?? item.ingredientId)
            ? { ...i, currentQuantity: val }
            : i
        )
      );
      setEditingLotId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật kho';
      Alert.alert('Lỗi', msg);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.celebrationIcon}>🎉 🍳 🍲</Text>
          <Text style={styles.title}>{STRINGS.finish.title}</Text>
          <Text style={styles.dishName}>{name}</Text>
          <Text style={styles.subtitle}>{STRINGS.finish.subtitle}</Text>
        </View>

        {/* Thông báo trạng thái hoàn tác */}
        {isUndone && (
          <View style={styles.undoneBanner} testID="finish-undone-banner">
            <Text style={styles.undoneBannerText}>
              ✓ Đã hoàn tác trừ kho thành công! Số lượng nguyên liệu đã được phục hồi.
            </Text>
          </View>
        )}

        {undoError && (
          <View style={styles.errorBanner} testID="finish-undo-error-banner">
            <Text style={styles.errorBannerText}>
              ⚠️ {undoError === 'ALREADY_UNDONE' ? 'ALREADY_UNDONE: Phiên nấu đã hoàn tác!' : undoError}
            </Text>
          </View>
        )}

        {/* Danh sách nguyên liệu vừa bị trừ kho (T13.1) */}
        {items.length > 0 && (
          <View style={styles.deductionSection}>
            <Text style={styles.sectionTitle}>Nguyên liệu vừa trừ kho:</Text>
            {items.map((item) => {
              const isEditing = editingLotId === (item.lotId ?? item.ingredientId);
              return (
                <View
                  key={item.lotId ?? item.ingredientId}
                  style={styles.itemRow}
                  testID={`deducted-row-${item.ingredientId}`}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDeducted}>
                      Đã trừ: -{item.deductedAmount} {item.baseUnit}
                    </Text>
                    <Text style={styles.itemRemaining}>
                      Kho còn: {item.currentQuantity} {item.baseUnit}
                    </Text>
                  </View>

                  {/* Sửa nhanh số lượng (T13.1) */}
                  {isEditing ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.editInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="numeric"
                        testID={`edit-input-${item.ingredientId}`}
                      />
                      <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={() => saveEdit(item)}
                        testID={`save-adjust-${item.ingredientId}`}
                      >
                        <Text style={styles.saveBtnText}>Lưu</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => startEdit(item)}
                      testID={`edit-adjust-${item.ingredientId}`}
                    >
                      <Text style={styles.editBtnText}>Sửa</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Nút Hoàn tác (T13.1) */}
        {sessionId && (
          <View style={styles.undoSection}>
            <TouchableOpacity
              style={[styles.undoButton, isUndone && styles.undoButtonDisabled]}
              onPress={handleUndo}
              testID="finish-undo-button"
            >
              <Text style={styles.undoButtonText}>
                {isUndone ? 'Đã hoàn tác' : '⤺ Hoàn tác trừ kho'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.undoNote}>
              Bấm hoàn tác sẽ cộng lại nguyên liệu vào kho. Hoàn tác lần 2 sẽ báo lỗi.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer nút Về trang chủ */}
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
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  celebrationIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#D9531E',
    textAlign: 'center',
    marginBottom: 8,
  },
  dishName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222222',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  undoneBanner: {
    backgroundColor: '#D3F9D8',
    borderColor: '#2B8A3E',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  undoneBannerText: {
    color: '#2B8A3E',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FFE3E3',
    borderColor: '#E03131',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#E03131',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  deductionSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
  },
  itemDeducted: {
    fontSize: 13,
    color: '#D9531E',
    fontWeight: '600',
    marginTop: 2,
  },
  itemRemaining: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  editBtn: {
    backgroundColor: '#F1F3F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '600',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 60,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#D9531E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  undoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  undoButton: {
    backgroundColor: '#FFF4E6',
    borderWidth: 1,
    borderColor: '#FD7E14',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  undoButtonDisabled: {
    backgroundColor: '#F1F3F5',
    borderColor: '#CED4DA',
  },
  undoButtonText: {
    color: '#D9480F',
    fontSize: 15,
    fontWeight: '700',
  },
  undoNote: {
    fontSize: 11,
    color: '#868E96',
    textAlign: 'center',
    marginTop: 6,
  },
  footer: {
    padding: 24,
    paddingTop: 12,
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
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
