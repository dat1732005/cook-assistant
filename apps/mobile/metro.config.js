const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Cho phép resolve các import có đuôi .js sang .ts / .tsx và bỏ qua các module node:* trên mobile
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'node:sqlite' || moduleName.startsWith('node:')) {
    return { type: 'empty' };
  }
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const withoutJs = moduleName.slice(0, -3);
    try {
      return context.resolveRequest(context, withoutJs, platform);
    } catch {
      // fallback
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
