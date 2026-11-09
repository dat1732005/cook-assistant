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
  PantryService,
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
import { PrepareScreen } from './src/screens/PrepareScreen.js';
import { CookScreen } from './src/screens/CookScreen.js';
import { FinishScreen } from './src/screens/FinishScreen.js';
import { QuickAddScreen } from './src/screens/QuickAddScreen.js';
import { PantryScreen } from './src/screens/PantryScreen.js';
import { SettingsScreen } from './src/screens/SettingsScreen.js';
import { TelemetryService } from './src/services/telemetry-service.js';
import { STRINGS } from './src/constants/strings.js';

interface MainNavigatorProps {
  recipeRepo: RecipeRepo;
  profileRepo: UserProfileRepo;
  initialProfile: UserProfile | null;
  driver?: SqlDriver;
  telemetryService?: TelemetryService;
}

/**
 * Thành phần điều hướng chính chuyển đổi giữa các màn hình theo đỉnh ngăn xếp.
 */
function MainNavigator({
  recipeRepo,
  profileRepo,
  initialProfile,
  driver,
  telemetryService,
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
        telemetryService={telemetryService}
        onStartCooking={(recipe, servings, mode) => {
          navigate('Prepare', { recipe, servings, mode });
        }}
      />
    );
  }

  // Phân nhánh hiển thị màn hình Chuẩn bị (T09)
  if (currentRoute.name === 'Prepare') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = currentRoute.params?.recipe as any;
    return (
      <PrepareScreen
        recipe={rec}
        servings={Number(currentRoute.params?.servings || profile?.servings || 2)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mode={currentRoute.params?.mode as any}
      />
    );
  }

  // Phân nhánh hiển thị màn hình Nấu trực tiếp (T09)
  if (currentRoute.name === 'Cook') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = currentRoute.params?.recipe as any;
    return (
      <CookScreen
        recipe={rec}
        servings={Number(currentRoute.params?.servings || profile?.servings || 2)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mode={currentRoute.params?.mode as any}
        driver={driver}
        telemetryService={telemetryService}
      />
    );
  }

  // Phân nhánh hiển thị màn hình Hoàn tất món ăn (T09, T13.1)
  if (currentRoute.name === 'Finish') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = currentRoute.params?.recipe as any;
    const pantryService = driver ? new PantryService(driver) : undefined;
    return (
      <FinishScreen
        recipe={rec}
        dishName={currentRoute.params?.dishName as string}
        sessionId={currentRoute.params?.sessionId as string}
        pantryService={pantryService}
        telemetryService={telemetryService}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deductedItems={currentRoute.params?.deductedItems as any}
      />
    );
  }

  // Phân nhánh hiển thị màn hình Thêm nhanh nguyên liệu (T11)
  if (currentRoute.name === 'QuickAdd' && driver) {
    const pantryService = new PantryService(driver);
    return (
      <QuickAddScreen
        pantryService={pantryService}
        onDone={() => goBack()}
        onBack={canGoBack ? goBack : undefined}
      />
    );
  }

  // Phân nhánh hiển thị màn hình Kho nguyên liệu (T13.2)
  if (currentRoute.name === 'Pantry' && driver) {
    const pantryService = new PantryService(driver);
    return (
      <PantryScreen
        pantryService={pantryService}
        onOpenQuickAdd={() => navigate('QuickAdd')}
        onBack={canGoBack ? goBack : undefined}
      />
    );
  }

  // Phân nhánh hiển thị màn hình Cài đặt & quyền riêng tư đo lường (T19.4)
  if (currentRoute.name === 'Settings') {
    return (
      <SettingsScreen
        telemetryService={telemetryService}
        driver={driver}
        onBack={canGoBack ? goBack : undefined}
      />
    );
  }

  // Mặc định hiển thị màn hình Trang chủ (D2, T13.3, T13.4, T19.4)
  const homePantryService = driver ? new PantryService(driver) : undefined;
  return (
    <HomeScreen
      recipeRepo={recipeRepo}
      profile={profile}
      pantryService={homePantryService}
      onOpenPantry={() => navigate('Pantry')}
      onOpenProfile={() => navigate('Welcome', { isEditing: true })}
      onOpenSettings={() => navigate('Settings')}
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
  const [activeDriver, setActiveDriver] = useState<SqlDriver | null>(null);
  const [recipeRepo, setRecipeRepo] = useState<RecipeRepo | null>(null);
  const [profileRepo, setProfileRepo] = useState<UserProfileRepo | null>(null);
  const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);
  const [telemetryService, setTelemetryService] = useState<TelemetryService | null>(null);
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
        // Trong bản build production, khối if (__DEV__) và require bên trong được loại bỏ hoàn toàn (DCE).
        if (__DEV__) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { DEV_DATA_BUNDLE } = require('./src/data/dev-fixtures.js');
          await loadDataBundle(driver, DEV_DATA_BUNDLE, {
            allowDraft: true,
          });
        }

        const pRepo = new UserProfileRepo(driver);
        const rRepo = new RecipeRepo(driver);
        const tService = new TelemetryService({ driver });
        await tService.init();
        void tService.flushPendingEvents();

        // Đọc hồ sơ hiện tại từ SQLite (D1, D2)
        const currentProfile = await pRepo.getProfile();

        if (isMounted) {
          setActiveDriver(driver);
          setProfileRepo(pRepo);
          setRecipeRepo(rRepo);
          setTelemetryService(tService);
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

  // Tuyến điều hướng khởi đầu: Chào mừng nếu chưa có hồ sơ hoặc chưa khai dị ứng, Trang chủ nếu đã hoàn thành (D1, D2)
  const initialRoute: NavigationRoute = {
    name: initialProfile && initialProfile.allergies !== null ? 'Home' : 'Welcome',
  };

  return (
    <NavigationProvider initialRoute={initialRoute}>
      <MainNavigator
        recipeRepo={recipeRepo}
        profileRepo={profileRepo}
        initialProfile={initialProfile}
        driver={activeDriver || undefined}
        telemetryService={telemetryService || undefined}
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
