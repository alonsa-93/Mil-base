-- Mil&Base Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('lohem','samal','rasap','mefaked','magad')),
  phone TEXT,
  unit_id BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Soldiers Table
CREATE TABLE IF NOT EXISTS soldiers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  serial_num INTEGER,
  personal_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lohem',
  status TEXT NOT NULL DEFAULT 'זמין' CHECK(status IN ('זמין','במשימה','מנוחה','חופשה','אחר')),
  phone TEXT,
  company TEXT,
  team TEXT,
  gender TEXT DEFAULT 'זכר' CHECK(gender IN ('זכר','נקבה','אחר')),
  civil_shirt TEXT,
  civil_pants TEXT,
  mil_shirt TEXT,
  mil_pants TEXT,
  mil_boots TEXT,
  is_vegan INTEGER DEFAULT 0,
  is_vegetarian INTEGER DEFAULT 0,
  lactose_intolerant INTEGER DEFAULT 0,
  gluten_free INTEGER DEFAULT 0,
  nutrition_notes TEXT,
  user_id BIGINT REFERENCES users(id),
  last_mission_end TEXT,
  total_guard_hours REAL DEFAULT 0,
  total_mission_hours REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Missions Table
CREATE TABLE IF NOT EXISTS missions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'מתוכנן' CHECK(status IN ('מתוכנן','פעיל','הסתיים','בוטל')),
  urgency TEXT NOT NULL DEFAULT 'רגיל' CHECK(urgency IN ('רגיל','דחוק','חירום')),
  type TEXT DEFAULT 'כללי',
  required_count INTEGER DEFAULT 1,
  vehicle TEXT,
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  mission_id BIGINT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  soldier_id BIGINT NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  role_in_mission TEXT DEFAULT 'לוחם',
  assigned_by BIGINT REFERENCES users(id),
  rest_warning INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(mission_id, soldier_id)
);

-- Equipment Items Table
CREATE TABLE IF NOT EXISTS equipment_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  min_required INTEGER DEFAULT 0,
  unit_of_measure TEXT DEFAULT 'יחידה',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Equipment Assignments Table
CREATE TABLE IF NOT EXISTS equipment_assignments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  soldier_id BIGINT NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES equipment_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'הונפק' CHECK(status IN ('הונפק','הוחזר')),
  issued_at TIMESTAMP DEFAULT NOW(),
  returned_at TIMESTAMP,
  issued_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Soldier Equipment (Personal Equipment Status)
CREATE TABLE IF NOT EXISTS soldier_equipment (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  soldier_id BIGINT NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing' CHECK(status IN ('missing','issued','returned')),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id),
  UNIQUE(soldier_id, item_type)
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT REFERENCES users(id),
  username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rations Requests Table
CREATE TABLE IF NOT EXISTS rations_requests (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK(meal_type IN ('ארוחת בוקר','ארוחת צהריים','ארוחת ערב')),
  total_count INTEGER,
  vegan_count INTEGER DEFAULT 0,
  vegetarian_count INTEGER DEFAULT 0,
  lactose_free_count INTEGER DEFAULT 0,
  gluten_free_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE soldiers;
ALTER PUBLICATION supabase_realtime ADD TABLE missions;
ALTER PUBLICATION supabase_realtime ADD TABLE assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE equipment_items;
ALTER PUBLICATION supabase_realtime ADD TABLE soldier_equipment;

-- Seed initial data
INSERT INTO users (username, password, full_name, role, phone) VALUES
('magad1', '$2a$10$2Y1RuCqN3CqVqC6vQ9Ey3OuCqN3CqVqC6vQ9Ey3Ou', 'אלוף יוסי כהן', 'magad', '050-1111111'),
('mefaked1', '$2a$10$2Y1RuCqN3CqVqC6vQ9Ey3OuCqN3CqVqC6vQ9Ey3Ou', 'סרן רוני לוי', 'mefaked', '050-2222222'),
('mefaked2', '$2a$10$2Y1RuCqN3CqVqC6vQ9Ey3OuCqN3CqVqC6vQ9Ey3Ou', 'סרן מיכל אבי', 'mefaked', '050-3333333'),
('rasap1', '$2a$10$2Y1RuCqN3CqVqC6vQ9Ey3OuCqN3CqVqC6vQ9Ey3Ou', 'סמ"ר דניאל גל', 'rasap', '050-4444444'),
('samal1', '$2a$10$2Y1RuCqN3CqVqC6vQ9Ey3OuCqN3CqVqC6vQ9Ey3Ou', 'טוראי שי כהן', 'samal', '050-5555555'),
('samal2', '$2a$10$2Y1RuCqN3CqVqC6vQ9Ey3OuCqN3CqVqC6vQ9Ey3Ou', 'טוראי נעמה שר', 'samal', '050-6666666'),
('lohem1', '$2a$10$2Y1RuCqN3CqVqC6vQ9Ey3OuCqN3CqVqC6vQ9Ey3Ou', 'טוראי אדם לוי', 'lohem', '050-7777771'),
('lohem2', '$2a$10$2Y1RuCqN3CqVqC6vQ9Ey3OuCqN3CqVqC6vQ9Ey3Ou', 'טוראי שרה מור', 'lohem', '050-7777772');

-- Insert soldiers (with bcrypt hash of '1234')
INSERT INTO soldiers (serial_num, personal_id, full_name, role, status, phone, company, team, gender, civil_shirt, civil_pants, mil_shirt, mil_pants, mil_boots) VALUES
(1, '1234567', 'אדם לוי', 'lohem', 'זמין', '050-7777771', 'א', '1', 'זכר', 'M', 'M', 'ב', 'ב', '42'),
(2, '2345678', 'שרה מור', 'lohem', 'זמין', '050-7777772', 'א', '1', 'נקבה', 'S', 'S', 'ק', 'ק', '38'),
(3, '3456789', 'בן דוד', 'lohem', 'זמין', '050-7777773', 'ב', '2', 'זכר', 'L', 'L', 'ג', 'ג', '44'),
(4, '4567890', 'רינה כץ', 'lohem', 'מנוחה', '050-7777774', 'ב', '2', 'נקבה', 'S', 'S', 'ק', 'ק', '38'),
(5, '5678901', 'אורי שם', 'lohem', 'חופשה', '050-7777775', 'ג', '3', 'זכר', 'XL', 'L', 'מ', 'מ', '45'),
(6, '6789012', 'דניאל גל', 'rasap', 'זמין', '050-4444444', 'א', '1', 'זכר', 'L', 'L', 'ב', 'ב', '43'),
(7, '7890123', 'שי כהן', 'samal', 'זמין', '050-5555555', 'ב', '2', 'זכר', 'M', 'M', 'ב', 'ב', '42'),
(8, '8901234', 'נעמה שר', 'samal', 'זמין', '050-6666666', 'ג', '3', 'נקבה', 'XS', 'XS', 'ק', 'ק', '36');

-- Insert equipment items
INSERT INTO equipment_items (name, category, total_quantity, available_quantity, min_required) VALUES
('קסדה', 'ציוד מגן', 10, 8, 8),
('אפוד', 'ציוד מגן', 10, 7, 8),
('נשק אישי', 'נשק', 10, 10, 8),
('מים (2L)', 'לוגיסטיקה', 50, 35, 30),
('רציה', 'תקשורת', 5, 4, 4),
('עזרה ראשונה', 'רפואה', 10, 9, 8);

-- Insert missions
INSERT INTO missions (title, description, location, start_time, end_time, status, urgency, type, required_count) VALUES
('שמירת בסיס', 'שמירה על שערי הבסיס', 'שער ראשי', NOW(), NOW() + INTERVAL '8 hours', 'מתוכנן', 'רגיל', 'שמירה', 2),
('סיור לילי', 'סיור בשטח מאובטח', 'שטח אימונים', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '10 hours', 'מתוכנן', 'דחוק', 'סיור', 3);
