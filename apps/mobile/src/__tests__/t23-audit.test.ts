/**
 * File: apps/mobile/src/__tests__/t23-audit.test.ts
 * Làm gì: Kiểm thử nghiệm thu T23.1 (quét bí mật & địa chỉ viết cứng phủ application*.yml,
 *         docker-compose*.yml, .env.example, mã app & backend kèm ca sai bắt buộc) và
 *         T23.2 (đổi địa chỉ backend app chỉ bằng biến cấu hình EAS/env mà không sửa mã).
 * Nhận vào: scripts/scan-secrets.py, apps/mobile/app.config.ts và thư mục tạm cho ca sai.
 * Trả ra: Bộ kiểm thử Vitest (đạt toàn bộ mới coi là T23.1–T23.2 hợp lệ).
 * Ai gọi: Vitest (`pnpm test`, `pnpm verify`).
 * Bám theo: docs/tasks.md mục T23.1, T23.2 và quy tắc Nghiệm thu bằng bằng chứng.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { buildExpoConfig } from '../../app.config.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_DIR = path.resolve(CURRENT_DIR, '../../../..');
const SCAN_SECRETS_SCRIPT = path.join(REPO_ROOT_DIR, 'scripts', 'scan-secrets.py');

/**
 * Làm gì: Tìm lệnh thực thi Python khả dụng trên hệ điều hành hiện tại (python3 trên Linux/CI, python trên Windows).
 * Vào: Không nhận tham số.
 * Ra: Tên lệnh Python thực thi được ('python3' hoặc 'python').
 * Gọi bởi: runScanSecretsAudit().
 */
function resolvePythonExecutable(): string {
  for (const cmd of ['python3', 'python']) {
    const probe = spawnSync(cmd, ['--version'], { encoding: 'utf-8' });
    if (probe.status === 0) {
      return cmd;
    }
  }
  return 'python';
}

/**
 * Làm gì: Chạy script quét bí mật & địa chỉ viết cứng lên một thư mục dự án mục tiêu.
 * Vào: targetDir (đường dẫn thư mục cần kiểm toán), skipGit (true khi test trên thư mục giả lập trong tmp).
 * Ra: Kết quả { exitCode, output } nguyên văn từ scripts/scan-secrets.py.
 * Ví dụ: Truyền thư mục có application.yml chứa URL JDBC viết cứng -> exitCode === 1.
 * Gọi bởi: Bộ test T23.1 bên dưới.
 */
function runScanSecretsAudit(
  targetDir: string,
  skipGit: boolean
): { exitCode: number; output: string } {
  const pythonCmd = resolvePythonExecutable();
  const args = [SCAN_SECRETS_SCRIPT, '--audit-dir', targetDir];
  // Chỉ bỏ qua pha Git history khi đang kiểm thử thư mục giả lập không có lịch sử commit
  if (skipGit) {
    args.push('--skip-git');
  }

  const res = spawnSync(pythonCmd, args, {
    cwd: REPO_ROOT_DIR,
    encoding: 'utf-8',
  });

  return {
    exitCode: res.status ?? 1,
    output: `${res.stdout ?? ''}\n${res.stderr ?? ''}`,
  };
}

/**
 * Làm gì: Ghi tệp văn bản theo đường dẫn tương đối bên trong thư mục giả lập tạm thời.
 * Vào: baseDir (thư mục gốc giả lập), relPath (đường dẫn tương đối), content (nội dung tệp).
 * Ra: Không trả giá trị; tạo thư mục cha tự động nếu chưa có.
 * Gọi bởi: Ca kiểm thử sạch và ca sai bắt buộc T23.1.
 */
function writeTempRepoFile(baseDir: string, relPath: string, content: string): void {
  const fullPath = path.join(baseDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

describe('T23: Kiểm định cấu hình không viết cứng bí mật/máy chủ và đổi server qua biến EAS', () => {
  it('T23.1: Kho mã nguồn thật sạch hoàn toàn qua mọi application*.yml, docker-compose*.yml, *.env.example, backend và mobile', () => {
    // Bỏ qua Git history trong unit test độc lập để tránh lệ thuộc clone nông nếu môi trường chạy shallow;
    // toàn bộ Git history vẫn được quét mặc định khi gọi `pnpm verify` -> `python scripts/scan-secrets.py`.
    const audit = runScanSecretsAudit(REPO_ROOT_DIR, true);
    expect(audit.exitCode).toBe(0);
    expect(audit.output).toContain('CLEAN');
  });

  it('T23.1 CA SAI BẮT BUỘC: Phải phát hiện và từ chối bí mật hoặc địa chỉ máy chủ viết cứng ở mọi tầng cấu hình và mã app', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cook-t23-negative-'));
    try {
      // 1. Giả lập application.yml viết cứng URL CSDL thật và endpoint AI
      writeTempRepoFile(
        tmpRoot,
        'apps/backend/src/main/resources/application.yml',
        [
          'spring:',
          '  datasource:',
          '    url: jdbc:postgresql://198.51.100.42:5432/cook_prod',
          'cook:',
          '  ai:',
          '    endpoint-url: https://leaked-ai-gateway.invalid/v1',
        ].join('\n')
      );

      // 2. Giả lập docker-compose.yml viết cứng mật khẩu CSDL thay vì ${...}
      const composePassKey = ['POSTGRES_', 'PASSWORD'].join('');
      writeTempRepoFile(
        tmpRoot,
        'deploy/docker-compose.yml',
        [
          'services:',
          '  postgres:',
          '    environment:',
          `      ${composePassKey}: hardcoded-db-value-only-for-test`,
        ].join('\n')
      );

      // 3. Giả lập .env.example bị điền giá trị thay vì để trống
      writeTempRepoFile(tmpRoot, 'deploy/.env.example', 'DEVICE_SALT=should-not-be-filled\n');

      // 4. Giả lập mã Java @Value gán fallback salt viết cứng
      writeTempRepoFile(
        tmpRoot,
        'apps/backend/src/main/java/com/cook/backend/FakeLeak.java',
        'public class FakeLeak { FakeLeak(@Value("${cook.device-salt:hardcoded-fallback-salt}") String s) {} }'
      );

      // 5. Giả lập mã mobile app viết cứng địa chỉ máy chủ backend
      writeTempRepoFile(
        tmpRoot,
        'apps/mobile/src/config/bad-url.ts',
        'export const BAD_SERVER = "http://203.0.113.10:8080/v1";\n'
      );

      const negativeAudit = runScanSecretsAudit(tmpRoot, true);
      expect(negativeAudit.exitCode).toBe(1);
      expect(negativeAudit.output).toContain('[Hardcoded Datasource/Server URL]');
      expect(negativeAudit.output).toContain('[Hardcoded Config Address]');
      expect(negativeAudit.output).toContain('[Hardcoded YAML Secret]');
      expect(negativeAudit.output).toContain('[Non-Empty .env.example Value]');
      expect(negativeAudit.output).toContain('[Java @Value Hardcoded Fallback]');
      expect(negativeAudit.output).toContain('[Hardcoded Server URL in Code]');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('T23.2: Chuyển địa chỉ máy chủ của bản preview/staging chỉ bằng biến môi trường EAS mà không sửa mã nguồn', () => {
    const serverA = 'https://vps-node-a.example.invalid/';
    const serverB = 'https://managed-node-b.example.invalid';

    const configServerA = buildExpoConfig({
      env: {
        EAS_BUILD_PROFILE: 'preview',
        API_BASE_URL: serverA,
      },
    });
    const configServerB = buildExpoConfig({
      env: {
        EAS_BUILD_PROFILE: 'preview',
        API_BASE_URL: serverB,
      },
    });

    // Hai lần dựng cấu hình chỉ khác đúng extra.apiBaseUrl, giữ nguyên môi trường staging và tắt cleartext HTTP
    expect(configServerA.extra?.appEnv).toBe('staging');
    expect(configServerA.extra?.apiBaseUrl).toBe('https://vps-node-a.example.invalid');
    expect(configServerA.extra?.allowCleartextTraffic).toBe(false);

    expect(configServerB.extra?.appEnv).toBe('staging');
    expect(configServerB.extra?.apiBaseUrl).toBe('https://managed-node-b.example.invalid');
    expect(configServerB.extra?.allowCleartextTraffic).toBe(false);
    expect(configServerA.android?.package).toBe(configServerB.android?.package);
  });
});

