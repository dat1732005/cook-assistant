/**
 * File: apps/mobile/src/screens/PantryScreen.tsx
 * Làm gì: Màn hình Quản lý kho nguyên liệu (T13.2).
 *         Hiển thị danh sách nguyên liệu theo vị trí bảo quản (ngăn mát, ngăn đá, nhiệt độ phòng),
 *         cho phép thêm tay (dẫn sang QuickAdd), sửa lượng bằng một chạm (+ / -), và xóa.
 * Nhận vào: pantryService (PantryService), onOpenQuickAdd, onBack.
 * Trả ra: Giao diện màn hình kho hoàn chỉnh.
 * Bám theo: Mục T13.2 trong docs/tasks.md.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {
  PantryService,
  QUICK_ADD_STORAGE_LOCATIONS,
  roundTo3,
} from '@cook/core';

export interface PantryItemDisplay {
  id: string;
  ingredient_id: string;
  name?: string;
  quantity: number;
  base_unit: string;
  storage_location: string;
  expiry_date?: string | null;
}

export interface PantryScreenProps {
  pantryService: PantryService;
  onOpenQuickAdd: () => void;
  onBack?: () => void;
}

export function PantryScreen({
  pantryService,
  onOpenQuickAdd,
  onBack,
}: PantryScreenProps): React.JSX.Element {
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [items, setItems] = useState<PantryItemDisplay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>('');

  // Tải danh sách lô hàng trong kho
  const loadPantry = useCallback(async () => {
    setLoading(true);
    try {
      // Dùng query lấy trực tiếp các pantry_item còn lượng > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = (pantryService as any).db;
      if (db) {
        const rows = await db.query(
          `SELECT p.*, i.name as ingredient_name
           FROM pantry_item p
           LEFT JOIN ingredient i ON p.ingredient_id = i.id
           WHERE p.quantity > 0
           ORDER BY p.storage_location, p.ingredient_id`
        );
        const mapped: PantryItemDisplay[] = rows.map((r: any) => ({
          id: r.id,
          ingredient_id: r.ingredient_id,
          name: r.ingredient_name || r.ingredient_id,
          quantity: r.quantity,
          base_unit: r.base_unit,
          storage_location: r.storage_location,
          expiry_date: r.expiry_date,
        }));
        setItems(mapped);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pantryService]);

  useEffect(() => {
    void loadPantry();
  }, [loadPantry]);

  // Sửa nhanh một chạm (+delta hoặc -delta)
  const handleQuickAdjust = async (item: PantryItemDisplay, delta: number) => {
    const newQty = roundTo3(Math.max(0, item.quantity + delta));
    try {
      await pantryService.adjust(item.id, newQty);
      setItems((prev) =>
        prev
          .map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i))
          .filter((i) => i.quantity > 0)
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi sửa lượng';
      Alert.alert('Lỗi', msg);
    }
  };

  // Xóa lô kho (sửa về 0)
  const handleDelete = (item: PantryItemDisplay) => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa "${item.name ?? item.ingredient_id}" khỏi kho?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await pantryService.adjust(item.id, 0);
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Lỗi khi xóa';
              Alert.alert('Lỗi', msg);
            }
          },
        },
      ]
    );
  };

  // Lưu chỉnh sửa số lượng bằng tay
  const handleSaveEdit = async (item: PantryItemDisplay) => {
    const val = parseFloat(editQty);
    if (isNaN(val) || val < 0) {
      Alert.alert('Lỗi', 'Số lượng phải không âm.');
      return;
    }
    try {
      await pantryService.adjust(item.id, val);
      setItems((prev) =>
        prev
          .map((i) => (i.id === item.id ? { ...i, quantity: val } : i))
          .filter((i) => i.quantity > 0)
      );
      setEditingId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi sửa lượng';
      Alert.alert('Lỗi', msg);
    }
  };

  // Lọc theo vị trí
  const filteredItems = items.filter((item) => {
    if (selectedLocation === 'all') return true;
    return item.storage_location === selectedLocation;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton} testID="pantry-back-button">
              <Text style={styles.backText}>‹ Quay lại</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Kho nguyên liệu</Text>
          <TouchableOpacity
            style={styles.quickAddBtn}
            onPress={onOpenQuickAdd}
            testID="pantry-open-quick-add-button"
          >
            <Text style={styles.quickAddBtnText}>+ Thêm nhanh</Text>
          </TouchableOpacity>
        </View>

        {/* Tab vị trí bảo quản (T13.2) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, selectedLocation === 'all' && styles.tabActive]}
            onPress={() => setSelectedLocation('all')}
            testID="tab-location-all"
          >
            <Text style={[styles.tabText, selectedLocation === 'all' && styles.tabTextActive]}>
              Tất cả ({items.length})
            </Text>
          </TouchableOpacity>
          {QUICK_ADD_STORAGE_LOCATIONS.map((loc) => {
            const count = items.filter((i) => i.storage_location === loc).length;
            const isActive = selectedLocation === loc;
            return (
              <TouchableOpacity
                key={loc}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setSelectedLocation(loc)}
                testID={`tab-location-${loc}`}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {loc} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Nội dung danh sách */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#D9531E" />
          <Text style={styles.loadingText}>Đang tải kho nguyên liệu...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>Kho đang trống</Text>
          <Text style={styles.emptySubtitle}>
            Thêm nhanh các nguyên liệu bạn đang có để nhận gợi ý món ăn chuẩn xác nhất!
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={onOpenQuickAdd}
            testID="pantry-empty-quick-add-button"
          >
            <Text style={styles.emptyButtonText}>Thêm nguyên liệu ngay</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {filteredItems.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <View key={item.id} style={styles.card} testID={`pantry-card-${item.ingredient_id}`}>
                <View style={styles.cardHeader}>
                  <View style={styles.nameBlock}>
                    <Text style={styles.itemName}>{item.name ?? item.ingredient_id}</Text>
                    <Text style={styles.itemLocation}>📍 {item.storage_location}</Text>
                    {item.expiry_date && (
                      <Text style={styles.itemExpiry}>⏰ Hạn: {item.expiry_date}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    testID={`delete-item-${item.ingredient_id}`}
                  >
                    <Text style={styles.deleteText}>Xóa</Text>
                  </TouchableOpacity>
                </View>

                {/* Sửa lượng bằng một chạm hoặc nhập tay (T13.2) */}
                <View style={styles.quantityRow}>
                  {isEditing ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.editInput}
                        value={editQty}
                        onChangeText={setEditQty}
                        keyboardType="numeric"
                        testID={`edit-qty-input-${item.ingredient_id}`}
                      />
                      <TouchableOpacity
                        style={styles.saveEditBtn}
                        onPress={() => handleSaveEdit(item)}
                        testID={`save-qty-${item.ingredient_id}`}
                      >
                        <Text style={styles.saveEditBtnText}>Lưu</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        setEditingId(item.id);
                        setEditQty(item.quantity.toString());
                      }}
                      testID={`display-qty-${item.ingredient_id}`}
                    >
                      <Text style={styles.qtyDisplay}>
                        {item.quantity} {item.base_unit} ✎
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Nút một chạm: -1 và +1 */}
                  <View style={styles.oneTouchButtons}>
                    <TouchableOpacity
                      style={styles.touchBtn}
                      onPress={() => handleQuickAdjust(item, item.base_unit === 'g' || item.base_unit === 'ml' ? -50 : -1)}
                      testID={`touch-minus-${item.ingredient_id}`}
                    >
                      <Text style={styles.touchBtnText}>
                        -{item.base_unit === 'g' || item.base_unit === 'ml' ? '50' : '1'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.touchBtn}
                      onPress={() => handleQuickAdjust(item, item.base_unit === 'g' || item.base_unit === 'ml' ? 50 : 1)}
                      testID={`touch-plus-${item.ingredient_id}`}
                    >
                      <Text style={styles.touchBtnText}>
                        +{item.base_unit === 'g' || item.base_unit === 'ml' ? '50' : '1'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    marginRight: 8,
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
    flex: 1,
  },
  quickAddBtn: {
    backgroundColor: '#D9531E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F3F3F1',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: '#222222',
  },
  tabText: {
    fontSize: 13,
    color: '#555555',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#D9531E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  nameBlock: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
  },
  itemLocation: {
    fontSize: 12,
    color: '#1971C2',
    marginTop: 3,
  },
  itemExpiry: {
    fontSize: 12,
    color: '#E03131',
    marginTop: 2,
  },
  deleteText: {
    color: '#E03131',
    fontSize: 13,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F6F6F6',
  },
  qtyDisplay: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2B8A3E',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 60,
    fontSize: 14,
  },
  saveEditBtn: {
    backgroundColor: '#D9531E',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  saveEditBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  oneTouchButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  touchBtn: {
    backgroundColor: '#F1F3F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  touchBtnText: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '600',
  },
});
