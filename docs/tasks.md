# Task list giao Antigravity: Trợ lý nấu ăn (MVP)

Tài liệu này chia MVP thành các task nhỏ để Antigravity code, mỗi task có mục tiêu, việc con, tiêu chí nghiệm thu và bằng chứng phải nộp. Phần cuối là build Android và deploy backend.

## 0. Quy tắc làm việc chung (dán vào đầu mỗi phiên với Antigravity)

- **Mỗi lần chỉ giao một task.** Antigravity không được làm sang task khác, không thêm tính năng ngoài mô tả.
- **Không tự đổi schema hoặc quyết định đã chốt** ở mục 1. Nếu thấy mâu thuẫn thì dừng và báo lại, không tự sửa.
- **Logic cứng phải có test.** Scheduler, trừ kho, quy đổi đơn vị, tính giá, chấm điểm gợi ý, SafetyRules: test đơn vị chạy bằng lệnh một dòng, không cần giao diện.
- **Bằng chứng nộp sau mỗi task** (không chấp nhận tóm tắt bằng lời): (1) danh sách file đã tạo hoặc sửa, (2) output nguyên văn của lệnh test, (3) với task có giao diện: ảnh chụp màn hình hoặc video ngắn chạy trên máy ảo hoặc máy thật, (4) danh sách việc chưa làm hoặc làm khác mô tả.
- **Cổng giữa các giai đoạn:** chưa qua cổng thì không bắt đầu giai đoạn sau. Test đỏ thì sửa, không bỏ test.
- **Không để khóa bí mật trong app.** Mọi khóa API nằm ở backend, đọc từ biến môi trường.
- **Commit nhỏ**, mỗi task một nhánh, mô tả commit nêu mã task.

### 0.1. Quy chuẩn viết mã và chú thích (Bắt buộc tuân thủ ở mọi task)

1. **Đầu mỗi file (3-6 dòng):**
   - File này làm gì, nhận vào gì, trả ra gì.
   - Ai gọi nó, nó gọi những module nào.
   - Bám theo mục nào của `docs/plan.md` (nếu có).

2. **Trước mỗi hàm (cả hàm chính và hàm phụ):**
   - **Làm gì:** 1-2 câu, dùng ngôn ngữ đời thường, dễ hiểu.
   - **Vào:** từng tham số, ý nghĩa và đơn vị cụ thể (giây, gam, số phần...).
   - **Ra:** trả về gì, kể cả khi lỗi hay không có kết quả.
   - **Ví dụ có số cụ thể:** Ví dụ: "3 quả trứng, nấu 4 phần thay vì 2 phần → trả về 6 quả."
   - **Gọi bởi / gọi tới:** để lần theo luồng chạy của chương trình.

3. **Trước mỗi if, else, switch, for, while có ý nghĩa nghiệp vụ:**
   - Ghi một dòng giải thích nghiệp vụ (để làm gì), không dịch lại cú pháp code.
     - *Ví dụ đúng:* `// Chặn không cho sang bước tiếp nếu bước hiện tại là bước an toàn mà người dùng chưa bấm xác nhận.`
     - *Ví dụ sai:* `// nếu confirmed là false thì return.`
   - Với if có nhánh `else` hoặc nhiều nhánh: ghi rõ từng nhánh ứng với tình huống nào.
   - Với vòng lặp: ghi vòng lặp duyệt qua cái gì, mỗi vòng làm gì, và khi nào dừng.
   - Điều kiện thoát sớm (`return`, `continue`, `break`, ném lỗi): ghi rõ lý do thoát.

4. **Hàm dài chia thành các bước đánh số:**
   - Trong hàm có logic nhiều giai đoạn (xếp lịch, trừ kho, chấm điểm), chia thân hàm bằng các dòng chú thích: `// Bước 1: ...`, `// Bước 2: ...`.
   - Nếu bám thuật toán trong kế hoạch thì tên bước và thứ tự phải khớp với kế hoạch, kèm tên mục đối chiếu.

5. **Con số và hằng số:**
   - Mọi con số có ý nghĩa nghiệp vụ (trọng số điểm, ngưỡng, hệ số, giới hạn lượt, số lần thử lại) phải đặt trong hằng số có tên, tuyệt đối không để số trần (magic numbers) trong logic.
   - Mỗi hằng số có chú thích: nó là gì, đơn vị, từ đâu ra. Nếu là con số “đề xuất” của kế hoạch thì ghi rõ `// đề xuất, chưa kiểm chứng`.

6. **Cách viết:**
   - Tiếng Việt, dễ hiểu, giải thích để làm gì và vì sao, không dịch lại từng dòng code.
   - Không chú thích dòng hiển nhiên (như tăng biến đếm lên 1).
   - Chú thích phải luôn đúng với code. Sửa code thì sửa chú thích trong cùng commit. Chú thích lệch code là lỗi.
   - Chỗ tạm hoặc không chắc phải ghi rõ (`// tạm: chưa xử lý trường hợp...`, `// chưa chắc: cần kiểm tra...`). Không viết như đã chắc.
   - Không dùng TODO trần; mọi TODO phải kèm lý do và mã task sẽ xử lý (ví dụ: `// TODO(T18): nối AI vào đây`).

7. **Tên gọi:**
   - Tên hàm và biến đầy đủ, nói rõ việc nó làm (ví dụ `tinhThoiGianConLai`, không viết `calc` hay `tgcl`). Không viết tắt tùy tiện.
   - Mỗi hàm làm một việc. Hàm dài quá thì tách thành các hàm nhỏ, mỗi hàm nhỏ có chú thích riêng theo mục 2.

8. **Nghiệm thu bằng bằng chứng:**
   - Dự án nghiệm thu bằng bằng chứng độc lập, không đọc code (theo quy định tại phần *NGHIỆM THU BẰNG BẰNG CHỨNG*).
   - Áp dụng `docs/coding-rules.md`, các mục 1-7. Bỏ mục nộp file mẫu và danh sách `if`/`for` chưa chú thích. Chú thích giúp hiểu code, nhưng không được coi là bằng chứng code đúng.

## 1. Quyết định kỹ thuật đã chốt

| Mục | Chốt | Lý do ngắn |
| --- | --- | --- |
| App | React Native + Expo (TypeScript), build Android bằng EAS | Một mã nguồn, xuất APK/AAB không cần cài Android Studio đầy đủ |
| Lưu trên máy | SQLite (expo-sqlite) | Offline, truy vấn quan hệ |
| Logic cứng | Viết thành package TypeScript thuần (không phụ thuộc React Native) | Test bằng Node, dùng lại ở backend nếu cần |
| Backend | **Java 21 LTS + Spring Boot 3.x + Maven (có Maven Wrapper) + PostgreSQL + Flyway** | Hệ sinh thái chuẩn mực, kiểu tĩnh mạnh mẽ, bảo mật cao, Flyway migration rõ ràng |
| Đóng gói server | Docker + docker-compose (Maven build tầng 1, JRE 21 chạy tầng 2) | Chuyển sang máy chủ thuê chỉ cần cài Docker và chép cấu hình |
| Cấu hình | Toàn bộ qua biến môi trường, file `application.yml` đọc `${BIEN_MOI_TRUONG}`, có mẫu `.env.example` | Đổi máy chủ không sửa mã |
| Test | Vitest cho package logic (`packages/core`, mobile); **JUnit 5 + MockMvc** cho backend, CSDL dùng **Testcontainers** | Chuẩn hóa theo từng nền tảng, chạy bằng một lệnh |
| AI | Gọi qua backend, nhà cung cấp cấu hình bằng biến môi trường, có interface `AiProvider` để đổi mô hình | Không khóa vào một mô hình |
| Nền tảng MVP | **Chỉ Android** | Bạn deploy trên Android; hẹn giờ nền cần thử riêng từng hệ |
| Thông báo hẹn giờ | Báo thức/thông báo cục bộ theo `endsAt`, tính lại khi mở app | Không dựa vào bộ đếm chạy nền |
| Nạp kho (đổi so với bản kế hoạch gốc) | **Có thêm "thêm nhanh" trong MVP**: chọn nguyên liệu từ danh sách chuẩn + chọn mức (một ít, vừa, nhiều) | Kho chỉ có đường ra thì gợi ý theo đồ đang có gần như vô dụng |
| Hợp đồng API (Contract) | TypeScript ở `packages/core` và Java DTO/Record ở backend là 2 bản riêng, đồng bộ qua Contract Test chung một bộ JSON mẫu | Đảm bảo tính nhất quán giữa app TS và backend Java |

## 2. Cấu trúc repo yêu cầu

```
cook-assistant/
  apps/mobile/        # app Expo (React Native + TypeScript)
  apps/backend/       # Java 21 LTS + Spring Boot 3.x + Maven (mvnw, mvnw.cmd)
  packages/core/      # types, Scheduler, units, pantry, suggest, safety (TS thuần)
  data/               # recipes/*.json, ingredients.json, equipment.json, safety_rules.json, prices.json
  scripts/            # validate-data, seed
  deploy/             # docker-compose, nginx/caddy, Dockerfile, hướng dẫn
  docs/               # tài liệu đối chiếu
```

*Lưu ý về workspace:* `pnpm-workspace.yaml` quản lý các package TypeScript (`apps/mobile`, `packages/core`). `apps/backend` là project Java Maven độc lập sử dụng Maven Wrapper (`mvnw` / `mvnw.cmd`).

---

## Giai đoạn A: Nền móng và dữ liệu

### T01. Khởi tạo monorepo

**Mục tiêu:** có khung repo chạy được lint, test, build rỗng cho cả app, backend (Spring Boot) và package core.

- T01.1: Tạo cấu trúc monorepo đúng mục 2; pnpm workspace quản lý `packages/core` và `apps/mobile`.
- T01.2: Cấu hình TypeScript chế độ strict, một tsconfig gốc và tsconfig riêng cho core & mobile.
- T01.3: Cấu hình ESLint và Prettier dùng chung cho phần TS; script `lint`, `test`, `typecheck` ở thư mục gốc chạy cho các package TS (`packages/*`, `apps/mobile`).
- T01.4: Khởi tạo `apps/mobile` bằng Expo TypeScript, chạy được màn hình trống trên máy ảo Android.
- T01.5: Khởi tạo `apps/backend` với **Java 21 LTS + Spring Boot 3.x** (có Maven Wrapper `mvnw`), endpoint `GET /health` trả `{ "status": "ok" }`.
- T01.6: Khởi tạo `packages/core` với một hàm mẫu và một test mẫu để chứng minh chuỗi test chạy.
- T01.7: Viết `README.md` gốc: cách cài, cách chạy từng phần (bao gồm cả `pnpm` cho TS và `./mvnw` cho backend Java), cách chạy test.

**Nghiệm thu:** `pnpm test` và `pnpm typecheck` ở gốc xanh (cho core và mobile); backend chạy `./mvnw test` xanh; `GET /health` trả đúng `{ "status": "ok" }`; app mở được trên máy ảo. **Bằng chứng:** output các lệnh trên, ảnh chụp máy ảo.

### T02. Kiểu dữ liệu và schema dùng chung

**Mục tiêu:** một nguồn sự thật cho kiểu dữ liệu phía TypeScript, bám đúng phần Schema và Định dạng công thức trong kế hoạch.

- T02.1: Trong `packages/core`, định nghĩa kiểu cho `Ingredient`, `Recipe`, `RecipeIngredient`, `RecipeStep`, `PantryItem`, `PantryEvent`, `CookSession`, `UserProfile`, `StorageRule`/`SafetyRule`.
- T02.2: Các giá trị liệt kê cố định: vai trò nguyên liệu (`flavor`, `structure`, `moisture`, `preservation`, `color`), nhóm vị (`salt`, `sugar`, `acid`, `fat`, `spice`, `none`), loại bước (`active`, `passive`), trạng thái công thức (`draft`, `reviewed`, `published`), đơn vị gốc (`g`, `ml`, `cái`), lý do sự kiện kho (`cook`, `adjust`, `discard`, `buy`).
- T02.3: Dùng thư viện kiểm tra schema (Zod) để sinh validator từ cùng định nghĩa, dùng cho app mobile và script kiểm tra.
- T02.4: Viết bảng quy đổi đơn vị: thìa cà phê, thìa canh, chén, bó, nhánh, quả, củ sang đơn vị gốc, theo từng nguyên liệu (`conversions` trong `Ingredient`).
- T02.5: Mã dị ứng cố định theo kế hoạch: đậu phộng, hạt cây, giáp xác, cá, trứng, sữa, đậu nành, lúa mì.

**Nghiệm thu:** validator nhận JSON mẫu "trứng chiên cà chua" trong kế hoạch và từ chối khi thiếu trường bắt buộc hoặc sai giá trị liệt kê. **Bằng chứng:** output test với ít nhất 5 ca hợp lệ và 8 ca sai.

### T03. Dữ liệu nền và script kiểm tra

**Mục tiêu:** có bộ dữ liệu mẫu và script chặn dữ liệu sai ngay lúc build.

- T03.1: Tạo `data/ingredients.json` với ít nhất 60 nguyên liệu phổ biến: tên chuẩn, tên gọi khác theo vùng, đơn vị gốc, bảng quy đổi, mã dị ứng, giá tham khảo (đánh dấu rõ là số tạm).
- T03.2: Tạo `data/equipment.json` (chảo, nồi, dao thớt, tô, lò vi sóng, nồi cơm điện...).
- T03.3: Chuyển 3 món mẫu sang `data/recipes/*.json` đúng định dạng (trứng chiên cà chua và hai món khác do tôi cung cấp nội dung). Trạng thái ban đầu `draft`.
- T03.4: Viết `scripts/validate-data`, kiểm tra: không vòng phụ thuộc giữa các bước, mọi id trong `after` tồn tại; mọi nguyên liệu có trong bảng chuẩn; mọi dụng cụ trong `resources` có trong `equipment` của món; có ít nhất một bước `active`; món `reviewed`/`published` bắt buộc có người kiểm duyệt và ngày kiểm duyệt; mọi đơn vị trong công thức có quy đổi sang đơn vị gốc.
- T03.5: Script thoát mã khác 0 khi có lỗi, in rõ tên món và tên trường sai; chạy được trong CI.
- T03.6: Bộ test cho script: ít nhất một món cố tình sai cho từng quy tắc ở T03.4.

**Nghiệm thu:** script chạy sạch trên 3 món mẫu và bắt đúng từng lỗi cố tình. **Bằng chứng:** output script ở hai trường hợp (sạch và có lỗi), output test.

**Lưu ý:** nội dung món do tôi và người biết nấu kiểm duyệt cung cấp. Antigravity không tự bịa công thức, lượng hay thời gian.

> **Cổng A:** T01-T03 xong, test xanh. Trước khi sang giai đoạn B, tôi chạy thử bằng tay 3 món với vài người không biết nấu (nhắn từng bước theo JSON) để xem việc song song hóa có giá trị thật không. Nếu không, T04 được rút gọn.

---

## Giai đoạn B: Scheduler (logic cốt lõi, không giao diện)

### T04. Scheduler xếp lịch nấu

**Mục tiêu:** hàm thuần trong `packages/core` nhận bước của công thức và tiêu chí, trả kế hoạch. Bám đúng thuật toán trong phần Xếp lịch nấu của kế hoạch.

- T04.1: Hàm `plan(recipe, servings, mode)` với `mode` là `fastest` hoặc `fewest_tools`; trả danh sách `{ stepId, startAt, endAt }` tính bằng giây từ lúc bắt đầu.
- T04.2: Tính `tail(s)` (đường dài nhất từ bước s đến cuối) bằng quy hoạch động trên đồ thị phụ thuộc.
- T04.3: Vòng mô phỏng theo thời gian: bước `passive` bắt đầu ngay khi sẵn sàng và dụng cụ rảnh; người nấu chỉ làm một bước `active` mỗi lúc; mỗi dụng cụ chỉ phục vụ một bước mỗi lúc.
- T04.4: Hai chế độ chọn bước: `fastest` chọn `tail` lớn nhất; `fewest_tools` ưu tiên bước dùng dụng cụ đang dùng sẵn, hòa thì `tail` lớn nhất.
- T04.5: Hàm `replan(session, now)`: tính lại phần chưa chạy từ thời điểm thực; bước `passive` đang đếm giữ nguyên `endsAt`.
- T04.6: Hàm kiểm tra người dùng làm lệch kế hoạch: nếu phụ thuộc đã thỏa thì cho; chưa thỏa thì trả cảnh báo; bước có mã an toàn thì trả trạng thái chặn cho đến khi xác nhận.
- T04.7: Từ chối công thức có vòng phụ thuộc bằng lỗi rõ ràng.
- T04.8: Thời lượng bước giữ nguyên khi đổi số phần (ghi vào `docs/limitations.md`).

**Bộ test bắt buộc (mỗi mục một test, có giá trị kỳ vọng tính tay trong comment):**

1. Hai bước độc lập, một ngắn một dài.
2. Hai bước tranh cùng dụng cụ.
3. Bước passive chen bước active.
4. Người dùng bấm Xong sớm hoặc muộn thì `replan` đúng.
5. Người dùng làm lệch thứ tự: có phụ thuộc thỏa, có phụ thuộc chưa thỏa, có mã an toàn.
6. Công thức có vòng phụ thuộc bị từ chối.
7. Ba món mẫu: tổng thời gian kế hoạch khớp giá trị tôi tính tay.
8. Hai chế độ cho ra thứ tự khác nhau trên ít nhất một món thiết kế để phân biệt.

**Nghiệm thu:** toàn bộ test xanh; kết quả hai chế độ trên 3 món mẫu in ra dạng bảng để tôi đối chiếu. **Bằng chứng:** output test, bảng kế hoạch của 3 món ở cả hai chế độ.

> **Cổng B:** tôi tự tính tay kế hoạch của 3 món và so với bảng in ra. Lệch thì sửa thuật toán, không sửa số kỳ vọng.

---

## Giai đoạn C: Khung app, dữ liệu trên máy

### T05. SQLite và nạp công thức

**Mục tiêu:** app có CSDL cục bộ, nạp dữ liệu đóng gói sẵn, có migration.

- T05.1: Tạo các bảng MVP trên SQLite: `user_profile`, `ingredient`, `recipe`, `recipe_ingredient`, `recipe_step`, `pantry_item`, `pantry_event`, `cook_session`, `ai_usage_log`, đúng cột trong kế hoạch.
- T05.2: Cơ chế migration có đánh số phiên bản, chạy tự động khi mở app.
- T05.3: Đóng gói `data/*.json` vào app; lần đầu mở thì nạp vào SQLite; lần sau chỉ nạp lại khi phiên bản dữ liệu tăng.
- T05.4: Khi sửa công thức đã xuất bản thì tăng `version`; `cook_session` lưu phiên bản đã dùng.
- T05.5: Lớp `RecipeRepo` với `list(filters)` và `get(slug)`; lọc theo thời gian, dụng cụ, mã dị ứng.
- T05.6: Test cho repo bằng SQLite trong bộ nhớ.

**Nghiệm thu:** mở app lần đầu nạp đủ món; mở lần hai không nạp lại; test repo xanh. **Bằng chứng:** output test, log nạp dữ liệu hai lần mở.

### T06. Màn hình Chào mừng, Trang chủ, Chi tiết món

**Mục tiêu:** xem được danh sách và chi tiết món, đổi số phần thì lượng đổi đúng.

- T06.1: Điều hướng cơ bản (stack) giữa các màn hình.
- T06.2: Màn Chào mừng: nhập số người ăn, chọn dị ứng (theo mã cố định), gia vị cơ bản đang có, dụng cụ đang có; lưu vào `user_profile`.
- T06.3: Màn Trang chủ: danh sách món (tạm sắp theo tên, T13 sẽ thay bằng điểm gợi ý), bộ lọc thời gian.
- T06.4: Màn Chi tiết món: nguyên liệu theo số phần, nút đổi số phần, nút "Thay hoặc bỏ" (tạm vô hiệu, T18 nối AI), chọn tiêu chí tối ưu (nhanh nhất hoặc ít dụng cụ nhất), nút Bắt đầu.
- T06.5: Lượng hiển thị theo đơn vị đời thường; dùng hàm quy đổi của `packages/core`.
- T06.6: Món có mã dị ứng của người dùng không hiện ở danh sách.
- T06.7: Chữ lớn, tương phản tốt, ngôn ngữ tiếng Việt gần gũi, toàn bộ chuỗi chữ đặt trong một tệp để dễ sửa.

**Nghiệm thu:** đổi số phần 2 thành 4 thì lượng gấp đôi đúng; người dùng khai dị ứng trứng thì món trứng chiên cà chua biến mất. **Bằng chứng:** video ngắn trên máy ảo hai thao tác trên; ảnh chụp 3 màn hình.

> **Cổng C:** app chạy offline hoàn toàn (tắt mạng máy ảo vẫn xem được món); test xanh.

---

## Giai đoạn D: Phiên nấu (trái tim của app)

### T07. SessionService và trạng thái phiên

**Mục tiêu:** logic phiên nấu do app giữ, không giao cho AI.

- T07.1: `start(recipe, servings, mode, removedOrSubstituted)` tạo `cook_session` với kế hoạch từ Scheduler, lưu phiên bản công thức.
- T07.2: `advance(stepId)` đánh dấu bước xong, gọi `replan`, trả trạng thái mới gồm ba nhóm: "Bây giờ", "Đang chờ", "Tiếp theo".
- T07.3: `back(stepId)` cho quay lại bước trước và ghi sự kiện lùi bước (dùng cho chỉ số).
- T07.4: `finish` và `abandon` đổi trạng thái phiên; phiên đang `cooking` phục hồi được sau khi app bị tắt.
- T07.5: Bước có mã an toàn: `advance` bị chặn cho đến khi gọi hàm xác nhận an toàn.
- T07.6: Chỉ cho một phiên `cooking` tại một thời điểm.

**Nghiệm thu:** test chạy trọn một phiên mô phỏng 3 món từ `start` đến `finish`; test phục hồi phiên; test chặn bước an toàn. **Bằng chứng:** output test.

### T08. TimerService và thông báo cục bộ (Android)

**Mục tiêu:** hẹn giờ đúng khi app ở nền hoặc khóa màn hình.

- T08.1: `schedule(stepId, endsAt)` lưu thời điểm kết thúc tuyệt đối và đặt thông báo cục bộ theo đó; `cancel(stepId)`.
- T08.2: `restore()` chạy khi mở lại app: tính lại thời gian còn lại từ `endsAt`, kích hoạt ngay những hẹn giờ đã quá hạn.
- T08.3: Xin quyền thông báo và quyền báo thức chính xác trên Android 12 trở lên; có màn hình hướng dẫn nếu người dùng từ chối, vì không có quyền thì hẹn giờ lệch.
- T08.4: Kênh thông báo có âm báo rõ, hiển thị tên bước kế tiếp.
- T08.5: Hướng dẫn người dùng tắt tối ưu pin cho app (màn hình trợ giúp một lần).
- T08.6: Ghi vào `docs/timer-test-matrix.md` bảng thử nghiệm: ít nhất 3 dòng máy Android khác nhau, các tình huống màn hình khóa, app ở nền, app bị vuốt tắt, bật tiết kiệm pin; cột kết quả để trống cho tôi điền.

**Nghiệm thu:** hẹn giờ 2 phút kêu đúng giờ (sai số tối đa vài giây) trong các tình huống nêu trên trên ít nhất một máy thật. **Bằng chứng:** video quay màn hình khóa và thông báo; ghi giờ đặt và giờ kêu thực tế.

### T09. Màn Chuẩn bị và màn Nấu

- T09.1: Màn Chuẩn bị: checklist nguyên liệu và dụng cụ, chỉ cho bắt đầu khi người dùng bấm xác nhận hoặc bỏ qua.
- T09.2: Màn Nấu có ba khối "Bây giờ làm", "Đang chờ", "Tiếp theo", nút Xong cỡ lớn, hiển thị `cue` (dấu hiệu nhìn thấy) cho người mới.
- T09.3: Hiển thị hẹn giờ đang chạy bằng đếm ngược tính từ `endsAt`.
- T09.4: Màn hình luôn sáng trong lúc nấu.
- T09.5: Nút lùi bước và nút thoát giữa chừng có hộp xác nhận.
- T09.6: Bước có mã an toàn hiện hộp xác nhận kèm nguồn quy tắc; chưa xác nhận thì nút Xong bị khóa.
- T09.7: Nút "Hỏi AI" (chưa nối, nối ở T18).
- T09.8: Khi người dùng làm lệch kế hoạch, hiện cảnh báo nhưng không chặn (trừ bước an toàn).

**Nghiệm thu:** nấu trọn 3 món mẫu theo kế hoạch trên máy thật, tắt mạng; thoát giữa chừng rồi mở lại thì phục hồi đúng. **Bằng chứng:** video nấu trọn một món và video phục hồi phiên; ảnh chụp bước an toàn.

> **Cổng D:** tôi chạy thử nấu thật bằng tay một món. Chưa qua cổng thì không làm giai đoạn E.

---

## Giai đoạn E: Kho và gợi ý món

### T10. PantryService

**Mục tiêu:** trừ kho đúng, có hoàn tác. Bám đúng 7 bước trong phần Trừ kho của kế hoạch.

- T10.1: `add`, `adjust` (đều ghi `pantry_event`).
- T10.2: `deductForSession(sessionId)`: lượng = lượng gốc × (phần nấu / phần gốc), quy về đơn vị gốc; nguyên liệu người dùng bỏ thì không trừ; nguyên liệu thay thế trừ theo lượng xác nhận.
- T10.3: Trừ theo hạn dùng gần nhất trước; không để số âm, thiếu thì trừ về 0 và ghi nhận phần thiếu.
- T10.4: Gia vị cơ bản đã khai "luôn có sẵn" thì không trừ.
- T10.5: `undoSession(sessionId)` đảo toàn bộ sự kiện của phiên đó.

**Bộ test bắt buộc:** đổi số phần; bỏ nguyên liệu; thay nguyên liệu; kho thiếu; nhiều lô khác hạn; gia vị luôn có; hoàn tác trả đúng số ban đầu; đơn vị đời thường quy đổi đúng; làm tròn không gây sai lệch tích lũy.

**Nghiệm thu:** trừ kho khớp với số tôi tính tay trên 5 món. **Bằng chứng:** bảng đối chiếu (số tính tay, số app) và output test.

### T11. Thêm nhanh nguyên liệu vào kho (bổ sung MVP)

**Mục tiêu:** giảm công nhập liệu, vì kho trống thì gợi ý theo đồ đang có vô dụng.

- T11.1: Màn "Thêm nhanh": ô tìm theo tên chuẩn và tên gọi khác, chọn nhiều nguyên liệu một lúc.
- T11.2: Mỗi nguyên liệu chọn mức "một ít / vừa / nhiều" quy ra lượng mặc định theo từng nguyên liệu (lưu ở dữ liệu nguyên liệu).
- T11.3: Chọn vị trí bảo quản (ngăn mát, ngăn đá, nhiệt độ phòng); ngày thêm tự điền; hạn dùng để trống ở MVP, ghi chú giao diện rõ.
- T11.4: Danh sách "hay dùng" 15 nguyên liệu để chọn bằng một chạm khi mới cài app.

**Nghiệm thu:** thêm 10 nguyên liệu trong dưới 60 giây trên máy thật. **Bằng chứng:** video đo thời gian.

### T12. SuggestService

**Mục tiêu:** chấm điểm gợi ý đúng công thức trong kế hoạch. Trọng số để trong tệp cấu hình, không hard-code.

- T12.1: Lọc cứng: mã dị ứng của người dùng, dụng cụ không có, vượt thời gian.
- T12.2: Điểm = 0.5·phủ + 0.2·cấp bách + 0.15·thời gian + 0.1·khẩu vị + 0.05·mới; ở MVP khẩu vị bằng 0 và chia lại trọng số đúng cách (ghi rõ công thức chia lại trong comment).
- T12.3: Chế độ ước chừng: bỏ "phủ", dùng điểm thấp chi phí; chi phí hiển thị dạng khoảng ±20%, không hiển thị như số chính xác.
- T12.4: Trả khoảng 10 món đầu.

**Nghiệm thu:** test cho từng thành phần điểm; test một bộ kho cố định cho thứ hạng xác định; món có mã dị ứng không bao giờ xuất hiện dù điểm cao (test bằng ít nhất 20 kho ngẫu nhiên). **Bằng chứng:** output test; bảng xếp hạng cho 3 kho mẫu để tôi đối chiếu.

### T13. Màn Hoàn tất, màn Kho, nối gợi ý vào Trang chủ

- T13.1: Màn Hoàn tất: danh sách nguyên liệu vừa trừ, sửa nhanh từng dòng, nút hoàn tác.
- T13.2: Màn Kho: danh sách theo vị trí bảo quản, thêm tay, sửa lượng bằng một chạm, xóa.
- T13.3: Trang chủ dùng `SuggestService`; có công tắc "đi chợ (ước chừng)" và chọn số người ăn, bữa nào.
- T13.4: Hiển thị chi phí ước tính dạng khoảng kèm chú thích "giá tham khảo".

**Nghiệm thu:** nấu xong thì kho giảm đúng; hoàn tác trả lại; thêm nhanh rồi Trang chủ đổi thứ tự món. **Bằng chứng:** video luồng đầy đủ nấu, hoàn tất, sửa, hoàn tác.

> **Cổng E:** bảng đối chiếu kho khớp, test xanh, không còn món có mã dị ứng lọt vào gợi ý.

---

## Giai đoạn F: An toàn và AI (backend Spring Boot)

### T14. Khung backend (Java 21 + Spring Boot 3.x)

- T14.1: Spring Boot 3.x (Spring Web, Validation), cấu hình đọc từ biến môi trường qua `application.yml` (ví dụ `${DB_URL}`), kiểm tra khi khởi động (thiếu biến bắt buộc thì dừng ứng dụng ngay và báo rõ qua log).
- T14.2: PostgreSQL với **Flyway migration**; tạo bảng `ai_usage_log` và bảng thiết bị ẩn danh.
- T14.3: Xác thực MVP bằng mã thiết bị ẩn danh (Header `X-Device-Id`); giới hạn lượt theo thiết bị (Spring Filter / Bucket4j hoặc Token Bucket đơn giản); vượt thì trả `429` kèm header `Retry-After`.
- T14.4: Định dạng lỗi thống nhất `{ "code": "...", "message": "..." }` bằng `@RestControllerAdvice`; ghi log có cấu trúc (SLF4J/Logback), tuyệt đối không ghi nội dung câu hỏi của người dùng.
- T14.5: Endpoint `GET /health` có kiểm tra kết nối CSDL PostgreSQL (trả status `ok` hoặc mã lỗi nếu mất kết nối).
- T14.6: Test tích hợp bằng **Testcontainers** (khởi động PostgreSQL container trong test) kết hợp **JUnit 5 + MockMvc**.

**Nghiệm thu:** `./mvnw test` xanh; khởi động thiếu biến môi trường thì dừng với thông báo rõ. **Bằng chứng:** output test và log hai lần khởi động.

### T15. Lớp AI phía backend & Test hợp đồng

- T15.1: Giao diện Java `AiProvider`; một bản cài đặt thật chọn qua cấu hình (`@ConditionalOnProperty`); một bản giả `MockAiProvider` để test không tốn tiền.
- T15.2: `POST /v1/ai/substitute`: nhận DTO (món, hành động bỏ hoặc thay, nguyên liệu, `role`, `flavor_group`, dị ứng, kho); trả JSON DTO `severity`, `impact`, `suggestions`, `confirm_required`.
- T15.3: `POST /v1/ai/ask`: nhận DTO câu hỏi, bước hiện tại, các bước còn lại rút gọn, hẹn giờ đang chạy; trả văn bản ngắn và tối đa một đề xuất hành động.
- T15.4: Kiểm tra Bean Validation (`@Valid`, Hibernate Validator) trên Record/DTO đầu ra AI; sai schema thì thử lại một lần rồi trả lỗi nhẹ.
- T15.5: Chặn số liệu an toàn: regex quét câu trả lời hỏi đáp tìm nhiệt độ và số ngày kèm đơn vị; nếu có thì thay cả câu đó bằng thông báo "xem quy tắc an toàn trong app". Ghi rõ đây là cơ chế quét, không phải bảo đảm tuyệt đối.
- T15.6: Cắt ngữ cảnh: chỉ gửi bước hiện tại và vài bước kế tiếp; không gửi toàn bộ kho hay lịch sử.
- T15.7: Thời gian chờ HTTP client vài giây; mỗi lần gọi ghi vào `ai_usage_log` (token vào, ra, chi phí ước tính).
- T15.8: Prompt hệ thống lấy đúng khung prompt trong kế hoạch, đặt trong tệp tài nguyên riêng (`src/main/resources/prompts/`) để chỉnh không cần sửa mã.
- T15.9: **Test hợp đồng (Contract Test):** Dùng chung một bộ JSON mẫu giữa `@cook/core` (TypeScript Zod) và backend (Java Jackson Record); cả hai bên đều phải parse và validate thành công bộ JSON này.

**Bộ test bắt buộc:** đầu ra sai schema; hết thời gian; vượt giới hạn lượt; câu trả lời chứa nhiệt độ bị chặn; yêu cầu bỏ nguyên liệu `preservation` luôn trả cảnh báo cao (cảnh báo cố định, bỏ qua kết luận AI); gợi ý nguyên liệu không có trong bảng chuẩn bị loại; dị ứng bị xâm phạm bị loại; test hợp đồng với JSON mẫu.

**Nghiệm thu:** toàn bộ test xanh với bản AI giả; một lần chạy thật với bản AI thật trên 10 câu hỏi mẫu do tôi đưa. **Bằng chứng:** output test; bảng 10 câu hỏi và câu trả lời nguyên văn, kèm chi phí từng lần.

### T16. SafetyRules trong app

- T16.1: Tệp `data/safety_rules.json`: nhiệt độ chín thịt gia cầm và hải sản, đồ ăn thừa, thực phẩm hết hạn; mỗi quy tắc có tên nguồn và đường dẫn. Nội dung số liệu do tôi cung cấp từ cơ quan y tế; Antigravity không tự điền.
- T16.2: `check(step)` trả quy tắc cần hiển thị cho bước có `safety_rule`.
- T16.3: `allergyConflicts(recipe, profile)` trả danh sách xung đột.
- T16.4: Cảnh báo luôn hiển thị nguồn.

**Nghiệm thu:** test cho từng quy tắc; cảnh báo hiển thị đúng nguồn trên màn Nấu. **Bằng chứng:** output test; ảnh chụp cảnh báo.

### T17. AiClient trong app

- T17.1: `substitute(...)`, `ask(...)` gọi backend Spring Boot, kiểm tra schema, xử lý hết thời gian chờ.
- T17.2: Khi mất mạng hoặc quá thời gian: hiện "Thử lại", app và hẹn giờ vẫn chạy bình thường.
- T17.3: Mã thiết bị ẩn danh sinh một lần, lưu trên máy (gửi kèm header `X-Device-Id`).
- T17.4: Không đưa khóa API vào app; địa chỉ backend lấy từ cấu hình build.

**Nghiệm thu:** tắt mạng giữa lúc hỏi thì giao diện không treo, hẹn giờ vẫn kêu. **Bằng chứng:** video.

### T18. Giao diện hỏi AI

- T18.1: Nút "Thay hoặc bỏ" ở Chi tiết món: chọn nguyên liệu, chọn bỏ hoặc thay, hiện mức ảnh hưởng, gợi ý, dòng "AI có thể mắc lỗi".
- T18.2: Nguyên liệu `preservation` hoặc dính dị ứng hiện cảnh báo cố định, không hiện kết luận AI.
- T18.3: Ô hỏi nhanh ở màn Nấu; đề xuất hành động chỉ hiện thành nút, hẹn giờ chỉ đổi khi người dùng bấm.
- T18.4: Nút "Câu trả lời sai" gửi phản hồi về backend.
- T18.5: Nguyên liệu người dùng bỏ hoặc thay được lưu vào `cook_session` và được `PantryService` dùng khi trừ kho.

**Nghiệm thu:** bỏ hành lá thì mức thấp, bỏ nguyên liệu bảo quản thì cảnh báo cao cố định, khai dị ứng thì không gợi ý chất đó. **Bằng chứng:** video ba tình huống.

> **Cổng F:** test backend JUnit/Testcontainers xanh; chi phí AI trung bình mỗi câu hỏi được ghi lại từ 10 câu thử.

---

## Giai đoạn G: Đo lường, build Android, deploy

### T19. Đo lường ẩn danh

- T19.1: Ghi sự kiện cục bộ: bắt đầu phiên, hoàn tất phiên, lùi bước, thoát giữa chừng, sửa kho sau khi nấu, lượt hỏi AI (kèm "hữu ích hay không").
- T19.2: Gửi lô sự kiện lên backend `POST /v1/events` khi có mạng; mã thiết bị ẩn danh, không gửi tên, dị ứng hay nội dung câu hỏi.
- T19.3: Truy vấn SQL mẫu trong `docs/metrics.sql` tính 6 chỉ số trong phần Chỉ số thành công của kế hoạch.
- T19.4: Màn hình cài đặt có công tắc tắt đo lường và dòng giải thích dữ liệu nào được gửi.

**Nghiệm thu:** chạy 5 phiên thử, chạy truy vấn mẫu ra đúng số tôi đếm tay. **Bằng chứng:** bảng sự kiện thô và kết quả truy vấn.

### T20. Cấu hình môi trường và bản build Android

**Mục tiêu:** tạo được tệp cài đặt Android bằng một lệnh, đổi địa chỉ server mà không sửa mã.

- T20.1: Ba môi trường cấu hình cho app: `development`, `staging`, `production`; mỗi môi trường có địa chỉ backend riêng đọc từ cấu hình build (`app.config` và biến môi trường của EAS), không viết cứng trong mã.
- T20.2: Cấu hình EAS Build với ba profile: `development` (APK có công cụ debug), `preview` (APK nội bộ để thử kín), `production` (AAB để đưa lên Google Play).
- T20.3: Đặt tên gói ứng dụng (`applicationId`) và biểu tượng, màn hình khởi động; ghi `versionCode` tự tăng cho từng bản build.
- T20.4: Khai báo quyền Android thật sự cần (thông báo, báo thức chính xác, giữ màn hình sáng) và không thêm quyền thừa.
- T20.5: Tắt `console.log` nhạy cảm và công cụ debug ở bản production.
- T20.6: Hướng dẫn `docs/android-release.md`: tạo keystore ký ứng dụng, **cách sao lưu keystore** (mất là không cập nhật được app trên Play), lệnh build từng profile, cách cài APK lên máy thật.
- T20.7: Chuẩn bị hồ sơ Google Play: chính sách quyền riêng tư (dữ liệu dị ứng và ăn uống là nhạy cảm, nêu rõ dữ liệu nào gửi lên máy chủ, dữ liệu nào gửi cho bên AI thứ ba), phần khai "Data safety". Antigravity chỉ soạn khung, tôi duyệt nội dung.

**Nghiệm thu:** build `preview` ra APK, cài lên một máy thật, chạy trọn luồng nấu và gọi được backend staging. **Bằng chứng:** đường dẫn bản build, ảnh chụp app chạy trên máy thật, log gọi backend.

### T21. Đóng gói backend Spring Boot để deploy ở đâu cũng được

**Mục tiêu:** chuyển từ máy cá nhân sang máy chủ thuê chỉ bằng vài lệnh, không sửa mã.

- T21.1: `Dockerfile` nhiều tầng cho backend Spring Boot:
  - Tầng 1 (Build): Maven Wrapper + Eclipse Temurin JDK 21 build ra file jar (`./mvnw clean package -DskipTests`).
  - Tầng 2 (Runtime): Eclipse Temurin JRE 21 nhẹ, chạy bằng người dùng không phải root, cấu hình healthcheck gọi `GET /health`.
- T21.2: `deploy/docker-compose.yml` gồm backend Java, PostgreSQL (có ổ đĩa volume lưu dữ liệu), và reverse proxy (Caddy hoặc Nginx) tự cấp chứng chỉ HTTPS.
- T21.3: `deploy/.env.example` liệt kê mọi biến: địa chỉ CSDL, tên đăng nhập/mật khẩu, khóa AI, giới hạn lượt, tên miền; không có giá trị thật. `.env` nằm trong `.gitignore`.
- T21.4: Migration CSDL chạy tự động bằng Flyway khi ứng dụng Spring Boot khởi động, có thể chạy lặp lại an toàn.
- T21.5: Script sao lưu CSDL (`pg_dump` theo lịch) và script khôi phục; thử khôi phục thật một lần.
- T21.6: Ghi log ra đầu ra chuẩn (STDOUT) để dùng được với mọi dịch vụ chạy container.
- T21.7: Hướng dẫn `docs/deploy-vps.md` từng bước cho máy chủ Ubuntu mới: cài Docker, tạo người dùng, mở cổng 80 và 443, tải mã, tạo `.env`, chạy `docker compose up -d`, kiểm tra `/health`, cập nhật phiên bản, quay lui (rollback).
- T21.8: Hướng dẫn thứ hai `docs/deploy-managed.md` cho phương án không tự quản máy chủ (nền tảng chạy container kèm CSDL được quản lý), ghi rõ cái gì khác so với VPS.
- T21.9: Giới hạn tốc độ và CORS cấu hình qua biến môi trường trong Spring Boot (`application.yml`).

**Nghiệm thu:** trên máy sạch (máy ảo), làm đúng hướng dẫn thì `docker compose up -d` chạy được và `/health` trả `ok`; khôi phục sao lưu thành công. **Bằng chứng:** log từng bước trong máy ảo, output kiểm tra `/health` qua HTTPS (hoặc qua cổng cục bộ nếu chưa có tên miền).

### T22. CI và kiểm tra trước khi phát hành

- T22.1: Quy trình CI (GitHub Actions):
  - Job TypeScript: chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, `validate-data`.
  - Job Java Backend: chạy `./mvnw verify` (hoặc `test`) với JDK 21 và Testcontainers.
  - Báo đỏ khi có bất kỳ job nào thất bại; đỏ thì không cho gộp pull request.
- T22.2: Quy trình dựng và đẩy ảnh Docker của backend Spring Boot khi gắn thẻ phiên bản.
- T22.3: Quét phụ thuộc có lỗ hổng đã biết (Dependabot/Trivy, báo cáo, không chặn ở MVP).
- T22.4: `docs/release-checklist.md`: danh sách kiểm tra trước mỗi bản phát hành (test xanh, dữ liệu đã kiểm duyệt, bản build đã thử trên máy thật, bảng `timer-test-matrix` đã điền, sao lưu CSDL mới nhất, biến môi trường production đã đặt).

**Nghiệm thu:** pull request cố ý làm đỏ test thì CI báo đỏ; pull request sạch thì xanh. **Bằng chứng:** đường dẫn hai lần chạy CI.

### T23. Chuẩn bị chuyển sang máy chủ thuê sau này

Task này chỉ kiểm tra rằng mọi thứ ở T20-T22 đúng như hứa, không thêm tính năng.

- T23.1: Rà soát toàn bộ mã: không còn địa chỉ máy chủ, khóa hay mật khẩu viết cứng (chạy công cụ quét bí mật phủ cả các tệp mã nguồn và `application*.yml`, nộp kết quả).
- T23.2: Thử đổi địa chỉ backend của app sang một máy chủ khác chỉ bằng đổi biến cấu hình và build lại `preview`.
- T23.3: Thử di chuyển: xuất CSDL từ phiên bản đang chạy, khôi phục sang một phiên bản mới, app trỏ sang vẫn chạy.
- T23.4: Ghi `docs/costs.md` các khoản phải trả khi lên thật: máy chủ, tên miền, tài khoản Google Play (phí đăng ký một lần), phí gọi AI, và cách đặt hạn mức chi tiêu cho AI. Số liệu giá do tôi điền sau khi báo giá.

**Nghiệm thu:** hoàn tất T23.1 đến T23.3 mà không sửa mã. **Bằng chứng:** kết quả quét bí mật và log từng lần thử.

---

## Giai đoạn H: Thử kín (việc của bạn, không giao Antigravity)

- H1: Chuẩn bị 10-20 người không biết nấu, mỗi người nấu một món trong bếp thật bằng bản `preview`.
- H2: **Đặt ngưỡng đạt/không đạt trước khi thử** và ghi vào `docs/pilot-criteria.md`. Ví dụ để bạn chỉnh: tỉ lệ hoàn tất món đầu, tỉ lệ có ý định nấu món thứ hai, số lần hẹn giờ không kêu đúng, chi phí AI trung bình mỗi phiên. Ghi rõ kết quả nào thì dừng hoặc đổi hướng.
- H3: Thu số đo bằng `docs/metrics.sql` (T19) và ghi chú quan sát thực tế.
- H4: Sau thử kín, tôi đánh giá số đo và đề xuất danh sách việc sửa theo ưu tiên; chưa làm giai đoạn 2 trước khi có kết quả.

---

## Phụ lục: Khung lời giao việc mỗi task (dán cho Antigravity)

**Bối cảnh:** dự án Trợ lý nấu ăn, monorepo đã mô tả; đọc mục 0, 1, 2 của tài liệu này. **Task:** \[mã task và tên\]. **Việc phải làm:** \[chép các việc con của task\]. **Không được làm:** thêm tính năng ngoài task; sửa schema đã chốt; tự điền nội dung công thức, số liệu an toàn hay giá. **Nghiệm thu:** \[chép mục Nghiệm thu\]. **Nộp lại:** danh sách file đã đổi, output nguyên văn của lệnh test, ảnh hoặc video nếu có giao diện, và danh sách những gì chưa làm hoặc làm khác mô tả.

## Phụ lục: Tóm tắt thứ tự và phụ thuộc

| Giai đoạn | Task | Phụ thuộc | Cổng cần qua |
| --- | --- | --- | --- |
| A | T01, T02, T03 | không | Test xanh, đã thử tay 3 món |
| B | T04 | A | Tôi tự tính tay khớp bảng in ra |
| C | T05, T06 | A | Chạy offline được |
| D | T07, T08, T09 | B, C | Tôi nấu thật một món |
| E | T10, T11, T12, T13 | D | Bảng đối chiếu kho khớp |
| F | T14, T15, T16, T17, T18 | D (backend T14 làm song song được từ giai đoạn C) | Chi phí AI ghi nhận |
| G | T19, T20, T21, T22, T23 | E, F | Release-checklist |
| H | thử kín | G | Ngưỡng đã đặt trước |

---

## QUY TẮC KHÔNG BỊA DỮ LIỆU (ưu tiên cao nhất, ghi đè mọi chỗ khác trong tài liệu)

Dán nguyên mục này vào đầu mọi phiên với Antigravity, cùng với mục 0.

### R1. Antigravity không được tự tạo hoặc ước đoán các loại dữ liệu sau

- Công thức: tên món, nguyên liệu, lượng, thời gian, thứ tự bước, dấu hiệu nhận biết (`cue`).
- Tên nguyên liệu, tên gọi khác theo vùng, bảng quy đổi đơn vị (thìa, bó, nhánh, quả sang đơn vị gốc), mức "một ít / vừa / nhiều" quy ra lượng.
- Giá tham khảo, ngày cập nhật giá, nguồn giá.
- Mã dị ứng gán cho từng nguyên liệu.
- Số liệu an toàn thực phẩm và bảo quản: nhiệt độ chín, số ngày bảo quản, hạn dùng.
- Số liệu dinh dưỡng, chi phí gọi AI, độ chính xác của bất kỳ mô hình nào, kết quả thử trên máy thật.
- Nội dung pháp lý: chính sách quyền riêng tư, khai báo dữ liệu trên Google Play.

### R2. Khi thiếu dữ liệu

- **Dừng phần việc cần dữ liệu đó**, không điền tạm, không "điền cho chạy được".
- Trong tệp dữ liệu, để trường là `null` kèm `"status": "MISSING"`.
- Nộp **DANH SÁCH DỮ LIỆU THIẾU** gồm: loại dữ liệu, tệp và trường cần điền, và loại nguồn tôi cần tìm (ví dụ: tài liệu của cơ quan y tế, người biết nấu kiểm duyệt, báo giá).
- Phần việc không phụ thuộc dữ liệu đó vẫn làm tiếp được.

### R3. Tách dữ liệu thật khỏi dữ liệu giả

- Dữ liệu dùng cho test nằm riêng trong thư mục `fixtures/`, mỗi tệp ghi rõ `"synthetic": true`. Không được nằm trong `data/` và không được đóng gói vào app.
- Mỗi giá trị trong `data/` có trường `source` (tên nguồn) và `confirmed_by` (người xác nhận) do tôi điền. Antigravity không tự điền hai trường này.
- `validate-data` từ chối: bất kỳ `MISSING` nào ở món `reviewed` hoặc `published`, bất kỳ giá trị thiếu `source`. Bản build `production` phải thất bại nếu còn `MISSING`.

### R4. Bằng chứng không được bịa

- Output test, log, ảnh, video phải là kết quả chạy thật. Nếu không chạy được thì ghi "CHƯA CHẠY" và nêu lý do.
- Không báo "xong" khi test chưa xanh hoặc khi bước nghiệm thu chưa thực hiện.
- Giá trị kỳ vọng trong test của Scheduler, trừ kho, gợi ý là **do tôi cung cấp** (tính tay). Antigravity không tự tính rồi lấy chính kết quả đó làm kỳ vọng.

### R5. Điều chỉnh các task theo quy tắc trên

| Task | Chỗ cần sửa |
| --- | --- |
| T03.1 | Antigravity chỉ dựng khung tệp và validator. Danh sách nguyên liệu, tên gọi khác, quy đổi, giá, mã dị ứng do tôi cung cấp; chỗ chưa có để `MISSING`. Không tự viết "60 nguyên liệu". |
| T03.2 | Danh sách dụng cụ do tôi cung cấp. |
| T03.3 | Ba món do tôi cung cấp nguyên văn; Antigravity chỉ chuyển sang đúng định dạng, không thêm, bớt hay sửa lượng và thời gian. |
| T04 | Bộ test dùng giá trị kỳ vọng tôi tính tay (R4). Món thử trong `fixtures/` là món giả, ghi rõ. |
| T11.2 | Mức "một ít / vừa / nhiều" quy ra lượng: `MISSING` cho đến khi tôi điền. |
| T12 | Giá tham khảo `MISSING` thì chế độ ước chừng hiện "chưa có giá", không hiện số. |
| T15 | Chỉ dùng 10 câu hỏi mẫu do tôi đưa. Chi phí ghi từ số thật nhà cung cấp trả về, không ước tính. |
| T16.1 | Quy tắc an toàn: toàn bộ `MISSING` cho đến khi tôi điền từ nguồn cơ quan chức năng. Màn Nấu với bước có mã an toàn mà quy tắc `MISSING` thì **chặn không cho bắt đầu món đó**. |
| T20.7, T23.4 | Antigravity chỉ dựng khung; nội dung và số liệu tôi điền. |

### R6. Danh sách dữ liệu bạn cần chuẩn bị (hoặc nhờ tôi hỗ trợ tìm)

| Dữ liệu | Cần cho task | Nguồn cần tìm |
| --- | --- | --- |
| 3 món mẫu đầy đủ (nguyên liệu, lượng, bước, thời gian, dụng cụ, dấu hiệu nhận biết) | T03, T04 | Người biết nấu hoặc công thức có quyền sử dụng |
| Danh sách nguyên liệu chuẩn, tên gọi khác theo vùng, đơn vị gốc | T03 | Tự biên tập, người biết nấu xác nhận |
| Bảng quy đổi thìa, bó, nhánh, quả sang gam hoặc ml | T03, T10 | Cân đo thực tế hoặc nguồn tham khảo có ghi rõ |
| Giá tham khảo, ngày lấy giá, nơi lấy giá | T12 | Khảo sát chợ, siêu thị hoặc nguồn công khai có ghi rõ |
| Mã dị ứng của từng nguyên liệu | T03, T06 | Tài liệu của cơ quan y tế (danh sách cuối cùng cần đối chiếu) |
| Quy tắc nhiệt độ chín, bảo quản, đồ ăn thừa | T16 | Cơ quan y tế hoặc cơ quan quản lý an toàn thực phẩm |
| Mức "một ít / vừa / nhiều" theo nguyên liệu | T11 | Tự định nghĩa và cân thử |
| 10 câu hỏi mẫu cho AI | T15 | Bạn soạn |
| Nhà cung cấp AI, mô hình, hạn mức chi tiêu | T15, T23 | Bạn quyết định, giá lấy từ trang chính thức của nhà cung cấp |
| Tên gói app, biểu tượng, nội dung chính sách quyền riêng tư | T20 | Bạn, và người có chuyên môn pháp lý nếu cần |
| Danh sách máy Android dùng để thử hẹn giờ | T08 | Thiết bị thật bạn có hoặc mượn |
| Ngưỡng đạt/không đạt của thử kín | H2 | Bạn quyết định trước khi thử |

Nếu bạn muốn, tôi có thể giúp tìm nguồn và đọc đối chiếu cho từng mục trong bảng R6, nhưng số liệu cuối cùng vẫn do bạn xác nhận trước khi vào `data/`.

---

## PHỤ LỤC THAY ĐỔI: Chuyển đổi Backend sang Java Spring Boot

*Phần này lưu lại tóm tắt sự thay đổi kiến trúc được duyệt vào ngày 20/10/2026:*

| Mục | Trước | Sau |
| --- | --- | --- |
| Backend | Node + Fastify | Java 21 LTS + Spring Boot 3.x |
| Build | pnpm workspace | Maven Wrapper (`mvnw`), `apps/backend` không còn là package pnpm |
| Migration CSDL | công cụ Node | Flyway |
| Kiểm tra schema đầu ra AI | Zod dùng chung | Bean Validation trên record/DTO Java, kèm test hợp đồng đối chiếu với JSON mẫu |
| Test | Vitest/Jest | JUnit 5 + MockMvc; test CSDL dùng Testcontainers (PostgreSQL) |
| Docker | Node nhiều tầng | Maven build tầng 1, JRE 21 chạy tầng 2, người dùng không phải root |
| Cấu hình | biến môi trường | `application.yml` đọc `${BIEN_MOI_TRUONG}`, không giá trị bí mật trong file |

**Hợp đồng giữa app và backend:** kiểu dữ liệu TypeScript ở `packages/core` và DTO Java là hai bản riêng. Ở T15 phải có test hợp đồng (cùng một bộ JSON mẫu, cả hai bên phải parse và validate được) để hai bản không lệch nhau.

---

## NGHIỆM THU BẰNG BẰNG CHỨNG (ghi đè mọi phần "Nghiệm thu" và "Bằng chứng" của từng task)

Dự án nghiệm thu bằng bằng chứng, không đọc code. Để bằng chứng đáng tin, áp dụng bốn nguyên tắc.

### Bốn nguyên tắc

1. **Kỳ vọng có trước, kết quả có sau.** Với logic cứng (T04, T06, T10, T12, T19), người chịu trách nhiệm hoặc Claude tính tay giá trị kỳ vọng và ghi vào `docs/expected/Txx.md` **trước khi giao task**. Antigravity không được sửa file này và không được tự tính kỳ vọng. Nếu muốn đổi kỳ vọng thì phải nêu lý do và chờ duyệt.
2. **Mỗi task phải có ca sai.** Chỉ chạy "xanh" chưa chứng minh gì. Cột "Ca sai bắt buộc" dưới đây phải được thử và phải báo lỗi đúng chỗ.
3. **Phần trên thiết bị thật do người chịu trách nhiệm tự chạy,** không tin báo cáo: cột "Bạn tự chạy".
4. **Output là output thật.** Dán nguyên văn, chạy lại từ đầu. Không chạy được thì ghi "CHƯA CHẠY" và lý do.

**Quy tắc chú thích trong code:** áp dụng `docs/coding-rules.md`, các mục 1-7. Bỏ mục 8 (nộp file mẫu và danh sách `if`/`for` chưa chú thích), vì dự án nghiệm thu bằng bằng chứng. Chú thích giúp bạn hiểu code, nhưng **không được coi là bằng chứng code đúng**.

### Bảng bằng chứng theo task

| Task | Antigravity nộp | Bạn tự chạy | Ca sai bắt buộc | Kỳ vọng do ai cung cấp |
| --- | --- | --- | --- | --- |
| T01, T01-FIX | Output `pnpm test`, `typecheck`, `lint`, `./mvnw test`; phản hồi thật của `/health`; ảnh app trên máy ảo; danh sách file; nhánh và commit | Chạy lại các lệnh trên máy mình; mở app | Cố ý làm một test đỏ, thấy lệnh báo đỏ, rồi hoàn lại | Không có |
| T02 | Output test validator | `pnpm test` | Ít nhất 8 ca sai: thiếu trường, sai giá trị liệt kê, đơn vị lạ... | Các ca mẫu hợp lệ lấy từ JSON mẫu trong kế hoạch |
| T03 | Output `validate-data` ở hai trường hợp: sạch và có lỗi; output test của script | Chạy script trên dữ liệu thật của bạn | Mỗi quy tắc kiểm tra có một món sai cố ý trong `fixtures/`; giá trị `MISSING` ở món `reviewed` phải bị từ chối | Nội dung món, nguyên liệu, dụng cụ: bạn |
| T04 | Output test; bảng kế hoạch của 3 món ở hai chế độ, kèm **lý do chọn từng bước** | **Tính tay kế hoạch trước, ghi vào `docs/expected/T04.md`,** rồi so với bảng | Vòng phụ thuộc bị từ chối; hai bước tranh dụng cụ; người dùng làm lệch thứ tự | Bạn hoặc Claude tính tay, có trước |
| T05 | Log nạp dữ liệu hai lần mở app; output test repo | Mở app hai lần, xem lần hai không nạp lại | Migration chạy lặp; cơ sở dữ liệu trống | Không có |
| T06 | Video đổi số phần và khai dị ứng; ảnh 3 màn hình | Tự đổi số phần 2 thành 4, tự khai dị ứng trứng | Món có mã dị ứng của người dùng biến mất khỏi danh sách | Lượng sau khi đổi số phần: bạn tính tay |
| T07 | Output test phiên mô phỏng 3 món; test phục hồi phiên | Không | Chặn bước an toàn khi chưa xác nhận; không cho hai phiên `cooking` cùng lúc | Không có |
| T08 | Video thông báo ở màn hình khóa, kèm giờ đặt và giờ kêu thực tế; `docs/timer-test-matrix.md` | **Tự thử trên máy Android thật, điền ma trận** | Từ chối quyền thông báo; vuốt tắt app; bật tiết kiệm pin; hết thời gian khi app đóng | Không có |
| T09 | Video nấu trọn một món; video phục hồi phiên; ảnh bước an toàn | **Tự nấu thật một món, tắt mạng** | Thoát giữa chừng rồi mở lại; làm lệch kế hoạch; bước an toàn chưa xác nhận | Không có |
| T10 | Output test; bảng đối chiếu số tính tay và số của app trên 5 món | **Tính tay 5 món trước, ghi vào `docs/expected/T10.md`** | Kho thiếu; nhiều lô khác hạn; gia vị "luôn có"; hoàn tác; làm tròn | Bạn tính tay, có trước |
| T11 | Video thêm 10 nguyên liệu có đồng hồ | **Tự thêm 10 nguyên liệu, bấm giờ** | Tên không tìm thấy; nhập trùng | Mức "một ít / vừa / nhiều": bạn |
| T12 | Output test; bảng xếp hạng cho 3 kho mẫu | **Dự đoán thứ hạng trước, ghi vào `docs/expected/T12.md`** | 20 kho ngẫu nhiên không bao giờ ra món có mã dị ứng; kho trống; món vượt thời gian | Thứ hạng dự đoán: bạn; trọng số: kế hoạch ("đề xuất") |
| T13 | Video luồng nấu, hoàn tất, sửa, hoàn tác | **Tự làm hết luồng** | Sửa về 0; hoàn tác hai lần | Không có |
| T14 | Output test; log khởi động thiếu biến môi trường | Chạy `./mvnw test`; khởi động thiếu biến | Thiếu biến thì thoát với thông báo rõ; vượt giới hạn trả `429` kèm `retry_after` | Không có |
| T15 | Output test với AI giả; bảng 10 câu hỏi và câu trả lời **nguyên văn** từ AI thật kèm chi phí từng lần | **Tự đọc 10 câu trả lời, đánh dấu câu sai** | Đầu ra sai schema; hết thời gian; câu trả lời chứa nhiệt độ bị chặn; bỏ nguyên liệu `preservation`; dị ứng; gợi ý ngoài bảng chuẩn | 10 câu hỏi: bạn; chi phí: số thật nhà cung cấp trả về |
| T16 | Output test; ảnh cảnh báo có hiển thị nguồn | Xem cảnh báo trên máy | Quy tắc còn `MISSING` thì chặn bắt đầu món | Nội dung và nguồn quy tắc: bạn, từ cơ quan chức năng |
| T17 | Video tắt mạng giữa lúc hỏi | **Tự tắt mạng giữa lúc hỏi** | Quá thời gian chờ; mất mạng; hẹn giờ vẫn kêu | Không có |
| T18 | Video 3 tình huống: bỏ hành lá, bỏ nguyên liệu bảo quản, khai dị ứng | **Tự thử cả 3** | Dị ứng thì không gợi ý chất đó | Mức cảnh báo mong đợi: bạn ghi trước |
| T19 | Bảng sự kiện thô; kết quả `docs/metrics.sql` | **Chạy 5 phiên, đếm tay, so với kết quả truy vấn** | Tắt đo lường thì không gửi gì | Số đếm tay: bạn |
| T20 | Đường dẫn bản build; ảnh app chạy trên máy thật; log gọi backend staging | **Tự cài APK lên máy thật, nấu trọn một món** | Danh sách quyền Android không có quyền thừa | Không có |
| T21 | Log từng bước trên máy ảo sạch; `/health` qua HTTPS hoặc cổng cục bộ; log khôi phục sao lưu | **Tự làm theo `docs/deploy-vps.md` từ đầu** | Khôi phục sao lưu; chạy lại migration | Không có |
| T22 | Đường dẫn hai lần chạy CI | Xem trang CI | Pull request cố ý làm đỏ test phải bị CI báo đỏ | Không có |
| T23 | Kết quả quét bí mật; log đổi server và di chuyển CSDL | **Tự đổi biến cấu hình, build lại, trỏ app sang server khác** | Còn khóa hoặc địa chỉ viết cứng thì phải bị phát hiện | Không có |

### Hai thứ bằng chứng không thấy được

- **Lỗ hổng bảo mật.** T23.1 quét bí mật chỉ bắt được một phần.
- **Tình huống không ai nghĩ ra để viết test.** Chỉ lộ ra khi thử kín với người thật (giai đoạn H).

