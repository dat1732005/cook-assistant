/**
 * File: apps/mobile/babel.config.js
 * Làm gì: Cấu hình Babel cho Expo/Metro, giữ nguyên console.log ở bản development
 *         nhưng tự động loại bỏ console.log / debug / info / trace ở bản build production (T20.5).
 * Nhận vào: Babel ConfigAPI.
 * Trả ra: Cấu hình preset-expo và plugin lược bỏ console.log khi build production.
 * Ai gọi: Metro bundler khi chạy `expo start`, `expo export` hoặc `eas build`.
 * Bám theo: docs/tasks.md mục T20.5.
 */

/** Các phương thức console phục vụ debug cần loại bỏ hoàn toàn ở bản production */
const STRIPPED_CONSOLE_METHODS = new Set(['log', 'debug', 'info', 'trace']);

/**
 * Làm gì: Tạo plugin Babel AST visitor để xóa mọi lệnh console.log/debug/info/trace trong bundle production.
 * Vào: babel ({ types: t }).
 * Ra: Đối tượng Babel plugin có visitor CallExpression và OptionalCallExpression.
 * Gọi bởi: module.exports (khi isProductionBuild = true).
 */
function createStripConsoleProductionPlugin({ types: t }) {
  function isTargetConsoleCall(callee) {
    // Chỉ khớp trực tiếp lời gọi console.<method>(...) không tính computed
    if (!callee) {
      return false;
    }
    const isMember =
      callee.type === 'MemberExpression' ||
      callee.type === 'OptionalMemberExpression';
    if (!isMember || callee.computed) {
      return false;
    }
    return (
      callee.object?.type === 'Identifier' &&
      callee.object.name === 'console' &&
      callee.property?.type === 'Identifier' &&
      STRIPPED_CONSOLE_METHODS.has(callee.property.name)
    );
  }

  return {
    name: 'cook-strip-console-production',
    visitor: {
      CallExpression(path) {
        if (!isTargetConsoleCall(path.node.callee)) {
          return;
        }
        // Xóa hẳn cả statement để không sót lại chuỗi log trong bundle production
        if (path.parentPath.isExpressionStatement()) {
          path.parentPath.remove();
        } else {
          path.replaceWith(t.identifier('undefined'));
        }
      },
      OptionalCallExpression(path) {
        if (!isTargetConsoleCall(path.node.callee)) {
          return;
        }
        if (path.parentPath.isExpressionStatement()) {
          path.parentPath.remove();
        } else {
          path.replaceWith(t.identifier('undefined'));
        }
      },
    },
  };
}

module.exports = function (api) {
  // Xác định bản build non-dev (production) dựa theo caller từ Metro hoặc biến môi trường
  const isProdCaller = api.caller((caller) => {
    if (caller && caller.isDev != null) {
      return caller.isDev === false;
    }
    return (
      process.env.BABEL_ENV === 'production' ||
      process.env.NODE_ENV === 'production'
    );
  });
  const isProductionAppEnv = process.env.APP_ENV === 'production';
  const shouldStripDebugLogs = Boolean(isProdCaller || isProductionAppEnv);

  api.cache.invalidate(
    () =>
      `${isProdCaller ? 'prod' : 'dev'}:${process.env.BABEL_ENV ?? ''}:${process.env.NODE_ENV ?? ''}:${process.env.APP_ENV ?? ''}`
  );

  return {
    presets: ['babel-preset-expo'],
    plugins: shouldStripDebugLogs ? [createStripConsoleProductionPlugin] : [],
  };
};

