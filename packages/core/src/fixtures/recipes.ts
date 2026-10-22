/**
 * File: packages/core/src/fixtures/recipes.ts
 * Làm gì: Cung cấp dữ liệu mẫu công thức giả lập (synthetic) phục vụ kiểm thử đơn vị, bao gồm 5 ca hợp lệ (có JSON gốc kế hoạch) và 15 ca sai bắt buộc.
 * Nhận vào: Không có.
 * Trả ra: Các đối tượng mẫu Recipe hợp lệ và danh sách ca vi phạm schema.
 * Ai gọi: packages/core/src/__tests__/schema.test.ts.
 * Bám theo: Mục T02 Nghiệm thu và Bảng bằng chứng trong docs/tasks.md, docs/plan.md dòng 259-300.
 */

/**
 * ĐÁNH DẤU BẮT BUỘC THEO NGUYÊN TẮC R3:
 * Toàn bộ dữ liệu trong file này là dữ liệu giả lập cho test, không đóng gói vào app.
 */
export const SYNTHETIC_FIXTURE_METADATA = {
  synthetic: true,
  description: 'Dữ liệu công thức giả lập phục vụ kiểm thử hợp lệ và bắt lỗi schema',
} as const;

/**
 * Ca hợp lệ 1: Món "Trứng chiên cà chua" - LẤY NGUYÊN VĂN TỪ docs/plan.md (dòng 259-281).
 */
export const VALID_RECIPE_PLAN_ORIGINAL = {
  slug: 'trung-chien-ca-chua',
  name: 'Trứng chiên cà chua',
  servings_base: 2,
  difficulty: 1,
  equipment: ['chao', 'to', 'dao-thot'],
  ingredients: [
    { ingredient: 'trung-ga', qty: 3, unit: 'quả', role: 'structure' as const },
    { ingredient: 'ca-chua', qty: 2, unit: 'quả', role: 'flavor' as const, flavor_group: 'acid' as const },
    { ingredient: 'hanh-la', qty: 1, unit: 'nhánh', role: 'flavor' as const, optional: true },
    { ingredient: 'nuoc-mam', qty: 1, unit: 'thìa cà phê', role: 'flavor' as const, flavor_group: 'salt' as const },
    { ingredient: 'duong', qty: 0.5, unit: 'thìa cà phê', role: 'flavor' as const, flavor_group: 'sugar' as const },
    { ingredient: 'dau-an', qty: 2, unit: 'thìa canh', role: 'moisture' as const },
  ],
  steps: [
    {
      id: 's1',
      title: 'Cắt cà chua',
      kind: 'active' as const,
      seconds: 120,
      after: [],
      resources: ['dao-thot'],
      text: 'Rửa và cắt cà chua thành múi cau.',
    },
    {
      id: 's2',
      title: 'Đánh trứng',
      kind: 'active' as const,
      seconds: 90,
      after: [],
      resources: ['to'],
      text: 'Đập trứng vào tô, thêm nước mắm, đánh đều.',
    },
    {
      id: 's3',
      title: 'Chiên trứng',
      kind: 'active' as const,
      seconds: 180,
      after: ['s2'],
      resources: ['chao'],
      cue: 'Mặt dưới vàng nhẹ thì lật',
      text: 'Cho dầu vào chảo, đổ trứng, chiên chín rồi múc ra đĩa.',
    },
    {
      id: 's4',
      title: 'Xào cà chua',
      kind: 'active' as const,
      seconds: 240,
      after: ['s1', 's3'],
      resources: ['chao'],
      cue: 'Cà chua mềm và ra nước',
      text: 'Xào cà chua với đường đến khi mềm.',
    },
    {
      id: 's5',
      title: 'Trộn và nêm',
      kind: 'active' as const,
      seconds: 60,
      after: ['s4'],
      resources: ['chao'],
      text: 'Cho trứng vào, đảo nhẹ, nêm nếm rồi rắc hành.',
    },
  ],
};

/**
 * Ca hợp lệ 2: Món "Rau muống luộc" (có bước passive tự đun, đầy đủ thông tin metadata).
 */
export const VALID_RECIPE_RAU_MUONG_LUOC = {
  slug: 'rau-muong-luoc',
  name: 'Rau muống luộc',
  servings_base: 4,
  difficulty: 1,
  total_minutes: 15,
  tags: ['luoc', 'mon-rau', 'thanh-dam'],
  equipment: ['noi', 'bep', 'dua', 'ro'],
  ingredients: [
    {
      ingredient: 'rau-muong',
      qty: 500,
      unit: 'g',
      role: 'structure' as const,
      flavor_group: 'none' as const,
      optional: false,
    },
    {
      ingredient: 'muoi',
      qty: 5,
      unit: 'g',
      role: 'flavor' as const,
      flavor_group: 'salt' as const,
      optional: false,
    },
  ],
  steps: [
    {
      id: 'step_1',
      title: 'Nhặt và rửa rau',
      kind: 'active' as const,
      seconds: 240,
      after: [],
      resources: ['ro'],
      text: 'Nhặt bỏ lá già, ngắt đoạn vừa ăn, rửa sạch để ráo nước',
    },
    {
      id: 'step_2',
      title: 'Đun sôi nước luộc',
      kind: 'passive' as const,
      seconds: 300,
      after: [],
      resources: ['noi', 'bep'],
      cue: 'Nước trong nồi sôi sủi tăm mạnh',
      text: 'Cho 1 lít nước vào nồi cùng 5 g muối, bật bếp đun sôi bùng',
    },
    {
      id: 'step_3',
      title: 'Thả rau và luộc chín tới',
      kind: 'active' as const,
      seconds: 120,
      after: ['step_1', 'step_2'],
      resources: ['noi', 'bep', 'dua'],
      cue: 'Cọng rau chín giòn, màu xanh mướt',
      text: 'Thả rau muống vào nồi nước sôi, dùng đũa dìm ngập nước, đun 2 phút',
    },
  ],
  version: 1,
};

/**
 * Ca hợp lệ 3: Món đã được kiểm duyệt (reviewed) có reviewer và reviewed_at.
 */
export const VALID_RECIPE_REVIEWED = {
  slug: 'canh-trung-ca-chua',
  name: 'Canh mây cà chua',
  servings_base: 3,
  difficulty: 1,
  total_minutes: 12,
  status: 'reviewed' as const,
  reviewer: 'Chuyên gia ẩm thực Nguyễn Văn A',
  reviewed_at: '2026-10-20T08:00:00Z',
  tags: ['canh', 'thanh-nhiet'],
  equipment: ['noi', 'bep', 'dua'],
  ingredients: [
    {
      ingredient: 'trung-ga',
      qty: 2,
      unit: 'quả',
      role: 'structure' as const,
      flavor_group: 'fat' as const,
    },
    {
      ingredient: 'ca-chua',
      qty: 2,
      unit: 'quả',
      role: 'moisture' as const,
      flavor_group: 'acid' as const,
    },
  ],
  steps: [
    {
      id: 'step_1',
      title: 'Đun sôi nước cà chua',
      kind: 'active' as const,
      seconds: 180,
      after: [],
      resources: ['noi', 'bep'],
      text: 'Đun sôi nước với cà chua',
    },
    {
      id: 'step_2',
      title: 'Rót trứng tạo vân mây',
      kind: 'active' as const,
      seconds: 120,
      after: ['step_1'],
      resources: ['noi', 'bep', 'dua'],
      text: 'Rót trứng tạo vân mây và tắt bếp',
    },
  ],
  version: 1,
};

/**
 * Ca hợp lệ 4: Món đã phát hành chính thức (published).
 */
export const VALID_RECIPE_PUBLISHED = {
  slug: 'thit-kho-tau',
  name: 'Thịt kho trứng',
  servings_base: 4,
  difficulty: 2,
  total_minutes: 50,
  status: 'published' as const,
  reviewer: 'Hội đồng thẩm định ẩm thực',
  reviewed_at: '2026-10-20T09:00:00Z',
  tags: ['kho', 'dam-da'],
  equipment: ['noi', 'bep', 'dao-thot'],
  ingredients: [
    {
      ingredient: 'thit-ba-chi',
      qty: 500,
      unit: 'g',
      role: 'structure' as const,
      flavor_group: 'fat' as const,
    },
    {
      ingredient: 'trung-ga',
      qty: 4,
      unit: 'quả',
      role: 'structure' as const,
      flavor_group: 'fat' as const,
    },
  ],
  steps: [
    {
      id: 'step_1',
      title: 'Thái thịt và ướp gia vị',
      kind: 'active' as const,
      seconds: 600,
      after: [],
      resources: ['dao-thot'],
      text: 'Thái thịt quân cờ và ướp gia vị',
    },
    {
      id: 'step_2',
      title: 'Ninh thịt',
      kind: 'passive' as const,
      seconds: 1800,
      after: ['step_1'],
      resources: ['noi', 'bep'],
      text: 'Ninh thịt lửa nhỏ cho mềm',
    },
    {
      id: 'step_3',
      title: 'Thêm trứng',
      kind: 'active' as const,
      seconds: 120,
      after: ['step_2'],
      resources: ['noi', 'bep'],
      text: 'Thêm trứng luộc đảo đều và tắt bếp',
    },
  ],
  version: 2,
};

/**
 * Ca hợp lệ 5: Món ăn nhẹ / sinh tố có ghi chú lượng không ép số (amount_note).
 */
export const VALID_RECIPE_SINH_TO = {
  slug: 'sinh-to-bo',
  name: 'Sinh tố bơ',
  servings_base: 1,
  difficulty: 1,
  total_minutes: 5,
  tags: ['thuc-uong', 'trang-mieng'],
  equipment: ['may-xay', 'ly'],
  ingredients: [
    {
      ingredient: 'bo-sap',
      qty: 1,
      unit: 'quả',
      role: 'structure' as const,
      flavor_group: 'fat' as const,
    },
    {
      ingredient: 'sua-dac',
      unit: 'thìa canh',
      amount_note: 'khoảng 2 thìa vừa ngọt',
      role: 'flavor' as const,
      flavor_group: 'sugar' as const,
    },
  ],
  steps: [
    {
      id: 'step_1',
      title: 'Nạo bơ',
      kind: 'active' as const,
      seconds: 120,
      after: [],
      resources: ['may-xay'],
      text: 'Nạo ruột bơ cho vào cối cùng sữa đặc',
    },
    {
      id: 'step_2',
      title: 'Xay nhuyễn',
      kind: 'active' as const,
      seconds: 60,
      after: ['step_1'],
      resources: ['may-xay'],
      text: 'Bấm máy xay nhuyễn mịn trong 60 giây rồi rót ra ly',
    },
  ],
  version: 1,
};

/**
 * Danh sách ít nhất 10 ca cố ý làm sai cấu trúc để kiểm tra validator (Ca sai bắt buộc).
 */
export const INVALID_RECIPE_CASES = [
  {
    name: 'Ca sai 1: Thiếu trường bắt buộc "name" (tên món)',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      name: undefined,
    },
    expectedErrorSubstring: 'name',
  },
  {
    name: 'Ca sai 2: Số phần ăn (servings_base) bằng 0 hoặc âm',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      servings_base: 0,
    },
    expectedErrorSubstring: 'servings_base',
  },
  {
    name: 'Ca sai 3: Trạng thái (status) không thuộc enum cho phép',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      status: 'pending_approval',
    },
    expectedErrorSubstring: 'status',
  },
  {
    name: 'Ca sai 4: Không có bước nào là active (toàn bộ bước là passive)',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      steps: VALID_RECIPE_PLAN_ORIGINAL.steps.map((s) => ({
        ...s,
        kind: 'passive',
      })),
    },
    expectedErrorSubstring: 'active',
  },
  {
    name: 'Ca sai 5: Món reviewed nhưng thiếu người kiểm duyệt (reviewer)',
    data: {
      ...VALID_RECIPE_REVIEWED,
      reviewer: null,
    },
    expectedErrorSubstring: 'reviewer',
  },
  {
    name: 'Ca sai 6: Vai trò nguyên liệu (role) không hợp lệ',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      ingredients: [
        {
          ...VALID_RECIPE_PLAN_ORIGINAL.ingredients[0],
          role: 'magic_role',
        },
      ],
    },
    expectedErrorSubstring: 'role',
  },
  {
    name: 'Ca sai 7: Danh sách nguyên liệu rỗng',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      ingredients: [],
    },
    expectedErrorSubstring: 'ingredients',
  },
  {
    name: 'Ca sai 8: Thời lượng bước (seconds) không dương (<= 0 giây)',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      steps: [
        {
          ...VALID_RECIPE_PLAN_ORIGINAL.steps[0],
          seconds: 0,
        },
      ],
    },
    expectedErrorSubstring: 'seconds',
  },
  {
    name: 'Ca sai 9: Số lượng nguyên liệu (qty) âm và không có amount_note',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      ingredients: [
        {
          ...VALID_RECIPE_PLAN_ORIGINAL.ingredients[0],
          qty: -5,
        },
      ],
    },
    expectedErrorSubstring: 'qty',
  },
  {
    name: 'Ca sai 10: Món published nhưng thiếu ngày kiểm duyệt (reviewed_at)',
    data: {
      ...VALID_RECIPE_PUBLISHED,
      reviewed_at: '',
    },
    expectedErrorSubstring: 'reviewed_at',
  },
  {
    name: 'Ca sai 11: Bước sử dụng dụng cụ không được khai báo trong equipment (vi phạm quy tắc tài nguyên)',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      steps: [
        {
          ...VALID_RECIPE_PLAN_ORIGINAL.steps[0],
          resources: ['noi-ap-suat'], // Dụng cụ này không có trong equipment của món
        },
      ],
    },
    expectedErrorSubstring: 'equipment',
  },
  {
    name: 'Ca sai 12: Bước phụ thuộc vào id bước không tồn tại trong after',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      steps: [
        {
          ...VALID_RECIPE_PLAN_ORIGINAL.steps[0],
          after: ['non_existent_step_id'],
        },
      ],
    },
    expectedErrorSubstring: 'after',
  },
  {
    name: 'Ca sai 13: Vòng lặp phụ thuộc chu trình giữa các bước (s1 sau s2 và s2 sau s1)',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      steps: [
        {
          ...VALID_RECIPE_PLAN_ORIGINAL.steps[0],
          after: ['s2'],
        },
        {
          ...VALID_RECIPE_PLAN_ORIGINAL.steps[1],
          after: ['s1'],
        },
      ],
    },
    expectedErrorSubstring: 'chu trình',
  },
  {
    name: 'Ca sai 14: Độ khó (difficulty) vượt quá khoảng cho phép 1-3',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      difficulty: 5,
    },
    expectedErrorSubstring: 'difficulty',
  },
  {
    name: 'Ca sai 15: Thiếu nội dung hướng dẫn của bước (text để trống)',
    data: {
      ...VALID_RECIPE_PLAN_ORIGINAL,
      steps: [
        {
          ...VALID_RECIPE_PLAN_ORIGINAL.steps[0],
          text: '',
        },
      ],
    },
    expectedErrorSubstring: 'text',
  },
];
