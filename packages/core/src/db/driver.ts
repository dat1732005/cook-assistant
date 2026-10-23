/**
 * Giao diện trừu tượng hóa truy cập SQLite (Mục T05.1).
 * Giúp mã nghiệp vụ hoàn toàn độc lập với môi trường chạy (NodeSqliteDriver trên Node, ExpoSqliteDriver trên Mobile).
 */
export interface SqlDriver {
  /**
   * Thực thi câu lệnh SQL không trả kết quả (DML/DDL như CREATE, INSERT, UPDATE, DELETE).
   */
  execute(sql: string, params?: unknown[]): Promise<void>;

  /**
   * Truy vấn danh sách bản ghi.
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Truy vấn một bản ghi duy nhất (hoặc null nếu không tìm thấy).
   */
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;

  /**
   * Chạy một khối thao tác trong một giao dịch (transaction). Tự động rollback nếu có lỗi.
   */
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;

  /**
   * Đóng kết nối cơ sở dữ liệu.
   */
  close(): Promise<void>;
}
