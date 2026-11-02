/**
 * File: apps/mobile/src/screens/QuickAddScreen.tsx
 * Làm gì: Màn hình Thêm nhanh nguyên liệu vào kho (T11) giúp giảm công nhập liệu.
 * Nhận vào: pantryService (PantryService), onDone, onBack.
 * Trả ra: Giao diện chọn nhiều nguyên liệu, mức "một ít / vừa / nhiều" hoặc nhập tay nếu MISSING,
 *         vị trí bảo quản, và danh sách 15 nguyên liệu hay dùng.
 * Ai gọi: PantryScreen (T13), Navigation router.
 * Bám theo: Mục T11 trong docs/tasks.md (T11.1 - T11.4).
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import {
  PantryService,
  COMMON_15_INGREDIENTS,
  QUICK_ADD_STORAGE_LOCATIONS,
  QuickAddStorageLocation,
  PortionLevel,
  canSelectPortionLevel,
  resolvePortionQuantity,
  searchIngredients,
  batchAddToPantry,
  QuickAddBatchItem,
} from '@cook/core';

export interface SelectedItemState {
  ingredientId: string;
  name: string;
  baseUnit: 'g' | 'ml' | 'cái';
  portionLevel?: PortionLevel;
  customQuantity: string;
  storageLocation: QuickAddStorageLocation;
  isMissingPortion: boolean;
}

export interface QuickAddScreenProps {
  pantryService: PantryService;
  onDone?: () => void;
  onBack?: () => void;
}

export function QuickAddScreen({
  pantryService,
  onDone,
  onBack,
}: QuickAddScreenProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItemState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Danh sách nguyên liệu sau khi lọc tìm kiếm
  const filteredIngredients = useMemo(() => {
    return searchIngredients(searchQuery, [...COMMON_15_INGREDIENTS]);
  }, [searchQuery]);

  // Bật/tắt chọn một nguyên liệu
  const toggleSelectIngredient = (ing: (typeof COMMON_15_INGREDIENTS)[number]) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[ing.id]) {
        delete next[ing.id];
      } else {
        const canPortion = canSelectPortionLevel(ing.id);
        const defaultQty = canPortion ? resolvePortionQuantity(ing.id, 'medium') ?? 1 : 1;
        next[ing.id] = {
          ingredientId: ing.id,
          name: ing.name,
          baseUnit: ing.baseUnit,
          portionLevel: canPortion ? 'medium' : undefined,
          customQuantity: defaultQty.toString(),
          storageLocation: ing.defaultLocation,
          isMissingPortion: !canPortion,
        };
      }
      return next;
    });
  };

  // Thay đổi mức định lượng
  const handleSelectPortionLevel = (ingId: string, level: PortionLevel) => {
    setSelectedItems((prev) => {
      const cur = prev[ingId];
      if (!cur) return prev;
      const qty = resolvePortionQuantity(ingId, level);
      if (qty === null) return prev;
      return {
        ...prev,
        [ingId]: {
          ...cur,
          portionLevel: level,
          customQuantity: qty.toString(),
        },
      };
    });
  };

  // Thay đổi vị trí bảo quản
  const handleSelectLocation = (ingId: string, loc: QuickAddStorageLocation) => {
    setSelectedItems((prev) => {
      const cur = prev[ingId];
      if (!cur) return prev;
      return {
        ...prev,
        [ingId]: { ...cur, storageLocation: loc },
      };
    });
  };

  // Lưu danh sách nguyên liệu vào kho
  const handleSave = async () => {
    const items = Object.values(selectedItems);
    if (items.length === 0) {
      Alert.alert('Chưa chọn nguyên liệu', 'Vui lòng chọn ít nhất một nguyên liệu để thêm vào kho.');
      return;
    }

    const batchItems: QuickAddBatchItem[] = [];
    for (const item of items) {
      const qty = parseFloat(item.customQuantity);
      if (isNaN(qty) || qty <= 0) {
        Alert.alert('Số lượng không hợp lệ', `Số lượng cho "${item.name}" phải lớn hơn 0.`);
        return;
      }
      batchItems.push({
        ingredientId: item.ingredientId,
        quantity: qty,
        baseUnit: item.baseUnit,
        storageLocation: item.storageLocation,
        expiryDate: null, // MVP: để trống theo T11.3
      });
    }

    try {
      setIsSubmitting(true);
      await batchAddToPantry(pantryService, batchItems);
      Alert.alert('Thành công', `Đã thêm ${batchItems.length} nguyên liệu vào kho!`, [
        { text: 'OK', onPress: onDone },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu vào kho';
      Alert.alert('Lỗi', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.keys(selectedItems).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton} testID="quick-add-back-button">
            <Text style={styles.backText}>‹ Quay lại</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Thêm nhanh vào kho</Text>
        <Text style={styles.subtitle}>
          Chọn nhiều nguyên liệu và mức định lượng để thêm nhanh trong dưới 60 giây.
        </Text>
      </View>

      {/* Ô tìm kiếm theo tên chuẩn hoặc tên khác */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên chuẩn hoặc tên gọi khác (vd: hột gà, ba rọi)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="quick-add-search-input"
        />
      </View>

      <ScrollView style={styles.scrollArea}>
        {/* Danh sách 15 nguyên liệu hay dùng */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nguyên liệu hay dùng (15 món phổ biến)</Text>
          <View style={styles.chipContainer}>
            {filteredIngredients.map((ing) => {
              const isSelected = Boolean(selectedItems[ing.id]);
              return (
                <TouchableOpacity
                  key={ing.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleSelectIngredient(ing)}
                  testID={`chip-ingredient-${ing.id}`}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {isSelected ? '✓ ' : '+ '}
                    {ing.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Danh sách nguyên liệu đã chọn và tùy chỉnh định lượng */}
        {selectedCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Chi tiết nguyên liệu đã chọn ({selectedCount})
            </Text>

            {Object.values(selectedItems).map((item) => (
              <View key={item.ingredientId} style={styles.selectedCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedItems((prev) => {
                        const copy = { ...prev };
                        delete copy[item.ingredientId];
                        return copy;
                      })
                    }
                  >
                    <Text style={styles.removeText}>Xóa</Text>
                  </TouchableOpacity>
                </View>

                {/* Chọn mức: một ít / vừa / nhiều (nếu MISSING thì không cho chọn) */}
                <Text style={styles.label}>Định lượng:</Text>
                {item.isMissingPortion ? (
                  <View style={styles.missingPortionNotice}>
                    <Text style={styles.missingPortionText}>
                      ⚠️ Chưa có dữ liệu định lượng (MISSING). Vui lòng nhập số tay:
                    </Text>
                    <View style={styles.customInputRow}>
                      <TextInput
                        style={styles.customInput}
                        keyboardType="numeric"
                        value={item.customQuantity}
                        onChangeText={(txt) =>
                          setSelectedItems((prev) => ({
                            ...prev,
                            [item.ingredientId]: { ...item, customQuantity: txt },
                          }))
                        }
                        testID={`input-custom-qty-${item.ingredientId}`}
                      />
                      <Text style={styles.unitText}>{item.baseUnit}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.portionRow}>
                    <TouchableOpacity
                      style={[
                        styles.portionBtn,
                        item.portionLevel === 'little' && styles.portionBtnSelected,
                      ]}
                      onPress={() => handleSelectPortionLevel(item.ingredientId, 'little')}
                      testID={`portion-little-${item.ingredientId}`}
                    >
                      <Text
                        style={[
                          styles.portionBtnText,
                          item.portionLevel === 'little' && styles.portionBtnTextSelected,
                        ]}
                      >
                        Một ít
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.portionBtn,
                        item.portionLevel === 'medium' && styles.portionBtnSelected,
                      ]}
                      onPress={() => handleSelectPortionLevel(item.ingredientId, 'medium')}
                      testID={`portion-medium-${item.ingredientId}`}
                    >
                      <Text
                        style={[
                          styles.portionBtnText,
                          item.portionLevel === 'medium' && styles.portionBtnTextSelected,
                        ]}
                      >
                        Vừa
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.portionBtn,
                        item.portionLevel === 'lot' && styles.portionBtnSelected,
                      ]}
                      onPress={() => handleSelectPortionLevel(item.ingredientId, 'lot')}
                      testID={`portion-lot-${item.ingredientId}`}
                    >
                      <Text
                        style={[
                          styles.portionBtnText,
                          item.portionLevel === 'lot' && styles.portionBtnTextSelected,
                        ]}
                      >
                        Nhiều
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.quantityDisplay}>
                      = {item.customQuantity} {item.baseUnit}
                    </Text>
                  </View>
                )}

                {/* Chọn vị trí bảo quản (T11.3) */}
                <Text style={styles.label}>Vị trí bảo quản:</Text>
                <View style={styles.locationRow}>
                  {QUICK_ADD_STORAGE_LOCATIONS.map((loc) => {
                    const isLocActive = item.storageLocation === loc;
                    return (
                      <TouchableOpacity
                        key={loc}
                        style={[styles.locBtn, isLocActive && styles.locBtnSelected]}
                        onPress={() => handleSelectLocation(item.ingredientId, loc)}
                        testID={`loc-${loc}-${item.ingredientId}`}
                      >
                        <Text style={[styles.locBtnText, isLocActive && styles.locBtnTextSelected]}>
                          {loc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <Text style={styles.mvpNote}>
              ℹ️ Ngày thêm được tự động điền hôm nay. Hạn dùng để trống ở phiên bản MVP.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer nút Lưu */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, selectedCount === 0 && styles.saveButtonDisabled]}
          disabled={selectedCount === 0 || isSubmitting}
          onPress={handleSave}
          testID="quick-add-save-button"
        >
          <Text style={styles.saveButtonText}>
            {isSubmitting
              ? 'Đang lưu...'
              : `Thêm vào kho (${selectedCount} nguyên liệu)`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginBottom: 6,
  },
  backText: {
    color: '#D9531E',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#222222',
  },
  subtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },
  searchSection: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F3F3F1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222222',
  },
  scrollArea: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipSelected: {
    backgroundColor: '#D9531E',
    borderColor: '#D9531E',
  },
  chipText: {
    fontSize: 13,
    color: '#333333',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
  },
  removeText: {
    color: '#E03131',
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginTop: 6,
    marginBottom: 4,
  },
  portionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  portionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    backgroundColor: '#F9F9F9',
  },
  portionBtnSelected: {
    backgroundColor: '#2B8A3E',
    borderColor: '#2B8A3E',
  },
  portionBtnText: {
    fontSize: 12,
    color: '#444444',
  },
  portionBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quantityDisplay: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222222',
    marginLeft: 4,
  },
  missingPortionNotice: {
    backgroundColor: '#FFF9DB',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  missingPortionText: {
    fontSize: 11,
    color: '#F59F00',
    marginBottom: 4,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    width: 90,
  },
  unitText: {
    fontSize: 13,
    color: '#555555',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 6,
  },
  locBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCCCCC',
    backgroundColor: '#F9F9F9',
  },
  locBtnSelected: {
    backgroundColor: '#1971C2',
    borderColor: '#1971C2',
  },
  locBtnText: {
    fontSize: 12,
    color: '#444444',
  },
  locBtnTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mvpNote: {
    fontSize: 11,
    color: '#888888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#D9531E',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
