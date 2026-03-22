-- Device Category
CREATE TABLE IF NOT EXISTS device_category (
    id INTEGER PRIMARY KEY,
    parent_id INTEGER DEFAULT 0,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Device Model
CREATE TABLE IF NOT EXISTS device_model (
    id INTEGER PRIMARY KEY,
    category_id INTEGER,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    protocol_type VARCHAR(20),
    manufacturer VARCHAR(100),
    specs_json TEXT,
    status INTEGER DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Device
CREATE TABLE IF NOT EXISTS device (
    id INTEGER PRIMARY KEY,
    model_id INTEGER,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    status INTEGER DEFAULT 0, -- 0=offline,1=online,2=fault,3=maintenance
    protocol_type VARCHAR(20),
    connection_config TEXT,
    ip_address VARCHAR(50),
    port INTEGER,
    location VARCHAR(200),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Operation Type
CREATE TABLE IF NOT EXISTS operation_type (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE,
    protocol_type VARCHAR(20),
    param_schema TEXT,
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Task Flow Config
CREATE TABLE IF NOT EXISTS task_flow_config (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    flow_type VARCHAR(20) DEFAULT 'MIXED',
    trigger_type VARCHAR(20) DEFAULT 'ONCE',
    execution_mode VARCHAR(20) DEFAULT 'SERIAL',
    cron_expression VARCHAR(100),
    start_node_config TEXT,
    flow_json TEXT,
    status INTEGER DEFAULT 1,
    version INTEGER DEFAULT 1,
    last_execution_status VARCHAR(20),
    last_execution_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alert Config
CREATE TABLE IF NOT EXISTS alert_config (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    device_id INTEGER,
    condition_json TEXT,
    action_json TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alert Record
CREATE TABLE IF NOT EXISTS alert_record (
    id INTEGER PRIMARY KEY,
    alert_config_id INTEGER,
    device_id INTEGER,
    level VARCHAR(20),
    message TEXT,
    data_json TEXT,
    status INTEGER DEFAULT 0,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- Flow Execution Log
CREATE TABLE IF NOT EXISTS flow_execution_log (
    id INTEGER PRIMARY KEY,
    flow_config_id INTEGER,
    flow_name VARCHAR(200),
    event_id VARCHAR(100),
    node_id VARCHAR(100),
    node_name VARCHAR(200),
    action_type VARCHAR(50),
    level VARCHAR(20) DEFAULT 'INFO',
    message TEXT,
    data_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Data Bridge
CREATE TABLE IF NOT EXISTS data_bridge (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50),
    source_config TEXT,
    target_type VARCHAR(50),
    target_config TEXT,
    mapping_json TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Data Source
CREATE TABLE IF NOT EXISTS data_source (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    url TEXT NOT NULL,
    username VARCHAR(100),
    password VARCHAR(100),
    driver_class VARCHAR(200),
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data: Device Categories
INSERT OR IGNORE INTO device_category (code, name, sort_order, description) VALUES
    ('SENSORS', 'Sensors', 1, 'Environmental and industrial sensors'),
    ('CONTROLLERS', 'Controllers', 2, 'Industrial and home automation controllers'),
    ('GATEWAYS', 'Gateways', 3, 'Network gateways and protocol converters');

-- Seed Data: Device Models
INSERT OR IGNORE INTO device_model (category_id, name, code, protocol_type, manufacturer, specs_json, description) VALUES
    (1, 'Temperature Sensor', 'TEMP_SENSOR_MQTT', 'MQTT', 'SensorCorp', '{"range":"-40~125","unit":"celsius","accuracy":"0.1"}', 'MQTT-based temperature sensor with high accuracy'),
    (2, 'Relay Controller', 'RELAY_CTRL_HTTP', 'HTTP', 'ControlTech', '{"channels":4,"max_load":"10A","voltage":"220V"}', 'HTTP-controlled 4-channel relay module');

-- Seed Data: Devices
INSERT OR IGNORE INTO device (model_id, name, code, status, protocol_type, connection_config, ip_address, port, location, description) VALUES
    (1, 'Workshop Temp Sensor #1', 'DEV_TEMP_001', 1, 'MQTT', '{"broker":"tcp://localhost:1883","topic":"sensor/temp/001","clientId":"temp_001"}', '192.168.1.101', 1883, 'Workshop A - Zone 1', 'Primary temperature sensor in workshop A'),
    (1, 'Workshop Temp Sensor #2', 'DEV_TEMP_002', 0, 'MQTT', '{"broker":"tcp://localhost:1883","topic":"sensor/temp/002","clientId":"temp_002"}', '192.168.1.102', 1883, 'Workshop A - Zone 2', 'Secondary temperature sensor in workshop A'),
    (2, 'Main Relay Controller', 'DEV_RELAY_001', 1, 'HTTP', '{"baseUrl":"http://192.168.1.201:8081","apiKey":"relay_secret_key"}', '192.168.1.201', 8081, 'Control Room B', 'Main relay controller for lighting system');

-- Seed Data: Operation Types
INSERT OR IGNORE INTO operation_type (name, code, protocol_type, param_schema, description) VALUES
    ('Read Data', 'READ_DATA', 'MQTT', '{"topic":"string","qos":"integer"}', 'Read data from a device sensor'),
    ('Write Command', 'WRITE_COMMAND', 'MQTT', '{"topic":"string","payload":"string","qos":"integer"}', 'Send a command to a device'),
    ('Device Status', 'DEVICE_STATUS', 'HTTP', '{"endpoint":"string","method":"string"}', 'Query device online status');
