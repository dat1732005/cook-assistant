/**
 * File: packages/core/src/fixtures/recipes.ts
 * Mục đích: Cung cấp dữ liệu mẫu công thức giả lập (synthetic) phục vụ kiểm thử đơn vị.
 * Nhận vào: Không có.
 * Trả ra: Các đối tượng mẫu công thức hợp lệ và các ca cố tình tạo sai.
 * Ai gọi: Các file kiểm thử trong packages/core/src/__tests__/.
 * Bám theo: Mục T02, R3 (Tách dữ liệu thật khỏi dữ liệu giả), và R4 trong docs/tasks.md.
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
 * Ca hợp lệ 1: Món "Trứng chiên cà chua" chuẩn (Mục T02 Nghiệm thu).
 */
export const VALID_RECIPE_TRUNG_CHIEN_CA_CHUA = {
  synthetic: true,
  id: 'recipe_trung_chien_ca_chua',
  slug: 'trung-chien-ca-chua',
  title: 'Trứng chiên cà chua',
  description: 'Món ăn gia đình nhanh gọn, giàu dinh dưỡng và dễ làm',
  servings: 2,
  prepTime: 300,
  cookTime: 420,
  status: 'draft' as const,
  equipment: ['chao', 'bep', 'to', 'dua', 'dao_thot'],
  ingredients: [
    {
      ingredientId: 'trung_ga',
      amount: 3,
      unit: 'quả',
      role: 'structure' as const,
      tasteGroup: 'fat' as const,
      isOptional: false,
      substitutes: ['trung_vit'],
    },
    {
      ingredientId: 'ca_chua',
      amount: 2,
      unit: 'quả',
      role: 'moisture' as const,
      tasteGroup: 'acid' as const,
      isOptional: false,
      substitutes: [],
    },
    {
      ingredientId: 'hanh_la',
      amount: 2,
      unit: 'nhánh',
      role: 'color' as const,
      tasteGroup: 'none' as const,
      isOptional: true,
      substitutes: [],
    },
    {
      ingredientId: 'nuoc_mam',
      amount: 5,
      unit: 'ml',
      role: 'flavor' as const,
      tasteGroup: 'salt' as const,
      isOptional: false,
      substitutes: ['muoi'],
    },
    {
      ingredientId: 'dau_an',
      amount: 15,
      unit: 'ml',
      role: 'flavor' as const,
      tasteGroup: 'fat' as const,
      isOptional: false,
      substitutes: [],
    },
  ],
  steps: [
    {
      id: 'step_1',
      order: 1,
      title: 'Sơ chế cà chua và hành lá',
      instruction: 'Cà chua rửa sạch bổ múi cau, hành lá rửa sạch thái nhỏ',
      type: 'active' as const,
      duration: 180,
      after: [],
      resources: ['dao_thot'],
      cue: 'Cà chua thái đều miếng, hành lá thái mịn',
    },
    {
      id: 'step_2',
      order: 2,
      title: 'Đánh tan trứng',
      instruction: 'Đập 3 quả trứng vào tô, thêm 5 ml nước mắm, dùng đũa đánh tan đều',
      type: 'active' as const,
      duration: 120,
      after: [],
      resources: ['to', 'dua'],
      cue: 'Lòng đỏ và lòng trắng quyện đều, sủi bọt khí nhỏ',
    },
    {
      id: 'step_3',
      order: 3,
      title: 'Xào sốt cà chua',
      instruction: 'Bắc chảo lên bếp, cho 15 ml dầu ăn, trút cà chua vào xào lửa vừa',
      type: 'active' as const,
      duration: 180,
      after: ['step_1'],
      resources: ['chao', 'bep'],
      cue: 'Cà chua chín mềm nhuyễn, tạo thành nước sốt sền sệt màu đỏ cam',
    },
    {
      id: 'step_4',
      order: 4,
      title: 'Đổ trứng vào rán',
      instruction: 'Đổ từ từ bát trứng vào chảo cà chua, để lửa vừa cho trứng đông',
      type: 'passive' as const,
      duration: 150,
      after: ['step_2', 'step_3'],
      resources: ['chao', 'bep'],
      cue: 'Viền trứng se lại và phồng nhẹ, mặt trên còn hơi ướt',
    },
    {
      id: 'step_5',
      order: 5,
      title: 'Đảo miếng và hoàn tất',
      instruction: 'Dùng đũa đẩy nhẹ các mảng trứng, rắc hành lá thái nhỏ rồi tắt bếp',
      type: 'active' as const,
      duration: 90,
      after: ['step_4'],
      resources: ['chao', 'bep'],
      cue: 'Trứng chín mềm xốp, hành lá dậy mùi thơm',
    },
  ],
  version: 1,
  source: 'Công thức gia đình truyền thống',
  confirmedBy: 'Người biết nấu',
};

/**
 * Ca hợp lệ 2: Món "Rau muống luộc" (đơn giản, có bước passive tự đun).
 */
export const VALID_RECIPE_RAU_MUONG_LUOC = {
  synthetic: true,
  id: 'recipe_rau_muong_luoc',
  slug: 'rau-muong-luoc',
  title: 'Rau muống luộc',
  description: 'Món rau luộc thanh mát, giữ được màu xanh giòn ngọt',
  servings: 4,
  prepTime: 240,
  cookTime: 360,
  status: 'draft' as const,
  equipment: ['noi', 'bep', 'dua', 'ro'],
  ingredients: [
    {
      ingredientId: 'rau_muong',
      amount: 500,
      unit: 'g',
      role: 'structure' as const,
      tasteGroup: 'none' as const,
      isOptional: false,
      substitutes: [],
    },
    {
      ingredientId: 'muoi',
      amount: 5,
      unit: 'g',
      role: 'flavor' as const,
      tasteGroup: 'salt' as const,
      isOptional: false,
      substitutes: [],
    },
  ],
  steps: [
    {
      id: 'step_1',
      order: 1,
      title: 'Nhặt và rửa rau',
      instruction: 'Nhặt bỏ lá già, ngắt đoạn vừa ăn, rửa sạch để ráo nước',
      type: 'active' as const,
      duration: 240,
      after: [],
      resources: ['ro'],
    },
    {
      id: 'step_2',
      order: 2,
      title: 'Đun sôi nước luộc',
      instruction: 'Cho 1 lít nước vào nồi cùng 5 g muối, bật bếp đun sôi bùng',
      type: 'passive' as const,
      duration: 300,
      after: [],
      resources: ['noi', 'bep'],
      cue: 'Nước trong nồi sôi sủi tăm mạnh',
    },
    {
      id: 'step_3',
      order: 3,
      title: 'Thả rau và luộc chín tới',
      instruction: 'Thả rau muống vào nồi nước sôi, dùng đũa dìm ngập nước, đun 2 phút',
      type: 'active' as const,
      duration: 120,
      after: ['step_1', 'step_2'],
      resources: ['noi', 'bep', 'dua'],
      cue: 'Cọng rau chín giòn, màu xanh mướt',
    },
  ],
  version: 1,
};

/**
 * Ca hợp lệ 3: Món đã được kiểm duyệt (reviewed).
 */
export const VALID_RECIPE_REVIEWED = {
  synthetic: true,
  id: 'recipe_canh_trung_ca_chua',
  slug: 'canh-trung-ca-chua',
  title: 'Canh mây cà chua',
  servings: 3,
  prepTime: 180,
  cookTime: 300,
  status: 'reviewed' as const,
  reviewedBy: 'Chuyên gia ẩm thực Nguyễn Văn A',
  reviewedAt: '2026-10-20T08:00:00Z',
  equipment: ['noi', 'bep'],
  ingredients: [
    {
      ingredientId: 'trung_ga',
      amount: 2,
      unit: 'cái',
      role: 'structure' as const,
      tasteGroup: 'fat' as const,
    },
    {
      ingredientId: 'ca_chua',
      amount: 2,
      unit: 'cái',
      role: 'moisture' as const,
      tasteGroup: 'acid' as const,
    },
  ],
  steps: [
    {
      id: 'step_1',
      order: 1,
      instruction: 'Đun sôi nước với cà chua',
      type: 'active' as const,
      duration: 180,
      after: [],
      resources: ['noi', 'bep'],
    },
    {
      id: 'step_2',
      order: 2,
      instruction: 'Rót trứng tạo vân mây',
      type: 'active' as const,
      duration: 120,
      after: ['step_1'],
      resources: ['noi', 'bep'],
    },
  ],
  version: 1,
};

/**
 * Ca hợp lệ 4: Món đã phát hành chính thức (published).
 */
export const VALID_RECIPE_PUBLISHED = {
  synthetic: true,
  id: 'recipe_thit_kho_tau',
  slug: 'thit-kho-tau',
  title: 'Thịt kho trứng',
  servings: 4,
  prepTime: 600,
  cookTime: 1800,
  status: 'published' as const,
  reviewedBy: 'Hội đồng thẩm định ẩm thực',
  reviewedAt: '2026-10-20T09:00:00Z',
  equipment: ['noi', 'bep', 'dao_thot'],
  ingredients: [
    {
      ingredientId: 'thit_ba_chi',
      amount: 500,
      unit: 'g',
      role: 'structure' as const,
      tasteGroup: 'fat' as const,
    },
    {
      ingredientId: 'trung_ga',
      amount: 4,
      unit: 'cái',
      role: 'structure' as const,
      tasteGroup: 'fat' as const,
    },
  ],
  steps: [
    {
      id: 'step_1',
      order: 1,
      instruction: 'Thái thịt quân cờ và ướp gia vị',
      type: 'active' as const,
      duration: 600,
      after: [],
      resources: ['dao_thot'],
    },
    {
      id: 'step_2',
      order: 2,
      instruction: 'Ninh thịt lửa nhỏ cho mềm',
      type: 'passive' as const,
      duration: 1800,
      after: ['step_1'],
      resources: ['noi', 'bep'],
    },
    {
      id: 'step_3',
      order: 3,
      instruction: 'Thêm trứng luộc đảo đều và tắt bếp',
      type: 'active' as const,
      duration: 120,
      after: ['step_2'],
      resources: ['noi', 'bep'],
    },
  ],
  version: 2,
};

/**
 * Ca hợp lệ 5: Món ăn nhẹ / đồ uống đơn giản.
 */
export const VALID_RECIPE_SINH_TO = {
  synthetic: true,
  id: 'recipe_sinh_to_bo',
  slug: 'sinh-to-bo',
  title: 'Sinh tố bơ',
  servings: 1,
  prepTime: 120,
  cookTime: 60,
  status: 'draft' as const,
  equipment: ['may_xay', 'ly'],
  ingredients: [
    {
      ingredientId: 'bo_sap',
      amount: 1,
      unit: 'cái',
      role: 'structure' as const,
      tasteGroup: 'fat' as const,
    },
    {
      ingredientId: 'sua_dac',
      amount: 30,
      unit: 'ml',
      role: 'flavor' as const,
      tasteGroup: 'sugar' as const,
    },
  ],
  steps: [
    {
      id: 'step_1',
      order: 1,
      instruction: 'Nạo ruột bơ cho vào cối cùng sữa đặc',
      type: 'active' as const,
      duration: 120,
      after: [],
      resources: ['may_xay'],
    },
    {
      id: 'step_2',
      order: 2,
      instruction: 'Bấm máy xay nhuyễn mịn trong 60 giây',
      type: 'active' as const,
      duration: 60,
      after: ['step_1'],
      resources: ['may_xay'],
    },
  ],
  version: 1,
};

/**
 * Danh sách 8+ ca cố ý làm sai cấu trúc để kiểm tra validator (Ca sai bắt buộc).
 */
export const INVALID_RECIPE_CASES = [
  {
    name: 'Ca sai 1: Thiếu trường bắt buộc "title"',
    data: {
      ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
      title: undefined,
    },
    expectedErrorSubstring: 'title',
  },
  {
    name: 'Ca sai 2: Số phần ăn (servings) bằng 0 hoặc âm',
    data: {
      ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
      servings: 0,
    },
    expectedErrorSubstring: 'servings',
  },
  {
    name: 'Ca sai 3: Trạng thái (status) không thuộc enum cho phép',
    data: {
      ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
      status: 'pending_approval',
    },
    expectedErrorSubstring: 'status',
  },
  {
    name: 'Ca sai 4: Không có bước nào là active (toàn bộ bước là passive)',
    data: {
      ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
      steps: VALID_RECIPE_TRUNG_CHIEN_CA_CHUA.steps.map((s) => ({
        ...s,
        type: 'passive',
      })),
    },
    expectedErrorSubstring: 'chủ động',
  },
  {
    name: 'Ca sai 5: Món reviewed nhưng thiếu người kiểm duyệt (reviewedBy)',
    data: {
      ...VALID_RECIPE_REVIEWED,
      reviewedBy: null,
    },
    expectedErrorSubstring: 'reviewedBy',
  },
  {
    name: 'Ca sai 6: Vai trò nguyên liệu (role) không hợp lệ',
    data: {
      ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
      ingredients: [
        {
          ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA.ingredients[0],
          role: 'magic_role',
        },
      ],
    },
    expectedErrorSubstring: 'role',
  },
  {
    name: 'Ca sai 7: Danh sách nguyên liệu rỗng',
    data: {
      ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
      ingredients: [],
    },
    expectedErrorSubstring: 'ingredients',
  },
  {
    name: 'Ca sai 8: Thời lượng bước (duration) không dương (<= 0 giây)',
    data: {
      ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
      steps: [
        {
          ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA.steps[0],
          duration: 0,
        },
      ],
    },
    expectedErrorSubstring: 'duration',
  },
  {
    name: 'Ca sai 9: Số lượng nguyên liệu (amount) âm',
    data: {
      ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA,
      ingredients: [
        {
          ...VALID_RECIPE_TRUNG_CHIEN_CA_CHUA.ingredients[0],
          amount: -5,
        },
      ],
    },
    expectedErrorSubstring: 'amount',
  },
  {
    name: 'Ca sai 10: Món published nhưng thiếu ngày kiểm duyệt (reviewedAt)',
    data: {
      ...VALID_RECIPE_PUBLISHED,
      reviewedAt: '',
    },
    expectedErrorSubstring: 'reviewedAt',
  },
];
