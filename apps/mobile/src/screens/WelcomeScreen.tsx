/**
 * File: apps/mobile/src/screens/WelcomeScreen.tsx
 * Làm gì: Màn hình Chào mừng và Thiết lập hồ sơ người dùng (khẩu vị, số người ăn, dị ứng thực phẩm, gia vị và dụng cụ đang có).
 * Nhận vào: profileRepo (UserProfileRepo), profile hiện tại (nếu có), cờ isEditing, callback onSaved.
 * Trả ra: Giao diện hoàn chỉnh lưu trực tiếp vào bảng user_profile trên SQLite.
 * Ai gọi: Navigation router / App.tsx.
 * Bám theo: Mục T06.2, T06.7 trong docs/tasks.md và docs/expected/T06.md mục A (A1-A5).
 */

import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { ALLERGEN_CODES, AllergenCode, UserProfile, UserProfileRepo } from '@cook/core';
import { STRINGS } from '../constants/strings.js';

/** Danh sách gia vị cơ bản để người dùng chọn nhanh */
const BASIC_SPICES = [
  { id: 'muoi', labelKey: 'muoi' as const },
  { id: 'duong', labelKey: 'duong' as const },
  { id: 'nuoc-mam', labelKey: 'nuoc-mam' as const },
  { id: 'dau-an', labelKey: 'dau-an' as const },
  { id: 'tieu', labelKey: 'tieu' as const },
  { id: 'hat-nem', labelKey: 'hat-nem' as const },
];

/** Danh sách dụng cụ bếp phổ biến để người dùng chọn nhanh */
const BASIC_EQUIPMENT = [
  { id: 'chao', labelKey: 'chao' as const },
  { id: 'noi', labelKey: 'noi' as const },
  { id: 'to', labelKey: 'to' as const },
  { id: 'dao-thot', labelKey: 'dao-thot' as const },
  { id: 'bep-ga', labelKey: 'bep-ga' as const },
  { id: 'lo-vi-song', labelKey: 'lo-vi-song' as const },
];

/** Giá trị số phần ăn nhỏ nhất cho phép */
const MIN_SERVINGS_COUNT = 1;

export interface WelcomeScreenProps {
  profileRepo: UserProfileRepo;
  initialProfile?: UserProfile | null;
  isEditing?: boolean;
  onProfileSaved: (profile: UserProfile) => void;
  onBack?: () => void;
}

export function WelcomeScreen({
  profileRepo,
  initialProfile,
  isEditing = false,
  onProfileSaved,
  onBack,
}: WelcomeScreenProps): React.JSX.Element {
  // Khởi tạo trạng thái số người ăn (mặc định 2 hoặc theo hồ sơ đã có)
  const [servings, setServings] = useState<number>(initialProfile?.servings ?? 2);

  // Khởi tạo danh sách dị ứng đã chọn: AllergenCode[] | null (null là chưa khai báo)
  const [allergies, setAllergies] = useState<AllergenCode[] | null>(
    initialProfile?.allergies ?? null
  );

  // Trạng thái xác nhận rõ ràng "không bị dị ứng nào" (A3)
  const [noAllergies, setNoAllergies] = useState<boolean>(
    initialProfile && initialProfile.allergies !== null
      ? initialProfile.allergies.length === 0
      : false
  );

  // Khởi tạo danh sách gia vị đang có
  const [spices, setSpices] = useState<string[]>(
    initialProfile?.essential_spices ?? ['muoi', 'duong', 'dau-an', 'nuoc-mam']
  );

  // Khởi tạo danh sách dụng cụ đang có
  const [equipment, setEquipment] = useState<string[]>(
    initialProfile?.available_equipment ?? ['chao', 'noi', 'to', 'dao-thot']
  );

  const [saving, setSaving] = useState<boolean>(false);

  // Xử lý tăng số người ăn
  const handleIncreaseServings = useCallback(() => {
    setServings((prev) => prev + 1);
  }, []);

  // Xử lý giảm số người ăn (không được nhỏ hơn MIN_SERVINGS_COUNT)
  const handleDecreaseServings = useCallback(() => {
    setServings((prev) => {
      // Chặn không giảm dưới 1
      if (prev > MIN_SERVINGS_COUNT) {
        return prev - 1;
      }
      return prev;
    });
  }, []);

  // Xử lý bật/tắt một mã dị ứng
  const handleToggleAllergen = useCallback((code: AllergenCode) => {
    setNoAllergies(false);
    setAllergies((prev) => {
      const currentList = prev ?? [];
      // Nếu đã có thì bỏ chọn, chưa có thì thêm vào
      if (currentList.includes(code)) {
        return currentList.filter((c) => c !== code);
      }
      return [...currentList, code];
    });
  }, []);

  // Xử lý khi chọn "Không có dị ứng" (A3)
  const handleSelectNoAllergies = useCallback(() => {
    setNoAllergies(true);
    setAllergies([]);
  }, []);

  // Xử lý bật/tắt gia vị
  const handleToggleSpice = useCallback((id: string) => {
    setSpices((prev) => {
      // Phân nhánh bật hoặc tắt gia vị
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  }, []);

  // Xử lý bật/tắt dụng cụ
  const handleToggleEquipment = useCallback((id: string) => {
    setEquipment((prev) => {
      // Phân nhánh bật hoặc tắt dụng cụ
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  }, []);

  // Lưu hồ sơ người dùng thật vào SQLite (A2, A3, A4)
  const handleSave = useCallback(async () => {
    // Kiểm tra tính hợp lệ của số người ăn
    if (servings < MIN_SERVINGS_COUNT) {
      Alert.alert(STRINGS.common.error, STRINGS.welcome.validationErrorServings);
      return;
    }

    // Bắt buộc chọn rõ dị ứng trước khi vào: phải chọn ít nhất một mã dị ứng hoặc chọn "Không có dị ứng"
    if (allergies === null && !noAllergies) {
      Alert.alert(STRINGS.common.error, STRINGS.welcome.validationErrorAllergies);
      return;
    }
    if (Array.isArray(allergies) && allergies.length === 0 && !noAllergies) {
      Alert.alert(STRINGS.common.error, STRINGS.welcome.validationErrorAllergies);
      return;
    }

    try {
      setSaving(true);
      // Gọi UserProfileRepo lưu thật vào bảng SQLite (tuyệt đối không chỉ giữ trên RAM)
      const saved = await profileRepo.saveProfile({
        servings,
        allergies,
        essential_spices: spices,
        available_equipment: equipment,
      });

      onProfileSaved(saved);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : STRINGS.common.error;
      Alert.alert(STRINGS.common.error, errorMsg);
    } finally {
      setSaving(false);
    }
  }, [servings, allergies, noAllergies, spices, equipment, profileRepo, onProfileSaved]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Nút quay lại nếu đang ở chế độ chỉnh sửa từ Home */}
        {isEditing && onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityLabel={STRINGS.common.back}
          >
            <Text style={styles.backButtonText}>← {STRINGS.common.back}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Tiêu đề màn hình */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEditing ? STRINGS.welcome.editTitle : STRINGS.welcome.title}
          </Text>
          <Text style={styles.subtitle}>
            {isEditing ? STRINGS.welcome.editSubtitle : STRINGS.welcome.subtitle}
          </Text>
        </View>

        {/* Khối 1: Số người ăn mỗi bữa */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {STRINGS.welcome.servingsSectionTitle}
          </Text>
          <Text style={styles.sectionHelp}>
            {STRINGS.welcome.servingsHelp}
          </Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                servings <= MIN_SERVINGS_COUNT && styles.stepperButtonDisabled,
              ]}
              onPress={handleDecreaseServings}
              disabled={servings <= MIN_SERVINGS_COUNT}
              accessibilityLabel={STRINGS.detail.servingsDecreaseLabel}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>

            <View style={styles.servingsDisplay}>
              <Text style={styles.servingsValue}>{servings}</Text>
              <Text style={styles.servingsUnit}>
                {STRINGS.common.personUnit}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.stepperButton}
              onPress={handleIncreaseServings}
              accessibilityLabel={STRINGS.detail.servingsIncreaseLabel}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Khối 2: Dị ứng thực phẩm (An toàn sức khỏe bắt buộc) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {STRINGS.welcome.allergiesSectionTitle}
          </Text>
          <Text style={styles.sectionHelp}>
            {STRINGS.welcome.allergiesHelp}
          </Text>

          {/* Tùy chọn không bị dị ứng */}
          <TouchableOpacity
            style={[
              styles.noAllergyOption,
              noAllergies && styles.noAllergyOptionSelected,
            ]}
            onPress={handleSelectNoAllergies}
          >
            <Text
              style={[
                styles.noAllergyText,
                noAllergies && styles.noAllergyTextSelected,
              ]}
            >
              ✓ {STRINGS.welcome.noAllergiesOption}
            </Text>
          </TouchableOpacity>

          {/* Lưới danh mục 8 mã dị ứng chuẩn y tế */}
          <View style={styles.chipGrid}>
            {ALLERGEN_CODES.map((code) => {
              const isSelected = allergies ? allergies.includes(code) : false;
              return (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.chip,
                    isSelected && styles.allergenChipSelected,
                  ]}
                  onPress={() => handleToggleAllergen(code)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.allergenChipTextSelected,
                    ]}
                  >
                    {isSelected ? '⚠ ' : ''}
                    {STRINGS.allergens[code]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Khối 3: Gia vị cơ bản đang có */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {STRINGS.welcome.spicesSectionTitle}
          </Text>
          <Text style={styles.sectionHelp}>
            {STRINGS.welcome.spicesHelp}
          </Text>
          <View style={styles.chipGrid}>
            {BASIC_SPICES.map((spice) => {
              const isSelected = spices.includes(spice.id);
              return (
                <TouchableOpacity
                  key={spice.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => handleToggleSpice(spice.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected,
                    ]}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {STRINGS.spices[spice.labelKey]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Khối 4: Dụng cụ bếp đang có */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {STRINGS.welcome.equipmentSectionTitle}
          </Text>
          <Text style={styles.sectionHelp}>
            {STRINGS.welcome.equipmentHelp}
          </Text>
          <View style={styles.chipGrid}>
            {BASIC_EQUIPMENT.map((tool) => {
              const isSelected = equipment.includes(tool.id);
              return (
                <TouchableOpacity
                  key={tool.id}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => handleToggleEquipment(tool.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected,
                    ]}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {STRINGS.equipment[tool.labelKey]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Nút Lưu hoàn tất */}
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>
            {isEditing
              ? STRINGS.welcome.saveChangesButton
              : STRINGS.welcome.saveButton}
          </Text>
        </TouchableOpacity>
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
    marginBottom: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  sectionHelp: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 20,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stepperButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#38bdf8',
  },
  servingsDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  servingsValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f8fafc',
  },
  servingsUnit: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  noAllergyOption: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noAllergyOptionSelected: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  noAllergyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#cbd5e1',
    textAlign: 'center',
  },
  noAllergyTextSelected: {
    color: '#34d399',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipSelected: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  allergenChipSelected: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
  },
  chipText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#34d399',
    fontWeight: '600',
  },
  allergenChipTextSelected: {
    color: '#fca5a5',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#022c22',
    fontSize: 18,
    fontWeight: '800',
  },
});
