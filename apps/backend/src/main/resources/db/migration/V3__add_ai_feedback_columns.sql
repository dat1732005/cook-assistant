-- T20b: Bổ sung cột mã câu hỏi và loại phản hồi cho sự kiện phản hồi AI sai (ai_wrong_answer).
-- Tuyệt đối không tạo cột lưu nội dung câu hỏi hay câu trả lời của người dùng.
ALTER TABLE telemetry_event ADD COLUMN IF NOT EXISTS question_id VARCHAR(64);
ALTER TABLE telemetry_event ADD COLUMN IF NOT EXISTS feedback_type VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_question_id
    ON telemetry_event (question_id);

