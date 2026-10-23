#!/usr/bin/env node

/**
 * File: scripts/bundle-data.js
 * Làm gì: Đóng gói dữ liệu công thức và danh mục từ data/ vào apps/mobile/assets/data/ (T05.3, B6, B7, B8).
 * Quy tắc:
 *   - B6: Nếu gặp bất kỳ tệp nào có "synthetic": true thì dừng ngay, thoát với mã khác 0 và in tên tệp.
 *   - B7: Bản production (--production) tuyệt đối không cho phép bật cờ dev (--dev).
 *   - B8: Chỉ đóng gói công thức có status là published hoặc reviewed (draft chỉ khi có --dev); không bao giờ lấy từ fixtures/.
 */

import fs from 'node:fs';
import path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  let source = 'data';
  let target = path.join('apps', 'mobile', 'assets', 'data');
  let isDev = false;
  let isProduction = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--source' && i + 1 < args.length) {
      source = args[++i];
    } else if (arg === '--target' && i + 1 < args.length) {
      target = args[++i];
    } else if (arg === '--dev') {
      isDev = true;
    } else if (arg === '--production') {
      isProduction = true;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    isProduction = true;
  }
  if (process.env.ALLOW_DRAFT === 'true') {
    isDev = true;
  }

  return { source, target, isDev, isProduction };
}

function collectJsonFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

export function runBundle(options = {}) {
  const sourceDir = path.resolve(process.cwd(), options.source || 'data');
  const targetDir = path.resolve(
    process.cwd(),
    options.target || path.join('apps', 'mobile', 'assets', 'data')
  );
  const isDev = Boolean(options.isDev);
  const isProduction = Boolean(options.isProduction);

  // B7: Chạy bản build production khi cờ dev nạp draft đang bật -> Thất bại
  if (isProduction && isDev) {
    console.error(
      '[B7-ERROR] Không thể chạy bản build production khi cờ dev nạp draft đang bật. Vui lòng tắt cờ --dev.'
    );
    return { success: false, code: 1, error: 'production-dev-conflict' };
  }

  // B8: Không bao giờ đóng gói fixtures/
  const normSource = path.normalize(sourceDir).replace(/\\/g, '/');
  if (normSource.includes('/fixtures') || normSource.endsWith('/fixtures')) {
    console.error(
      '[B8-ERROR] Nguồn đóng gói không được là thư mục fixtures/. Dữ liệu đóng gói chỉ được lấy từ data/.'
    );
    return { success: false, code: 1, error: 'fixtures-source-forbidden' };
  }

  const jsonFiles = collectJsonFiles(sourceDir);

  // B6: Kiểm tra tệp "synthetic": true
  for (const filePath of jsonFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (data && data.synthetic === true) {
        const relPath = path.relative(process.cwd(), filePath);
        console.error(
          `[B6-ERROR] Phát hiện tệp dữ liệu giả lập (synthetic: true): ${relPath}. Không được đóng gói vào app!`
        );
        return {
          success: false,
          code: 1,
          error: 'synthetic-file-detected',
          offendingFile: relPath,
        };
      }
    } catch {
      // bỏ qua lỗi parse sơ bộ
    }
  }

  // Chuẩn bị thư mục đích
  fs.mkdirSync(targetDir, { recursive: true });

  const bundledRecipes = [];
  let copiedCount = 0;

  for (const filePath of jsonFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Nếu là tệp công thức (có slug và steps/ingredients)
      if (data && data.slug && Array.isArray(data.steps)) {
        if (data.status === 'draft' && !isDev) {
          // B8: Bỏ qua draft khi không bật cờ dev
          continue;
        }

        if (data.status === 'published' || data.status === 'reviewed' || (data.status === 'draft' && isDev)) {
          const relFromSource = path.relative(sourceDir, filePath);
          const destPath = path.join(targetDir, relFromSource);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, JSON.stringify(data, null, 2), 'utf-8');
          bundledRecipes.push(data.slug);
          copiedCount++;
        }
      } else {
        // Tệp danh mục (ingredients.json, equipment.json, etc.)
        const relFromSource = path.relative(sourceDir, filePath);
        const destPath = path.join(targetDir, relFromSource);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, content, 'utf-8');
        copiedCount++;
      }
    } catch (err) {
      console.error(`[ERROR] Không thể đọc tệp ${filePath}:`, err);
    }
  }

  // Tạo tệp manifest phiên bản dữ liệu
  const manifest = {
    data_version: 1,
    generated_at: new Date().toISOString(),
    recipe_count: bundledRecipes.length,
    recipes: bundledRecipes,
  };
  fs.writeFileSync(
    path.join(targetDir, 'bundle-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  console.log(
    `[BUNDLE-SUCCESS] Đã đóng gói ${copiedCount} tệp (${bundledRecipes.length} món) vào ${targetDir}`
  );
  return { success: true, code: 0, recipeCount: bundledRecipes.length, copiedCount };
}

// Chạy trực tiếp qua CLI
const isMain = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`;
if (isMain) {
  const opts = parseArgs();
  const res = runBundle(opts);
  process.exit(res.code);
}
