/**
 * File: packages/core/src/index.ts
 * Mục đích: Điểm xuất chính (entrypoint) của gói thư viện @cook/core.
 * Nhận vào: Không có.
 * Trả ra: Toàn bộ kiểu dữ liệu, schema Zod, hàm quy đổi đơn vị và hàm kiểm định.
 * Ai gọi: Ứng dụng di động (apps/mobile), backend, và các công cụ dòng lệnh (scripts).
 * Bám theo: Mục T02 trong docs/tasks.md.
 */

// Xuất các enum và kiểu liệt kê cố định
export * from './enums.js';

// Xuất toàn bộ schema Zod và TypeScript types
export * from './schemas/index.js';

// Xuất bảng quy đổi đơn vị và các hàm tính toán đơn vị
export * from './units/index.js';

// Xuất các hàm kiểm định dữ liệu an toàn
export * from './validators/index.js';

/**
 * Hàm chào mẫu kiểm tra liên kết hệ thống (giữ lại từ T01 để tương thích ngược).
 *
 * Làm gì: Tạo chuỗi chào mừng kèm tên người dùng.
 * Vào: name (chuỗi tên).
 * Ra: Câu chào hoàn chỉnh.
 * Ví dụ: greet("Nam") -> "Chào Nam! Sẵn sàng nấu ăn."
 * Gọi bởi: Test mẫu T01, màn hình chào.
 */
export function greet(name: string): string {
  return `Chào ${name}! Sẵn sàng nấu ăn.`;
}
