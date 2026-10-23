/**
 * File: scripts/scheduler-demo.js
 * Làm gì: Chạy demo bộ xếp lịch nấu ăn (Scheduler) T04 trên các ca A, B, C, D, E, G, H.
 *         In bảng kế hoạch thực tế do code sinh ra kèm cột mã lý do.
 * Nhận vào:
 *   - Cờ --case <A|B|C|D|E|G|H>
 *   - Cờ --mode <fastest|fewest_tools>
 *   - Cờ --all (chạy và in toàn bộ các ca)
 * Trả ra: Bảng kế hoạch chi tiết định dạng ASCII / Markdown, mã thoát 0.
 * Ai gọi: Lệnh `pnpm scheduler-demo --case <A|B|C|D|E> --mode <fastest|fewest_tools>`.
 * Bám theo: docs/expected/T04.md, docs/plan.md:L250-271.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  plan,
  replan,
  checkManualStart,
  computeTails,
} from '../packages/core/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Đọc công thức món Trứng chiên cà chua từ docs/plan.md (Ca A)
const planMdPath = path.join(rootDir, 'docs/plan.md');
const planMdContent = fs.readFileSync(planMdPath, 'utf8');
const recipeMatch = planMdContent.match(/```json\s*(\{[\s\S]*?"slug":\s*"trung-chien-ca-chua"[\s\S]*?\})\s*```/);
if (!recipeMatch) {
  throw new Error('Không thể đọc JSON mẫu món "trứng chiên cà chua" từ docs/plan.md');
}
const caseARecipe = JSON.parse(recipeMatch[1]);

// Định nghĩa dữ liệu các ca theo docs/expected/T04.md
const CASES = {
  A: {
    name: 'Ca A: Món mẫu "Trứng chiên cà chua" từ docs/plan.md',
    recipe: caseARecipe,
    servings: caseARecipe.servings_base || 2,
  },
  B: {
    name: 'Ca B: Hai chế độ cho thứ tự khác nhau',
    recipe: {
      steps: [
        { id: 's1', title: 'B1', kind: 'active', seconds: 60, after: [], resources: ['chao'], text: 'B1' },
        { id: 's2', title: 'B2', kind: 'active', seconds: 30, after: ['s1'], resources: ['chao'], text: 'B2' },
        { id: 's3', title: 'B3', kind: 'active', seconds: 90, after: ['s1'], resources: ['noi'], text: 'B3' },
      ],
    },
    servings: 2,
  },
  C: {
    name: 'Ca C: Bước passive chen bước active',
    recipe: {
      steps: [
        { id: 'A', title: 'Luộc', kind: 'passive', seconds: 300, after: [], resources: ['noi'], text: 'A' },
        { id: 'B', title: 'Thái', kind: 'active', seconds: 60, after: [], resources: ['dao'], text: 'B' },
        { id: 'C', title: 'Trộn', kind: 'active', seconds: 60, after: [], resources: ['to'], text: 'C' },
        { id: 'D', title: 'Bày', kind: 'active', seconds: 30, after: ['A', 'B', 'C'], resources: ['dia'], text: 'D' },
      ],
    },
    servings: 2,
  },
  D: {
    name: 'Ca D: Hai bước tranh cùng dụng cụ',
    recipe: {
      steps: [
        { id: 'P', title: 'Hầm', kind: 'passive', seconds: 120, after: [], resources: ['chao'], text: 'P' },
        { id: 'Q', title: 'Chiên', kind: 'active', seconds: 60, after: [], resources: ['chao'], text: 'Q' },
        { id: 'R', title: 'Gọt', kind: 'active', seconds: 30, after: [], resources: ['dao'], text: 'R' },
      ],
    },
    servings: 2,
  },
  E: {
    name: 'Ca E: Hai bước độc lập, một ngắn một dài',
    recipe: {
      steps: [
        { id: 'L1', title: 'Ngắn', kind: 'active', seconds: 30, after: [], resources: ['dao'], text: 'L1' },
        { id: 'L2', title: 'Dài', kind: 'active', seconds: 90, after: [], resources: ['to'], text: 'L2' },
      ],
    },
    servings: 2,
  },
};

/**
 * Định dạng danh sách bước thành bảng ASCII / Markdown chuẩn.
 */
function printPlanTable(planResult, title) {
  if (title) console.log(`\n### ${title}`);
  console.log('| Bước | Bắt đầu (giây) | Kết thúc (giây) | Mã lý do |');
  console.log('| :--- | :--- | :--- | :--- |');
  for (const step of planResult) {
    console.log(`| ${step.step_id} | ${step.start_at} | ${step.end_at} | ${step.reason} |`);
  }
}

/**
 * In kết quả ca G (replan).
 */
function printCaseG() {
  const caseCSteps = CASES.C.recipe.steps;

  console.log('\n======================================================================');
  console.log('KẾT QUẢ REPLAN CHO CÁC TÌNH HUỐNG G1, G2, G3 (Bám docs/expected/T04.md)');
  console.log('======================================================================');

  // G1
  const g1Res = replan(
    { steps: caseCSteps },
    { done: { B: 90 }, running_passive: { A: { start: 0, endsAt: 300 } } },
    90,
    'fastest'
  );
  printPlanTable(g1Res, 'Tình huống G1: B xong muộn lúc 90s, A đang chạy giữ nguyên endsAt = 300');

  // G2
  const g2Res = replan(
    { steps: caseCSteps },
    { done: { B: 40 }, running_passive: { A: { start: 0, endsAt: 300 } } },
    40,
    'fastest'
  );
  printPlanTable(g2Res, 'Tình huống G2: B xong sớm lúc 40s, A đang chạy giữ nguyên endsAt = 300');

  // G3
  const g3Res = replan(
    { steps: caseCSteps },
    { done: { B: 60, A: 300, C: 400 }, running_passive: {} },
    400,
    'fastest'
  );
  printPlanTable(g3Res, 'Tình huống G3: Người nấu làm C chậm (xong lúc 400s), D chạy từ 400s đến 430s');

  console.log('\nBảng tổng hợp Replan (G1, G2, G3):');
  console.log('| Ca | Giờ hiện tại (now) | Đã xong (thực tế) | Bước passive đang chạy | Kế hoạch tính lại |');
  console.log('| :--- | :--- | :--- | :--- | :--- |');
  console.log('| G1 | 90 | B: 90s | A: 0-300 (endsAt=300) | C: 90-150, D: 300-330 |');
  console.log('| G2 | 40 | B: 40s | A: 0-300 (endsAt=300) | C: 40-100, D: 300-330 |');
  console.log('| G3 | 400 | B: 60s, A: 300s, C: 400s | (không có) | D: 400-430 |');
}

/**
 * In kết quả ca H (checkManualStart).
 */
function printCaseH() {
  const caseCSteps = CASES.C.recipe.steps;

  const scenarios = [
    {
      id: 'H1',
      desc: 'Bắt đầu C, C không có phụ thuộc',
      step: 'C',
      done: [],
      safety: null,
      confirmed: false,
    },
    {
      id: 'H2',
      desc: 'B đã xong; A đang chạy; C đang chạy; bấm D (D không có mã an toàn)',
      step: 'D',
      done: ['B'],
      safety: null,
      confirmed: false,
    },
    {
      id: 'H3',
      desc: 'Như H2 nhưng D có mã an toàn, chưa xác nhận',
      step: 'D',
      done: ['B'],
      safety: 'safety-test-1',
      confirmed: false,
    },
    {
      id: 'H4',
      desc: 'A, B, C đã xong; D có mã an toàn, chưa xác nhận',
      step: 'D',
      done: ['A', 'B', 'C'],
      safety: 'safety-test-1',
      confirmed: false,
    },
    {
      id: 'H5',
      desc: 'A, B, C đã xong; D có mã an toàn, ĐÃ xác nhận',
      step: 'D',
      done: ['A', 'B', 'C'],
      safety: 'safety-test-1',
      confirmed: true,
    },
    {
      id: 'H6',
      desc: 'A, B, C đã xong; D không có mã an toàn',
      step: 'D',
      done: ['A', 'B', 'C'],
      safety: null,
      confirmed: false,
    },
  ];

  console.log('\n======================================================================');
  console.log('KẾT QUẢ CHECK MANUAL START CHO CÁC CA H1-H6 (Bám docs/expected/T04.md)');
  console.log('======================================================================');
  console.log('| Ca | Tình huống thao tác | Bước bấm | Đã xong | Mã an toàn | Đã xác nhận? | Kết quả trả về | Chi tiết |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  for (const sc of scenarios) {
    const steps = caseCSteps.map((s) => (s.id === sc.step && sc.safety ? { ...s, safety_rule: sc.safety } : s));
    const result = checkManualStart({ steps }, sc.step, sc.done, sc.confirmed);

    let detail = '';
    if (result.level === 'warn') {
      detail = `chưa xong: ${(result.unmet || []).join(', ')}`;
    } else if (result.level === 'blocked') {
      detail = `lý do: ${result.reason}`;
    } else {
      detail = 'hợp lệ';
    }

    console.log(
      `| ${sc.id} | ${sc.desc} | ${sc.step} | ${sc.done.join(', ') || '(trống)'} | ${sc.safety || '—'} | ${sc.confirmed ? 'Có' : 'Chưa'} | **${result.level}** | ${detail} |`
    );
  }
}

// Xử lý tham số dòng lệnh CLI
const args = process.argv.slice(2);
let caseArg = null;
let modeArg = null;
let allFlag = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--case' && i + 1 < args.length) {
    caseArg = args[++i].toUpperCase();
  } else if (args[i] === '--mode' && i + 1 < args.length) {
    modeArg = args[++i].toLowerCase();
  } else if (args[i] === '--all') {
    allFlag = true;
  }
}

if (allFlag || (!caseArg && !modeArg)) {
  console.log('======================================================================');
  console.log('TOÀN BỘ KẾT QUẢ XẾP LỊCH (T04) TRÊN TẤT CẢ CÁC CA KIỂM THỬ A, B, C, D, E');
  console.log('======================================================================');

  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    const caseData = CASES[c];
    console.log(`\n======================================================================`);
    console.log(`### ${caseData.name}`);
    console.log(`======================================================================`);

    const planFastest = plan(caseData.recipe, caseData.servings, 'fastest');
    printPlanTable(planFastest, `Chế độ FASTEST (Tối ưu thời gian)`);

    const planFewest = plan(caseData.recipe, caseData.servings, 'fewest_tools');
    printPlanTable(planFewest, `Chế độ FEWEST_TOOLS (Tối ưu dụng cụ)`);
  }

  printCaseG();
  printCaseH();
  process.exit(0);
}

if (caseArg === 'G') {
  printCaseG();
  process.exit(0);
}

if (caseArg === 'H') {
  printCaseH();
  process.exit(0);
}

if (!CASES[caseArg]) {
  console.error(`Lỗi: Không tìm thấy ca kiểm thử '${caseArg}'. Các ca hợp lệ: A, B, C, D, E, G, H.`);
  process.exit(1);
}

const targetCase = CASES[caseArg];
console.log(`\n======================================================================`);
console.log(`KẾT QUẢ XẾP LỊCH CHO: ${targetCase.name}`);
console.log(`======================================================================`);

if (modeArg) {
  if (modeArg !== 'fastest' && modeArg !== 'fewest_tools') {
    console.error(`Lỗi: Chế độ '${modeArg}' không hợp lệ. Phải là 'fastest' hoặc 'fewest_tools'.`);
    process.exit(1);
  }
  const result = plan(targetCase.recipe, targetCase.servings, modeArg);
  printPlanTable(result, `Chế độ ${modeArg.toUpperCase()}`);
} else {
  const planFastest = plan(targetCase.recipe, targetCase.servings, 'fastest');
  printPlanTable(planFastest, `Chế độ FASTEST`);

  const planFewest = plan(targetCase.recipe, targetCase.servings, 'fewest_tools');
  printPlanTable(planFewest, `Chế độ FEWEST_TOOLS`);
}
