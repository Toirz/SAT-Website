-- ============================================
--  SCHEMA CHO SAT WEBSITE (PostgreSQL)
-- ============================================

-- (TÙY CHỌN) Nếu muốn xóa sạch mọi thứ rồi tạo lại, bỏ comment các dòng dưới:
-- DROP TABLE IF EXISTS user_activity CASCADE;
-- DROP TABLE IF EXISTS test_history CASCADE;
-- DROP TABLE IF EXISTS test_progress CASCADE;
-- DROP TABLE IF EXISTS devices CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- =======================
-- BẢNG USERS
-- =======================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  email VARCHAR(255),
  google_id VARCHAR(255)
);

-- =======================
-- BẢNG DEVICES
-- (quản lý thiết bị, duyệt thiết bị)
-- =======================
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token VARCHAR(255) NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at_vn VARCHAR(50),
  CONSTRAINT uq_devices_user_device UNIQUE (user_id, device_token)
);

-- =======================
-- BẢNG TEST_PROGRESS
-- (lưu trạng thái đang làm dở)
-- =======================
CREATE TABLE IF NOT EXISTS test_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_file VARCHAR(255) NOT NULL,
  answers TEXT,
  review_list TEXT,
  current_index INTEGER DEFAULT 0,
  remaining_time INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_test_progress_user_test UNIQUE (user_id, test_file)
);
ALTER TABLE test_progress
  ADD COLUMN IF NOT EXISTS highlights TEXT;
ALTER TABLE test_progress
  ADD COLUMN IF NOT EXISTS eliminated_choices TEXT;

-- =======================
-- BẢNG TEST_HISTORY
-- (lưu lịch sử mỗi lần nộp bài)
-- =======================
CREATE TABLE IF NOT EXISTS test_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_file VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  taken_at VARCHAR(50),
  answers_json TEXT NOT NULL
);

-- =======================
-- BẢNG USER_ACTIVITY
-- (heatmap: mỗi ngày giải bao nhiêu câu)
-- =======================
CREATE TABLE IF NOT EXISTS user_activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  problems_solved INTEGER NOT NULL,
  CONSTRAINT uq_user_activity_user_date UNIQUE (user_id, date)
);

-- =======================
-- (TÙY CHỌN) TẠO 1 ADMIN MẶC ĐỊNH
-- username: admin / password: admin123
-- =======================
INSERT INTO users (username, password, is_admin)
VALUES ('admin', 'admin123', 1)
ON CONFLICT (username) DO NOTHING;
