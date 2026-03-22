CREATE TABLE IF NOT EXISTS aaa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode VARCHAR(50),
    box_code INTEGER,
    seq_num INTEGER
);

DELETE FROM aaa;
INSERT INTO aaa (barcode, box_code, seq_num) VALUES ('12345678', 101, 1);
INSERT INTO aaa (barcode, box_code, seq_num) VALUES ('87654321', 102, 2);
INSERT INTO aaa (barcode, box_code, seq_num) VALUES ('11223344', 103, 3);
