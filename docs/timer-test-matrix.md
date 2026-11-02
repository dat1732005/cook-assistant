# Ma trận kiểm thử thông báo hẹn giờ trên Android (docs/timer-test-matrix.md)

*Tài liệu này dùng để ghi nhận kết quả kiểm thử thực tế của bộ hẹn giờ (TimerService) trên các dòng máy Android vật lý thật.*  
*Phần kết quả bên dưới **để trống cho chủ dự án điền sau khi thực nghiệm trên thiết bị thật**, Agent không tự điền.*

---

## 1. Thông tin 3 dòng máy Android thực nghiệm

| STT | Dòng máy / Model | Phiên bản Android | Giao diện tùy biến (OS Skin) | Trạng thái tối ưu pin |
| :-: | :--- | :--- | :--- | :--- |
| **Máy 1** | *(Ví dụ: Samsung Galaxy S23 / A54)* | Android *(13 / 14 / 15)* | OneUI *(5.x / 6.x)* | *(Đã tắt / Mặc định)* |
| **Máy 2** | *(Ví dụ: Xiaomi Redmi Note 12 / 13)* | Android *(13 / 14)* | MIUI / HyperOS | *(Đã bật Tự khởi chạy / Mặc định)* |
| **Máy 3** | *(Ví dụ: Google Pixel 7 / 8 hoặc Motorola)* | Android *(14 / 15)* | Android thuần (AOSP/Pixel) | *(Đã tắt / Mặc định)* |

---

## 2. Ma trận kết quả kiểm nghiệm (Chủ dự án điền)

*Ký hiệu điền:*  
- `[ĐẠT]`: Thông báo reo đúng giờ, có âm thanh và rung, bấm vào mở lại đúng phiên nấu.  
- `[TRỄ X giây]`: Thông báo có reo nhưng bị hệ điều hành hoãn trễ X giây.  
- `[MẤT]`: Không thấy thông báo nào xuất hiện.  

### Bảng kiểm tra tình huống thực tế:

| STT | Kịch bản kiểm thử | Thời lượng hẹn giờ | Máy 1 (Samsung)<br>*(Chủ dự án điền)* | Máy 2 (Xiaomi)<br>*(Chủ dự án điền)* | Máy 3 (Pixel/Khác)<br>*(Chủ dự án điền)* | Ghi chú & Hiện tượng thực tế |
| :-: | :--- | :-: | :---: | :---: | :---: | :--- |
| **KB-01** | **Màn hình sáng (Foreground):** App đang mở trực tiếp | 60 giây | [ ] | [ ] | [ ] | |
| **KB-02** | **Màn hình khóa (Screen Locked):** Khóa màn hình ngay sau khi bấm bắt đầu, để máy yên tĩnh | 120 giây | [ ] | [ ] | [ ] | |
| **KB-03** | **Chạy ngầm (Background):** Bấm Home về màn hình chính, mở lướt app khác (YouTube / Facebook) | 180 giây | [ ] | [ ] | [ ] | |
| **KB-04** | **Vuốt tắt app (App Swiped Away):** Mở trình đa nhiệm, vuốt tắt hẳn app Trợ lý nấu ăn | 120 giây | [ ] | [ ] | [ ] | *Kiểm tra thông báo hệ thống có xuất hiện không và bấm vào có phục hồi phiên không* |
| **KB-05** | **Bật chế độ tiết kiệm pin (Battery Saver ON):** Bật tiết kiệm pin trên máy trước khi hẹn giờ | 180 giây | [ ] | [ ] | [ ] | |
| **KB-06** | **Chế độ ngủ sâu (Doze Mode):** Khóa màn hình và không chạm vào máy trong hơn 20 phút | 300 giây (5 phút) | [ ] | [ ] | [ ] | |
| **KB-07** | **Nhiều hẹn giờ đồng thời:** 1 bước passive (300s) + 1 hẹn giờ tay (60s) | 60s & 300s | [ ] | [ ] | [ ] | *Kiểm tra đủ 2 thông báo độc lập* |

---

## 3. Hướng dẫn các bước thực hiện kiểm thử cho chủ dự án

1. **Chuẩn bị:** Cài đặt bản build di động (Android APK / Expo Go) lên máy.
2. **Cấp quyền:** Khi mở app lần đầu, đồng ý cấp quyền Thông báo (Notification Permission).
3. **Thực hiện từng kịch bản:**
   - Vào một món ăn có bước passive hoặc bấm nút "Hẹn giờ" tùy chọn.
   - Kích hoạt tình huống tương ứng (Khóa máy / Vuốt tắt app / Bật tiết kiệm pin).
   - Dùng đồng hồ bấm giờ bên ngoài để đo độ trễ thực tế.
4. **Điền kết quả:** Mở file này và điền trực tiếp vào các ô `[ ]` ở Bảng mục 2.
