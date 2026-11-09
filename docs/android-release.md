# Hướng dẫn đóng gói và phát hành bản build Android (T20.6)

Tài liệu này mô tả cấu hình 3 môi trường (`development`, `staging`, `production`), quản lý `applicationId`, quản lý khóa ký (keystore), xử lý quyền Android (bao gồm báo thức chính xác), các lệnh build EAS và cách cài đặt APK lên thiết bị Android thật.

---

## 1. Quy tắc về tên gói (`applicationId`)

- Mã tạm hiện tại là giá trị mặc định duy nhất được khai báo tại **một chỗ duy nhất**: hằng số `TEMPORARY_APPLICATION_ID` trong [apps/mobile/app.config.ts](../apps/mobile/app.config.ts).
- **Tuyệt đối không viết cứng `applicationId` ở tệp khác** trong mã ứng dụng hoặc tài liệu cấu hình build.
- Google Play **không cho phép đổi `applicationId`** sau khi đã tải bản build đầu tiên lên tài khoản phát hành (`CẦN XÁC MINH` quy trình nếu xóa hẳn app nháp chưa từng xuất bản trên Play Console).
- Vì vậy, `apps/mobile/app.config.ts` có chốt chặn cứng: **môi trường / profile `production` sẽ tự động thất bại** kèm thông báo lỗi rõ ràng nếu `applicationId` vẫn đang là giá trị tạm. Profile `development` và `preview` vẫn build được bình thường.
- Trước lần build `production` đầu tiên, người phụ trách cần:
  1. Chọn tên gói duy nhất theo tên miền nghịch đảo chính thức (hiện trạng: `MISSING`).
  2. Thay giá trị hằng số `TEMPORARY_APPLICATION_ID` trong [apps/mobile/app.config.ts](../apps/mobile/app.config.ts).
  3. Kiểm tra lại bộ test cấu hình (`pnpm --filter @cook/mobile test`) và mục đầu tiên trong [docs/release-checklist.md](./release-checklist.md).

---

## 2. Cấu hình môi trường & ánh xạ EAS Build (`T20.1`, `T20.2`, `T20.3`)

Tệp cấu hình: [apps/mobile/app.config.ts](../apps/mobile/app.config.ts) và [apps/mobile/eas.json](../apps/mobile/eas.json).

| Profile EAS | `APP_ENV` tương ứng | Định dạng đầu ra | Cleartext HTTP | Công cụ debug / log | `versionCode` | `API_BASE_URL` |
| --- | --- | --- | --- | --- | --- | --- |
| `development` | `development` | APK (có `developmentClient: true`) | Cho phép (`true`) để gọi backend cục bộ | Giữ nguyên | `1` (cục bộ) | Tùy chọn cục bộ (đọc từ biến môi trường, không viết cứng) |
| `preview` | `staging` | APK nội bộ (`distribution: internal`) | **Chặn (`false`)** | Tắt `console.log` và dev-fixtures | Tự tăng từ xa (`appVersionSource: remote`, `autoIncrement: true`) | **Bắt buộc** (cấu hình trên EAS Env Vars, hiện để trống) |
| `production` | `production` | AAB đưa lên Google Play | **Chặn (`false`)** | Tắt `console.log` và dev-fixtures | Tự tăng từ xa (`appVersionSource: remote`, `autoIncrement: true`) | **Bắt buộc `https://`** (cấu hình trên EAS Env Vars, hiện để trống) |

Lưu ý:
- Toàn bộ mã ứng dụng (`AiClient`, `TelemetryService`, `App.tsx`) đọc `appEnv` và `apiBaseUrl` duy nhất qua `getAppConfig()` -> `Constants.expoConfig.extra` tại [apps/mobile/src/config/env.ts](../apps/mobile/src/config/env.ts).
- Nếu xây dựng APK `development` có màn launcher `expo-dev-client`, cần chạy thêm `npx expo install expo-dev-client` trước khi chạy `eas build --profile development` (tránh kéo thư viện debug này vào kho phụ thuộc trước khi thật sự cần). Bản `preview` và `production` không cài `expo-dev-client`.
- Bộ biểu tượng và màn hình khởi động hiện dùng tệp trung tính đặt tên rõ là placeholder tại `apps/mobile/assets/placeholder-*.png` — **chưa phải bộ nhận diện thương hiệu chính thức**. Khi có thiết kế màn hình khởi động thật (Expo SDK 58 dùng plugin `expo-splash-screen` thay cho khóa `splash` cũ), cài `npx expo install expo-splash-screen` và gắn plugin tương ứng vào [apps/mobile/app.config.ts](../apps/mobile/app.config.ts).

---

## 3. Quản lý khóa ký ứng dụng Android (Keystore) & Sao lưu bắt buộc

> **CẢNH BÁO QUAN TRỌNG:** Nếu làm mất khóa ký phát hành (Keystore) và chưa đăng ký hoặc không khôi phục được qua Play App Signing, **bạn sẽ vĩnh viễn không thể phát hành bản cập nhật mới** cho ứng dụng hiện có trên Google Play Store (buộc phải đổi `applicationId` thành một ứng dụng hoàn toàn mới và mất toàn bộ người dùng cũ).
> **TUYỆT ĐỐI KHÔNG** tạo keystore thật rồi lưu trong kho Git. Mọi tệp `.keystore`, `.jks`, `.p12`, `.pfx`, `.pkcs12`, `eas-credentials*`, `*play-key*.json` đều đã bị chặn trong [.gitignore](../.gitignore).

Có hai cách quản lý khóa ký hợp lệ cho dự án:

### Cách A: Để EAS quản lý tự động (Khuyến nghị cho đội nhỏ / MVP)

EAS (Expo Application Services) tự sinh, lưu trữ mã hóa trên máy chủ Expo và tự ký mỗi khi build trên cloud.

1. Đăng nhập EAS tại thư mục `apps/mobile`:
   ```bash
   npx eas-cli login
   ```
2. Khởi tạo dự án trên EAS (nếu chưa liên kết `projectId`):
   ```bash
   npx eas-cli init
   ```
3. Khi chạy `eas build --platform android --profile preview` hoặc `production`, chọn **"Generate a new Android Keystore"** khi EAS hỏi lần đầu.
4. **Sao lưu keystore ra ngoài máy tính & lưu dự phòng ngay sau khi tạo**:
   ```bash
   npx eas-cli credentials --platform android
   ```
   - Chọn môi trường (`preview` hoặc `production`) -> `Keystore` -> `Download existing keystore`.
   - Ghi lại đầy đủ: `Keystore password`, `Key alias`, `Key password`, cùng mã băm `SHA-1` và `SHA-256`.
   - Lưu tối thiểu **2 bản sao ngoại tuyến được mã hóa** (ví dụ: USB mã hóa cất giữ riêng + trình quản lý mật khẩu trả phí của tổ chức); **không** đặt vào thư mục dự án Git.

### Cách B: Tự tạo và tự giữ Keystore nội bộ (Self-managed Keystore)

Dùng khi tổ chức muốn tự nắm khóa gốc hoàn toàn hoặc build Android nội bộ không phụ thuộc kho khóa của EAS.

1. Tạo keystore chuẩn PKCS12/JKS bằng `keytool` đi kèm JDK 21 (chạy **bên ngoài** thư mục Git repo, ví dụ thư mục bảo mật cá nhân `~/cook-secrets/`):
   ```bash
   keytool -genkeypair -v -storetype PKCS12 ^
     -keystore ~/cook-secrets/cook-release.keystore ^
     -alias cook-upload-key ^
     -keyalg RSA -keysize 4096 -validity 10000
   ```
   *(Trên Linux/macOS thay `^` bằng `\`.)*
2. Trích xuất thông tin dấu vân tay chứng chỉ để đối chiếu với Google Play Console:
   ```bash
   keytool -list -v -keystore ~/cook-secrets/cook-release.keystore -alias cook-upload-key
   ```
3. Chọn cách nạp vào EAS:
   - **Cách B1 (Tải lên EAS Credentials):** chạy `npx eas-cli credentials --platform android` -> `Keystore` -> `Set up a new keystore` -> `Upload an existing keystore`.
   - **Cách B2 (Build cục bộ / `credentials.json` không commit Git):** đặt tệp `credentials.json` cục bộ (đã nằm trong `.gitignore`), trỏ đường dẫn ngoài repo tới `*.keystore`.
4. **Sao lưu ngay sau bước 1:** Lưu tệp `cook-release.keystore` và bộ 3 mật khẩu (`keystorePassword`, `keyAlias`, `keyPassword`) ở tối thiểu 2 nơi lưu trữ độc lập đã mã hóa.

### Ghi chú về Google Play App Signing (`CẦN XÁC MINH`)

- Khi tải AAB lên Google Play Console lần đầu, Google Play hiện áp dụng mô hình **Play App Signing** (khóa Upload Key do nhà phát triển giữ để ký AAB tải lên, còn Google Play giữ App Signing Key để phát hành APK cho thiết bị người dùng).
- Trong trường hợp bị lộ hoặc mất **Upload Key** khi đã bật Play App Signing, chủ tài khoản Google Play Console có thể gửi yêu cầu đặt lại Upload Key (`CẦN XÁC MINH` thời gian chờ hiệu lực, quy trình xác minh danh tính hiện hành của Google Play tại thời điểm phát hành).
- Nếu tự tắt Play App Signing hoặc dùng hình thức phân phối APK nội bộ bên ngoài Play mà mất keystore -> **không thể khôi phục**, người dùng cũ không thể cài đè bản cập nhật mới.

---

## 4. Quyền Android & Lựa chọn báo thức chính xác (`T20.4`)

Toàn bộ quyền cho phép và quyền chặn được khai báo tường minh trong [apps/mobile/app.config.ts](../apps/mobile/app.config.ts) (`android.permissions` và `android.blockedPermissions`).

### So sánh `SCHEDULE_EXACT_ALARM` và `USE_EXACT_ALARM` cho hẹn giờ nấu ăn

Ứng dụng cần hẹn giờ nấu ăn reo đúng thời điểm bước `passive` kết thúc kể cả khi màn hình khóa. Android 12+ phân biệt hai quyền:

| Tiêu chí | `android.permission.SCHEDULE_EXACT_ALARM` *(Mặc định đang dùng)* | `android.permission.USE_EXACT_ALARM` *(Đang chặn)* |
| --- | --- | --- |
| Cơ chế cấp quyền (Android 13/14+) | Không tự cấp mặc định với mọi app thường; người dùng cần cho phép trong **Alarms & reminders** trên thiết bị nếu OS chưa tự cấp (`CẦN XÁC MINH` theo từng phiên bản Android / OEM). | Tự động cấp ở thời điểm cài đặt, người dùng không thể thu hồi riêng quyền này từ phần cài đặt Alarms & reminders. |
| Ưu điểm | Phù hợp ứng dụng hẹn giờ nấu ăn trong bếp có bước hướng dẫn người dùng bật quyền (app đã có màn/hộp hướng dẫn tối ưu pin & Alarms trong `notification-service.ts`). Ít rủi ro bị từ chối phát hành nhầm nhóm app lịch/đồng hồ thuần túy (`CẦN XÁC MINH`). | Hẹn giờ chính xác chạy ngay không cần nhắc người dùng cấp thêm quyền đặc biệt trên Android 13+. |
| Nhược điểm | Nếu người dùng từ chối cấp quyền Alarms & reminders, chuông báo chính xác cần xử lý fallback sang thông báo bình thường hoặc nhắc cấp lại quyền. | Google Play áp đặt khai báo & kiểm duyệt nghiêm ngặt nhóm ứng dụng đủ điều kiện dùng `USE_EXACT_ALARM` (thường chỉ đồng hồ báo thức / lịch chuyên biệt — **`CẦN XÁC MINH` trực tiếp trên Play Policy trước khi chọn**). |

**Quyết định T20.4:** Mặc định dùng `SCHEDULE_EXACT_ALARM` và chủ động chặn `USE_EXACT_ALARM` trong `blockedPermissions`. Chủ dự án sẽ đối chiếu trực tiếp chính sách Google Play Console trước khi quyết định giữ nguyên hay thay đổi.

---

## 5. Lệnh build theo từng profile

Chạy tại thư mục `apps/mobile/` (sau khi đã đăng nhập `npx eas-cli login` và thiết lập biến môi trường trên EAS nếu cần):

### 5.1. Profile `development` (APK phát triển, giữ log & chế độ dev)
Lưu ý: nếu muốn dùng custom dev-client launcher, cài thêm `npx expo install expo-dev-client` trước.
```bash
cd apps/mobile
npx eas-cli build --platform android --profile development
```

### 5.2. Profile `preview` (APK thử nghiệm nội bộ, trỏ backend `staging`)
Yêu cầu trước khi chạy: đã cấu hình biến `API_BASE_URL` cho môi trường `preview` trên EAS (hoặc truyền lúc chạy CI/EAS env). Hiện biến này đang để trống (`MISSING`) nên nếu chưa đặt, cấu hình sẽ chủ động báo lỗi dừng build.
```bash
cd apps/mobile
# Kiểm tra đặt biến môi trường trên EAS (chạy 1 lần khi có URL staging thật):
# npx eas-cli env:create --environment preview --name API_BASE_URL --value https://<URL-STAGING> --visibility plaintext
npx eas-cli build --platform android --profile preview
```

### 5.3. Profile `production` (AAB phát hành Google Play)
Yêu cầu bắt buộc trước khi chạy:
1. Đã đổi `TEMPORARY_APPLICATION_ID` trong [apps/mobile/app.config.ts](../apps/mobile/app.config.ts) sang tên gói chính thức (nếu còn giá trị tạm, build **sẽ thất bại**).
2. Đã đặt biến môi trường `API_BASE_URL` cho `production` bắt đầu bằng `https://`.
```bash
cd apps/mobile
# Kiểm tra đặt biến môi trường trên EAS (chạy 1 lần khi có URL production HTTPS thật):
# npx eas-cli env:create --environment production --name API_BASE_URL --value https://<DOMAIN-PRODUCTION> --visibility plaintext
npx eas-cli build --platform android --profile production
```

---

## 6. Cách cài đặt APK (`preview` / `development`) lên máy Android thật

### Cách 1: Cài qua đường dẫn / mã QR từ EAS
1. Sau khi `eas build --profile preview --platform android` hoàn tất, EAS trả về đường dẫn tải APK và mã QR.
2. Trên điện thoại Android thử nghiệm: mở camera hoặc trình duyệt quét mã QR để tải tệp `.apk`.
3. Khi Android hỏi "Cài đặt ứng dụng không rõ nguồn gốc" (*Install unknown apps*), cho phép trình duyệt/ứng dụng quản lý tệp cài đặt APK và xác nhận cài.

### Cách 2: Cài qua cáp USB bằng `adb`
1. Tải tệp `.apk` từ EAS build artifact về máy tính (ví dụ `cook-assistant-preview.apk`).
2. Trên điện thoại Android: bật **Developer Options** -> bật **USB Debugging**.
3. Cắm cáp USB vào máy tính, xác nhận hộp thoại "Allow USB debugging" trên màn hình điện thoại, rồi chạy:
   ```bash
   adb devices
   adb install -r cook-assistant-preview.apk
   ```
   *(Nếu máy đã từng cài bản APK ký bằng khóa khác cùng `applicationId`, cần gỡ bản cũ trước bằng `adb uninstall <package-name>` rồi cài lại).*
