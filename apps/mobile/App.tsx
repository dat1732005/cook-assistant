/**
 * File: apps/mobile/App.tsx
 * Làm gì: Điểm khởi đầu của ứng dụng di động Trợ lý nấu ăn, khởi tạo CSDL SQLite, nạp fixture dev khi chạy môi trường __DEV__, và điều hướng stack 3 màn hình Welcome, Home, RecipeDetail.
 * Nhận vào: driverOverride (tùy chọn phục vụ kiểm thử).
 * Trả ra: Toàn bộ cây thành phần giao diện đã bọc NavigationProvider và StatusBar.
 * Ai gọi: Expo CLI / Metro runtime / Vitest.
 * Bám theo: Mục T06.1 đến T06.7 trong docs/tasks.md và docs/expected/T06.md mục D (D1-D6).
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';
import {
  SqlDriver,
  MigrationRunner,
  loadDataBundle,
  RecipeRepo,
  UserProfileRepo,
  UserProfile,
} from '@cook/core';
import { ExpoSqliteDriver } from './src/db/expo-driver.js';
import {
  NavigationProvider,
  useNavigation,
  NavigationRoute,
} from './src/navigation/router.js';
import { WelcomeScreen } from './src/screens/WelcomeScreen.js';
import { HomeScreen } from './src/screens/HomeScreen.js';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen.js';
import { DEV_DATA_BUNDLE } from './src/data/dev-fixtures.js';
import { STRINGS } from './src/constants/strings.js';

interface MainNavigatorProps {
  recipeRepo: RecipeRepo;
  profileRepo: UserProfileRepo;
  initialProfile: UserProfile | null;
}

/**
 * Thành phần điều hướng chính chuyển đổi giữa 3 màn hình theo đỉnh ngăn xếp (T06.1).
 */
function MainNavigator({
  recipeRepo,
  profileRepo,
  initialProfile,
}: MainNavigatorProps): React.JSX.Element {
  const { currentRoute, navigate, replace, goBack, canGoBack } = useNavigation();
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);

  // Phân nhánh hiển thị theo tên màn hình hiện tại trên đỉnh ngăn xếp
  if (currentRoute.name === 'Welcome') {
    return (
      <WelcomeScreen
        profileRepo={profileRepo}
        initialProfile={profile}
        isEditing={Boolean(currentRoute.params?.isEditing)}
        onProfileSaved={(saved) => {
          setProfile(saved);
          // Sau khi lưu hồ sơ hợp lệ -> chuyển thẳng sang màn Home (D1)
          replace('Home');
        }}
        onBack={canGoBack ? goBack : undefined}
      />
    );
  }

  // Phân nhánh hiển thị màn hình Chi tiết món ăn (D3)
  if (currentRoute.name === 'RecipeDetail') {
    const slug = String(currentRoute.params?.recipeSlug ?? '');
    return (
      <RecipeDetailScreen
        recipeSlug={slug}
        recipeRepo={recipeRepo}
        userServings={profile?.servings ?? 2}
        onBack={goBack}
      />
    );
  }

  // Mặc định hiển thị màn hình Trang chủ (D2)
  return (
    <HomeScreen
      recipeRepo={recipeRepo}
      profile={profile}
      onOpenProfile={() => navigate('Welcome', { isEditing: true })}
      onSelectRecipe={(slug) => navigate('RecipeDetail', { recipeSlug: slug })}
    />
  );
}

export interface AppProps {
  driverOverride?: SqlDriver;
}

/**
 * Ứng dụng chính Trợ lý nấu ăn.
 */
export default function App({ driverOverride }: AppProps): React.JSX.Element {
  const [ready, setReady] = useState<boolean>(false);
  const [recipeRepo, setRecipeRepo] = useState<RecipeRepo | null>(null);
  const [profileRepo, setProfileRepo] = useState<UserProfileRepo | null>(null);
  const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initializeApp() {
      try {
        let driver = driverOverride;

        // Phân nhánh: Dùng driver được truyền vào (khi test) hoặc khởi tạo expo-sqlite
        if (!driver) {
          const db = await SQLite.openDatabaseAsync('cook.db');
          driver = await ExpoSqliteDriver.create(db);
        }

        // Chạy migration đảm bảo đủ 11 bảng SQLite
        const runner = new MigrationRunner(driver);
        await runner.run();

        // Kiểm tra cờ môi trường phát triển: Khi chạy __DEV__ thì nạp bộ fixture mẫu (T06.3, R1, R3)
        const isDev =
          typeof __DEV__ !== 'undefined'
            ? __DEV__
            : process.env.NODE_ENV !== 'production';

        if (isDev) {
          await loadDataBundle(driver, DEV_DATA_BUNDLE, {
            allowDraft: true,
          });
        }

        const pRepo = new UserProfileRepo(driver);
        const rRepo = new RecipeRepo(driver);

        // Đọc hồ sơ hiện tại từ SQLite (D1, D2)
        const currentProfile = await pRepo.getProfile();

        if (isMounted) {
          setProfileRepo(pRepo);
          setRecipeRepo(rRepo);
          setInitialProfile(currentProfile);
          setReady(true);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : STRINGS.common.error;
          setErrorMsg(msg);
        }
      }
    }

    void initializeApp();

    return () => {
      isMounted = false;
    };
  }, [driverOverride]);

  // Trạng thái màn hình chờ khởi động
  if (!ready || !recipeRepo || !profileRepo) {
    return (
      <View style={styles.loadingContainer}>
        {errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>{STRINGS.common.loading}</Text>
          </>
        )}
        <StatusBar style="light" />
      </View>
    );
  }

  // Tuyến điều hướng khởi đầu: Chào mừng nếu chưa có hồ sơ, Trang chủ nếu đã có hồ sơ (D1, D2)
  const initialRoute: NavigationRoute = {
    name: initialProfile ? 'Home' : 'Welcome',
  };

  return (
    <NavigationProvider initialRoute={initialRoute}>
      <MainNavigator
        recipeRepo={recipeRepo}
        profileRepo={profileRepo}
        initialProfile={initialProfile}
      />
      <StatusBar style="light" />
    </NavigationProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
});
