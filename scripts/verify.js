/**
 * File: scripts/verify.js
 * Làm gì: Script kiểm định toàn diện hệ thống (T-INFRA), chạy 7 bước kiểm tra chất lượng:
 *         build, test, typecheck, lint, validate-data --strict, quét bí mật, kiểm mã băm docs/expected/.
 * Nhận vào: Tùy chọn dòng lệnh (mặc định in 10 dòng tổng kết; có thể bật --verbose để xem chi tiết).
 * Trả ra: In tối đa 10 dòng tổng kết; mã thoát 0 (đạt toàn bộ) hoặc 1 (có lỗi vi phạm).
 * Ai gọi: Lệnh `pnpm verify` của lập trình viên và quy trình GitHub Actions CI khi push code.
 * Bám theo: docs/tasks.md mục T-INFRA, AGENTS.md, docs/coding-rules.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// ==========================================
// HẰNG SỐ CẤU HÌNH VÀ MÃ THOÁT
// ==========================================
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const TOTAL_VERIFY_STEPS = 8;

/**
 * Bản đồ mã băm SHA-256 đã duyệt của toàn bộ tệp trong docs/expected/.
 * Hỗ trợ cả normalizedSha256 (bỏ CRLF, trimEnd) và rawSha256 để chống sai lệch do git line endings.
 */
const EXPECTED_HASH_CATALOG = {
  'T04.md': {
    description: 'Kỳ vọng Scheduler T04',
    normalizedSha256: '89f77ecc4fa5bd7e104315638572d06c3dbb8f3b61c077ecd007526addae2ca7',
  },
  'T05.md': {
    description: 'Kỳ vọng SQLite & RecipeRepo T05',
    normalizedSha256: '88c74fcaad4374fcd33769ac945ab9b6482f091208524d0e95a1adfcc09628f2',
    rawSha256: '9241082cee18038ba43b20fe0d22b364b303ffc0581641110296ac6397ddbbb8',
  },
  'T06.md': {
    description: 'Kỳ vọng Màn hình & Scaling T06',
    normalizedSha256: 'b598a846a16aafee084b573f55a03d80166275f8edf3a11e31d5eb557c57cd32',
    rawSha256: '5c1d8a73501061b07bf55b164601912786f1ee00ffc11cb798cad593bec8e115',
  },
  'T07.md': {
    description: 'Kỳ vọng Session & Timer T07',
    normalizedSha256: '52249c8a73f4ab4f7b8acadda9f488f65496c74d6da09c7207c299c5ba07b9b1',
    rawSha256: '105ef771f1630ffc29fa9c12e92eda54f62d52be307865802af0f371b2e2c30f',
  },
  'T10.md': {
    description: 'Kỳ vọng PantryService & SuggestService T10-T13',
    normalizedSha256: '26f81826785140b398db511a508645e5fd67d70b03a85766dcc25662d44e16ac',
  },
  'T12.md': {
    description: 'Kỳ vọng Chế độ ước chừng T12 bổ sung',
    normalizedSha256: '5ad30427e5299d96ff40ba916e8e37d50ca5d090ac29fd2be0e6bbe618406ede',
  },
  'README.md': {
    description: 'Mô tả thư mục expected',
    normalizedSha256: '80e5d54528255fd0bbaf24e647f4b219f3a81b1522dc2a5c6f05111e556f140c',
    rawSha256: '95c4ec0c5b34428d177037d291bab2e842625275923cdce6cc56b8beb840b0c8',
  },
};

/**
 * Tìm lệnh Python phù hợp trên môi trường (python3 trên Linux/macOS, python trên Windows).
 * @returns {string} Tên lệnh thực thi python khả dụng.
 * @example
 * // Trên Linux CI:
 * resolvePythonCommand() // -> "python3" hoặc "python"
 */
function resolvePythonCommand() {
  const candidateCommands = ['python3', 'python'];

  // Duyệt qua các ứng viên lệnh để chọn lệnh khả dụng đầu tiên
  for (const cmd of candidateCommands) {
    try {
      const probe = spawnSync(cmd, ['--version'], { stdio: 'pipe' });
      // Nếu lệnh thực thi thành công và trả về mã 0
      if (probe.status === 0) {
        return cmd;
      }
    } catch {
      // Bỏ qua lỗi và tiếp tục thử ứng viên tiếp theo
    }
  }

  // Mặc định trả về python nếu không xác định được lệnh thay thế
  return 'python';
}

/**
 * Thực thi một lệnh ngoài và ghi nhận kết quả thành công / thất bại.
 * @param {string} command Lệnh chính cần gọi (ví dụ: 'pnpm', 'node', 'python')
 * @param {string[]} args Mảng tham số đi kèm
 * @param {boolean} verbose Có in chi tiết stdout/stderr ra màn hình hay không
 * @returns {{ success: boolean; code: number; stdout: string; stderr: string }}
 * @example
 * // Kiểm tra lệnh kiểm tra kiểu dữ liệu:
 * runCommand('pnpm', ['-r', 'run', 'typecheck'], false)
 * // -> { success: true, code: 0, stdout: "...", stderr: "" }
 */
function runCommand(command, args, verbose, cwd) {
  const result = spawnSync(command, args, {
    shell: true,
    encoding: 'utf-8',
    stdio: verbose ? 'inherit' : 'pipe',
    cwd: cwd || process.cwd(),
  });

  const statusCode = result.status ?? EXIT_FAILURE;
  const isOk = statusCode === EXIT_SUCCESS;

  return {
    success: isOk,
    code: statusCode,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * Kiểm tra xuất bản bundle Android production và quét rò rỉ dữ liệu giả lập (Phần 0).
 * @param {boolean} verbose
 * @returns {{ success: boolean; errors: string[] }}
 */
function verifyProductionBundle(verbose) {
  const mobileDir = path.resolve(process.cwd(), 'apps', 'mobile');
  const distDir = path.join(mobileDir, 'dist');

  // Xóa thư mục dist cũ nếu tồn tại
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // Chạy npx expo export --platform android
  const exportRes = runCommand('npx', ['expo', 'export', '--platform', 'android'], verbose, mobileDir);
  if (!exportRes.success) {
    return {
      success: false,
      errors: ['Lệnh expo export thất bại: ' + (exportRes.stderr || exportRes.stdout)],
    };
  }

  const forbiddenTokens = ['synthetic', 'fx-', 'DEV_DATA_BUNDLE'];
  const errors = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else {
        const buf = fs.readFileSync(fullPath);
        for (const token of forbiddenTokens) {
          if (buf.includes(Buffer.from(token))) {
            errors.push(`Rò rỉ chuỗi cấm "${token}" trong bản production: ${entry.name}`);
          }
        }
      }
    }
  }

  scanDir(distDir);

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Kiểm tra tính toàn vẹn và mã băm SHA-256 của toàn bộ tệp trong docs/expected/.
 * @returns {{ success: boolean; message: string; fileCount: number; errors: string[] }}
 * @example
 * // Kiểm tra 4 tệp trong docs/expected/
 * verifyExpectedHashes()
 * // -> { success: true, message: "4 tệp toàn vẹn", fileCount: 4, errors: [] }
 */
function verifyExpectedHashes() {
  const expectedDir = path.resolve(process.cwd(), 'docs', 'expected');

  // Kiểm tra thư mục tồn tại
  if (!fs.existsSync(expectedDir)) {
    return {
      success: false,
      message: 'Không tìm thấy thư mục docs/expected/',
      fileCount: 0,
      errors: ['Thư mục docs/expected/ không tồn tại'],
    };
  }

  const entries = fs.readdirSync(expectedDir);
  const detectedFiles = entries.filter((name) => {
    const fullPath = path.join(expectedDir, name);
    return fs.statSync(fullPath).isFile();
  });

  const errors = [];
  let validCount = 0;

  // Duyệt qua từng tệp thực tế có trong thư mục
  for (const fileName of detectedFiles) {
    const config = EXPECTED_HASH_CATALOG[fileName];

    // Chặn nếu có tệp lạ chưa được đăng ký trong danh mục
    if (!config) {
      errors.push(`Tệp lạ ngoài danh mục trong docs/expected/: ${fileName}`);
      continue;
    }

    const filePath = path.join(expectedDir, fileName);
    const rawBuffer = fs.readFileSync(filePath);
    const rawSha = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    const cleanText = rawBuffer.toString('utf-8').startsWith('\uFEFF')
      ? rawBuffer.toString('utf-8').slice(1)
      : rawBuffer.toString('utf-8');
    const normalizedText = cleanText.replace(/\r\n/g, '\n').trimEnd();
    const normalizedSha = crypto
      .createHash('sha256')
      .update(normalizedText, 'utf-8')
      .digest('hex');

    // Khớp nếu trùng mã băm chuẩn hóa (bất biến CRLF/LF) hoặc trùng mã băm thô
    const isMatched =
      (config.normalizedSha256 && config.normalizedSha256 === normalizedSha) ||
      (config.rawSha256 && config.rawSha256 === rawSha);

    // Xử lý khi mã băm không trùng khớp với bản gốc
    if (!isMatched) {
      errors.push(
        `Tệp ${fileName} bị sửa đổi! (normalized: ${normalizedSha.slice(0, 8)}..., raw: ${rawSha.slice(0, 8)}...)`
      );
    } else {
      validCount++;
    }
  }

  // Kiểm tra xem có tệp kỳ vọng nào bị thiếu không
  for (const requiredName of Object.keys(EXPECTED_HASH_CATALOG)) {
    // Nếu tệp yêu cầu không có trong danh sách tìm thấy
    if (!detectedFiles.includes(requiredName)) {
      errors.push(`Thiếu tệp kỳ vọng bắt buộc: ${requiredName}`);
    }
  }

  const isSuccess = errors.length === 0;
  return {
    success: isSuccess,
    message: isSuccess
      ? `${validCount} tệp khớp 100% mã băm`
      : `${errors.length} lỗi tính toàn vẹn`,
    fileCount: validCount,
    errors,
  };
}

/**
 * Hàm điều phối chính chạy toàn bộ 7 bước kiểm định hệ thống.
 * @param {{ verbose?: boolean }} options Tùy chọn chạy
 * @returns {number} Mã thoát (0 nếu thành công, 1 nếu thất bại)
 */
export function runVerify(options = {}) {
  const verbose = Boolean(options.verbose);
  const stepResults = [];

  // ==========================================
  // BƯỚC 1: Build gói dùng chung @cook/core
  // ==========================================
  const buildRes = runCommand('pnpm', ['--filter', '@cook/core', 'build'], verbose);
  stepResults.push({
    index: 1,
    name: 'Build (@cook/core)',
    success: buildRes.success,
  });

  // ==========================================
  // BƯỚC 2: Toàn bộ kiểm thử tự động (Unit & Acceptance tests)
  // ==========================================
  // Chỉ chạy nếu bước trước thành công
  if (buildRes.success) {
    const testRes = runCommand('pnpm', ['-r', 'run', 'test'], verbose);
    stepResults.push({
      index: 2,
      name: 'Kiểm thử (pnpm test)',
      success: testRes.success,
    });
  } else {
    stepResults.push({ index: 2, name: 'Kiểm thử (pnpm test)', success: false, skipped: true });
  }

  // ==========================================
  // BƯỚC 3: Kiểm tra kiểu dữ liệu tĩnh TypeScript (Typecheck)
  // ==========================================
  const lastStepOk2 = stepResults[stepResults.length - 1]?.success;
  if (lastStepOk2) {
    const typeRes = runCommand('pnpm', ['-r', 'run', 'typecheck'], verbose);
    stepResults.push({
      index: 3,
      name: 'Kiểm tra kiểu (typecheck)',
      success: typeRes.success,
    });
  } else {
    stepResults.push({ index: 3, name: 'Kiểm tra kiểu (typecheck)', success: false, skipped: true });
  }

  // ==========================================
  // BƯỚC 4: Kiểm tra định dạng và chuẩn mã nguồn (ESLint)
  // ==========================================
  const lastStepOk3 = stepResults[stepResults.length - 1]?.success;
  if (lastStepOk3) {
    const lintRes = runCommand('pnpm', ['-r', 'run', 'lint'], verbose);
    stepResults.push({
      index: 4,
      name: 'Chuẩn mã nguồn (ESLint)',
      success: lintRes.success,
    });
  } else {
    stepResults.push({ index: 4, name: 'Chuẩn mã nguồn (ESLint)', success: false, skipped: true });
  }

  // ==========================================
  // BƯỚC 5: Thẩm định dữ liệu nghiêm ngặt (--strict)
  // ==========================================
  const lastStepOk4 = stepResults[stepResults.length - 1]?.success;
  if (lastStepOk4) {
    const dataRes = runCommand('node', ['scripts/validate-data.js', '--strict'], verbose);
    stepResults.push({
      index: 5,
      name: 'Thẩm định dữ liệu (--strict)',
      success: dataRes.success,
    });
  } else {
    stepResults.push({ index: 5, name: 'Thẩm định dữ liệu (--strict)', success: false, skipped: true });
  }

  // ==========================================
  // BƯỚC 6: Quét rò rỉ khóa bí mật và file nhạy cảm
  // ==========================================
  const lastStepOk5 = stepResults[stepResults.length - 1]?.success;
  if (lastStepOk5) {
    const pyCmd = resolvePythonCommand();
    const secretRes = runCommand(pyCmd, ['scripts/scan-secrets.py'], verbose);
    stepResults.push({
      index: 6,
      name: 'Quét bí mật Git (scan-secrets)',
      success: secretRes.success,
    });
  } else {
    stepResults.push({ index: 6, name: 'Quét bí mật Git (scan-secrets)', success: false, skipped: true });
  }

  // ==========================================
  // BƯỚC 7: Kiểm mã băm SHA-256 các file docs/expected/
  // ==========================================
  const hashCheckRes = verifyExpectedHashes();
  stepResults.push({
    index: 7,
    name: `Mã băm docs/expected/ (${Object.keys(EXPECTED_HASH_CATALOG).length} tệp)`,
    success: hashCheckRes.success,
  });

  // ==========================================
  // BƯỚC 8: Xuất bản Production & quét dữ liệu giả lập (Phần 0)
  // ==========================================
  const lastStepOk7 = stepResults[stepResults.length - 1]?.success;
  if (lastStepOk7) {
    const prodRes = verifyProductionBundle(verbose);
    stepResults.push({
      index: 8,
      name: 'Xuất production sạch rác giả (expo export)',
      success: prodRes.success,
    });
  } else {
    stepResults.push({
      index: 8,
      name: 'Xuất production sạch rác giả (expo export)',
      success: false,
      skipped: true,
    });
  }

  // ==========================================
  // IN TỐI ĐA 10 DÒNG TỔNG KẾT THEO YÊU CẦU
  // ==========================================
  const isAllPassed = stepResults.every((s) => s.success);

  console.log('=== KẾT QUẢ KIỂM ĐỊNH HỆ THỐNG (pnpm verify) ===');
  for (const step of stepResults) {
    const statusText = step.skipped
      ? 'BỎ QUA'
      : step.success
        ? 'ĐẠT'
        : 'THẤT BẠI';
    const stepLabel = `[${step.index}/${TOTAL_VERIFY_STEPS}] ${step.name}:`.padEnd(46, '.');
    console.log(`${stepLabel} ${statusText}`);
  }
  console.log('--------------------------------------------------');

  if (isAllPassed) {
    console.log(`TỔNG KẾT: ${TOTAL_VERIFY_STEPS}/${TOTAL_VERIFY_STEPS} BƯỚC ĐẠT. Hệ thống sạch & sẵn sàng!`);
    return EXIT_SUCCESS;
  }

  const failedSteps = stepResults.filter((s) => !s.success).map((s) => `[${s.index}]`).join(', ');
  console.log(`TỔNG KẾT: THẤT BẠI ở bước ${failedSteps}. Cần khắc phục trước khi commit.`);
  return EXIT_FAILURE;
}

// Chạy trực tiếp qua terminal
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isVerbose = process.argv.includes('--verbose');
  const exitCode = runVerify({ verbose: isVerbose });
  process.exit(exitCode);
}
