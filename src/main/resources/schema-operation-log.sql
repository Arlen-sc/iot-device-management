-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_log (
    id INTEGER PRIMARY KEY,
    operation_type VARCHAR(50),
    module VARCHAR(50),
    description TEXT,
    request_method VARCHAR(10),
    request_url VARCHAR(255),
    request_params TEXT,
    operator VARCHAR(50),
    ip_address VARCHAR(50),
    status INTEGER DEFAULT 1,
    error_message TEXT,
    execution_time BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
