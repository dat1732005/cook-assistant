-- T19.2: Bảng lưu sự kiện đo lường ẩn danh theo lô từ app di động
CREATE TABLE IF NOT EXISTS telemetry_event (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL UNIQUE,
    device_hash VARCHAR(64) NOT NULL,
    session_id VARCHAR(64),
    event_type VARCHAR(64) NOT NULL,
    step_id VARCHAR(64),
    recipe_slug VARCHAR(128),
    ai_kind VARCHAR(32),
    helpful BOOLEAN,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_device_time
    ON telemetry_event (device_hash, occurred_at);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_type_session
    ON telemetry_event (event_type, session_id);

