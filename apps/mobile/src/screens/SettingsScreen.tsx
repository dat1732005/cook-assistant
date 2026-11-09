/**
 * File: apps/mobile/src/screens/SettingsScreen.tsx
 * Làm gì: Màn hình Cài đặt chứa công tắc bật/tắt đo lường ẩn danh kèm giải thích minh bạch
 *         dữ liệu nào được gửi và dữ liệu nhạy cảm nào không bao giờ gửi (T19.4).
 * Nhận vào: telemetryService (TelemetryService tùy chọn), onBack (callback quay lại).
 * Trả ra: Giao diện Cài đặt hoàn chỉnh cho ứng dụng di động.
 * Ai gọi: MainNavigator (App.tsx) khi người dùng bấm nút Cài đặt trên Trang chủ.
 * Bám theo: docs/tasks.md mục T19.4.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from 'react-native';
import type { SqlDriver } from '@cook/core';
import { STRINGS } from '../constants/strings.js';
import { TelemetryService } from '../services/telemetry-service.js';

export interface SettingsScreenProps {
  telemetryService?: TelemetryService;
  driver?: SqlDriver;
  onBack?: () => void;
}

/**
 * Làm gì: Hiển thị màn hình Cài đặt cho phép bật/tắt đo lường ẩn danh và giải thích dữ liệu gửi đi.
 * Vào: telemetryService (tùy chọn), driver (SqlDriver tùy chọn), onBack (hàm quay lại).
 * Ra: JSX.Element màn hình Cài đặt.
 * Ví dụ: Người dùng gạt công tắc -> lưu 'false' vào app_metadata và dừng mọi ghi nhận/gửi sự kiện.
 * Gọi bởi: MainNavigator trong App.tsx.
 */
export function SettingsScreen({
  telemetryService,
  driver,
  onBack,
}: SettingsScreenProps): React.JSX.Element {
  const activeTelemetryService = useMemo(() => {
    return telemetryService ?? new TelemetryService({ driver });
  }, [telemetryService, driver]);

  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const current = await activeTelemetryService.isEnabled();
        if (isMounted) {
          setTelemetryEnabled(current);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [activeTelemetryService]);

  const handleToggleTelemetry = useCallback(
    async (nextValue: boolean) => {
      setTelemetryEnabled(nextValue);
      await activeTelemetryService.setEnabled(nextValue);
    },
    [activeTelemetryService]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Thanh tiêu đề */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityLabel={STRINGS.common.back}
            testID="settings-back-button"
          >
            <Text style={styles.backButtonText}>‹ {STRINGS.common.back}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text style={styles.headerTitle} testID="settings-header-title">
          {STRINGS.settings.headerTitle}
        </Text>
        <View style={styles.backPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Thẻ công tắc đo lường ẩn danh (T19.4) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {STRINGS.settings.telemetrySectionTitle}
          </Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelGroup}>
              <Text style={styles.toggleLabel}>
                {STRINGS.settings.telemetryToggleLabel}
              </Text>
              <Text
                style={[
                  styles.statusText,
                  telemetryEnabled ? styles.statusEnabled : styles.statusDisabled,
                ]}
                testID="telemetry-status-text"
              >
                {telemetryEnabled
                  ? STRINGS.settings.telemetryStatusEnabled
                  : STRINGS.settings.telemetryStatusDisabled}
              </Text>
            </View>

            <Switch
              value={telemetryEnabled}
              disabled={loading}
              onValueChange={(val) => {
                void handleToggleTelemetry(val);
              }}
              trackColor={{ false: '#CBD5E1', true: '#10B981' }}
              thumbColor="#FFFFFF"
              accessibilityLabel={STRINGS.settings.telemetryToggleLabel}
              testID="telemetry-opt-out-switch"
            />
          </View>

          {/* Giải thích dữ liệu nào được gửi */}
          <View style={styles.explanationBox}>
            <Text style={styles.explanationText} testID="telemetry-data-explanation">
              {STRINGS.settings.telemetryExplanation}
            </Text>
          </View>

          <View style={styles.listSection}>
            <Text style={styles.listHeading}>
              {STRINGS.settings.telemetrySentListTitle}
            </Text>
            {STRINGS.settings.telemetrySentListItems.map((line, index) => (
              <Text key={index} style={styles.listItem}>
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.privacyBox} testID="telemetry-privacy-guarantee">
            <Text style={styles.privacyTitle}>
              🛡️ {STRINGS.settings.telemetryNeverSentTitle}
            </Text>
            {STRINGS.settings.telemetryNeverSentItems.map((line, index) => (
              <Text key={index} style={styles.privacyItem}>
                {line}
              </Text>
            ))}
            <Text style={styles.privacyNote}>
              {STRINGS.settings.telemetryPrivacyGuarantee}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D9531E',
  },
  backPlaceholder: {
    width: 72,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222222',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#222222',
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toggleLabelGroup: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusEnabled: {
    color: '#059669',
  },
  statusDisabled: {
    color: '#DC2626',
  },
  explanationBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  explanationText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  listSection: {
    marginBottom: 14,
  },
  listHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  listItem: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 3,
  },
  privacyBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  privacyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 6,
  },
  privacyItem: {
    fontSize: 13,
    color: '#047857',
    lineHeight: 19,
    marginBottom: 3,
  },
  privacyNote: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 6,
    fontStyle: 'italic',
    lineHeight: 17,
  },
});

