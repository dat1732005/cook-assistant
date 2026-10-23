/**
 * File: apps/mobile/src/constants/strings.ts
 * Làm gì: Chứa toàn bộ chuỗi ký tự tiếng Việt hiển thị trên giao diện của ứng dụng di động (T06.7).
 * Nhận vào: Không có.
 * Trả ra: Đối tượng STRINGS tập trung duy nhất, phục vụ kiểm thử và quốc tế hóa/bảo trì.
 * Ai gọi: Toàn bộ các màn hình (WelcomeScreen, HomeScreen, RecipeDetailScreen) và Navigation.
 * Bám theo: Mục T06.7 trong docs/tasks.md và docs/expected/T06.md mục D6.
 */

export const STRINGS = {
  // Chuỗi chung toàn app
  common: {
    appName: 'Trợ lý nấu ăn',
    appSubtitle: 'Nấu ngon mỗi ngày, an toàn sức khỏe',
    loading: 'Đang tải dữ liệu...',
    save: 'Lưu hồ sơ',
    saved: 'Đã lưu thành công',
    cancel: 'Hủy',
    back: 'Quay lại',
    error: 'Đã có lỗi xảy ra',
    confirm: 'Xác nhận',
    minutesUnit: 'phút',
    servingsUnit: 'phần',
    personUnit: 'người',
    servingsBaseSuffix: 'gốc',
    optionalBadge: 'Tùy chọn',
    navigationError: 'useNavigation phải được sử dụng bên trong NavigationProvider',
  },

  // Màn hình Chào mừng & Hồ sơ người dùng (WelcomeScreen)
  welcome: {
    title: 'Chào mừng bạn đến với Trợ lý nấu ăn!',
    subtitle: 'Hãy chia sẻ một chút về khẩu vị và gian bếp của bạn để nhận gợi ý món ăn phù hợp nhất.',
    editTitle: 'Cập nhật hồ sơ khẩu vị',
    editSubtitle: 'Thay đổi số người ăn, dị ứng hoặc dụng cụ bếp của bạn.',
    servingsSectionTitle: 'Số người ăn mỗi bữa',
    servingsHelp: 'Công thức sẽ tự động tính lượng nguyên liệu theo số người này.',
    allergiesSectionTitle: 'Dị ứng thực phẩm (Bắt buộc khai báo)',
    allergiesHelp: 'Chọn các thực phẩm bạn bị dị ứng. Món có chứa dị nguyên sẽ tuyệt đối không xuất hiện.',
    noAllergiesOption: 'Tôi không bị dị ứng thực phẩm nào',
    spicesSectionTitle: 'Gia vị cơ bản đang có sẵn',
    spicesHelp: 'Chọn các loại gia vị đang có sẵn trong gian bếp của bạn.',
    equipmentSectionTitle: 'Dụng cụ bếp đang có sẵn',
    equipmentHelp: 'Chọn các dụng cụ bạn đang có để hệ thống chỉ gợi ý món bạn nấu được.',
    saveButton: 'Lưu & Khám phá món ăn',
    saveChangesButton: 'Lưu thay đổi',
    validationErrorServings: 'Số người ăn phải là số nguyên dương lớn hơn hoặc bằng 1.',
  },

  // Danh mục mã dị ứng chuẩn hiển thị tiếng Việt
  allergens: {
    peanut: 'Đậu phộng (lạc)',
    tree_nut: 'Hạt cây (điều, óc chó...)',
    crustacean: 'Hải sản giáp xác (tôm, cua...)',
    fish: 'Cá',
    egg: 'Trứng (gà, vịt...)',
    milk: 'Sữa & chế phẩm từ sữa',
    soy: 'Đậu nành & đậu phụ',
    wheat: 'Lúa mì & bột mì',
  },

  // Danh mục gia vị cơ bản gợi ý
  spices: {
    muoi: 'Muối',
    duong: 'Đường',
    'nuoc-mam': 'Nước mắm',
    'dau-an': 'Dầu ăn',
    tieu: 'Tiêu',
    'hat-nem': 'Hạt nêm',
  },

  // Danh mục dụng cụ bếp gợi ý
  equipment: {
    chao: 'Chảo',
    noi: 'Nồi',
    to: 'Tô / Bát to',
    'dao-thot': 'Dao & Thớt',
    'bep-ga': 'Bếp nấu',
    'lo-vi-song': 'Lò vi sóng',
  },

  // Màn hình Trang chủ (HomeScreen)
  home: {
    greeting: 'Hôm nay nấu gì nào?',
    subtitle: 'Món ngon an toàn và phù hợp với gian bếp của bạn',
    profileButtonText: 'Hồ sơ & Dị ứng',
    filterSectionTitle: 'Lọc theo thời gian nấu tối đa',
    filterAll: 'Tất cả',
    dishListTitle: 'Danh sách món ăn gợi ý',
    emptyListNotice: 'Không tìm thấy món ăn nào phù hợp với bộ lọc hiện tại.',
    emptyListAllergyHint: 'Các món chứa dị nguyên của bạn đã được tự động ẩn hoàn toàn để bảo đảm an toàn tuyệt đối.',
    cardTotalTimePrefix: 'Thời gian:',
    cardDifficultyPrefix: 'Độ khó:',
    cardEquipmentPrefix: 'Dụng cụ:',
    difficultyEasy: 'Dễ',
    difficultyMedium: 'Vừa',
    difficultyHard: 'Khó',
    viewDetailButton: 'Xem chi tiết món',
  },

  // Màn hình Chi tiết món (RecipeDetailScreen)
  detail: {
    headerTitle: 'Chi tiết món ăn',
    servingsSelectorTitle: 'Số phần ăn mong muốn:',
    servingsDecreaseLabel: 'Giảm số phần',
    servingsIncreaseLabel: 'Tăng số phần',
    servingsUnit: 'phần',
    ingredientsTitle: 'Nguyên liệu cần chuẩn bị',
    ingredientsSubtitle: 'Lượng nguyên liệu đã tự động nhân theo số phần ăn bên trên.',
    replaceOrRemoveButtonText: 'Thay hoặc bỏ nguyên liệu (Chờ AI)',
    replaceOrRemoveDisabledNotice: 'Tính năng thay thế hoặc bỏ nguyên liệu qua AI sẽ ra mắt ở T18.',
    optimizationTitle: 'Tiêu chí xếp lịch nấu',
    modeFastestTitle: 'Nhanh nhất (fastest)',
    modeFastestDescription: 'Ưu tiên làm song song các bước để hoàn thành bữa ăn trong thời gian ngắn nhất.',
    modeFewestToolsTitle: 'Ít dụng cụ nhất (fewest_tools)',
    modeFewestToolsDescription: 'Tận dụng và tái sử dụng dụng cụ nấu để rửa ít đồ nhất sau khi nấu.',
    stepsTitle: 'Các bước nấu ăn',
    stepActiveBadge: 'Thao tác tay',
    stepPassiveBadge: 'Chạy nền tự động',
    stepSecondsPrefix: 'Thời lượng:',
    stepSecondsUnit: 'giây',
    stepCuePrefix: 'Dấu hiệu quan sát:',
    startCookingButton: 'Bắt đầu nấu món này',
    startCookingPlaceholderNotice: 'Tính năng hỗ trợ phiên nấu từng bước đang chuẩn bị ra mắt ở T09.',
  },
} as const;
