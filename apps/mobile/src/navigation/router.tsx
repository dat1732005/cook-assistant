/**
 * File: apps/mobile/src/navigation/router.tsx
 * Làm gì: Cung cấp hệ thống điều hướng dạng Stack (Navigation Stack) thuần React Native cho 3 màn hình Welcome, Home, RecipeDetail.
 * Nhận vào: Các lệnh điều hướng (navigate, goBack, replace) và tham số màn hình.
 * Trả ra: React Context và Provider quản lý ngăn xếp màn hình cùng hook useNavigation.
 * Ai gọi: App.tsx và toàn bộ các màn hình giao diện.
 * Bám theo: Mục T06.1 trong docs/tasks.md và docs/expected/T06.md mục D1-D3.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { STRINGS } from '../constants/strings.js';

/** Tên các màn hình trong ngăn xếp điều hướng */
export type ScreenName = 'Welcome' | 'Home' | 'RecipeDetail';

/** Cấu trúc một mục trong stack điều hướng */
export interface NavigationRoute {
  name: ScreenName;
  params?: Record<string, unknown>;
}

/** Interface context điều hướng cung cấp cho các màn hình */
export interface NavigationContextType {
  currentRoute: NavigationRoute;
  canGoBack: boolean;
  navigate: (name: ScreenName, params?: Record<string, unknown>) => void;
  replace: (name: ScreenName, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export interface NavigationProviderProps {
  initialRoute: NavigationRoute;
  children: React.ReactNode;
}

/**
 * Provider quản lý ngăn xếp điều hướng dạng Stack.
 */
export function NavigationProvider({
  initialRoute,
  children,
}: NavigationProviderProps): React.JSX.Element {
  const [stack, setStack] = useState<NavigationRoute[]>([initialRoute]);

  // Lấy màn hình hiện tại trên đỉnh ngăn xếp
  const currentRoute = stack[stack.length - 1] ?? initialRoute;
  const canGoBack = stack.length > 1;

  // Đẩy màn hình mới vào ngăn xếp
  const navigate = useCallback((name: ScreenName, params?: Record<string, unknown>) => {
    setStack((prev) => [...prev, { name, params }]);
  }, []);

  // Thay thế màn hình hiện tại trên đỉnh ngăn xếp
  const replace = useCallback((name: ScreenName, params?: Record<string, unknown>) => {
    setStack((prev) => {
      // Phân nhánh: nếu stack rỗng thì chèn mới, ngược lại thay thế đỉnh
      if (prev.length <= 1) {
        return [{ name, params }];
      }
      return [...prev.slice(0, prev.length - 1), { name, params }];
    });
  }, []);

  // Quay lại màn hình trước đó
  const goBack = useCallback(() => {
    setStack((prev) => {
      // Chỉ cho phép quay lại khi ngăn xếp có từ 2 màn hình trở lên
      if (prev.length > 1) {
        return prev.slice(0, prev.length - 1);
      }
      return prev;
    });
  }, []);

  const value = useMemo(
    () => ({
      currentRoute,
      canGoBack,
      navigate,
      replace,
      goBack,
    }),
    [currentRoute, canGoBack, navigate, replace, goBack]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Hook truy cập các thao tác điều hướng.
 */
export function useNavigation(): NavigationContextType {
  const ctx = useContext(NavigationContext);
  // Kiểm tra tính sẵn sàng của context provider
  if (!ctx) {
    throw new Error(STRINGS.common.navigationError);
  }
  return ctx;
}
