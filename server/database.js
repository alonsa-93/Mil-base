import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const DB_PATH = './milbase.db';
let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

export const DEFAULT_EQUIPMENT_ITEMS = [
  { key:'weapon', label:'נשק אישי' },
  { key:'vest', label:'אפוד / ווסט' },
  { key:'helmet', label:'קסדה' },
  { key:'magazines', label:'5 מחסניות' },
  { key:'knee_pads', label:'ברכיות' },
  { key:'medical_kit', label:'חסם עורקים ותחבושת אישית' },
];

export function seedDefaultEquipment(soldierId) {
  const db = getDb();
  const stmt = db.prepare(`INSERT OR IGNORE INTO soldier_equipment (soldier_id, item_type, status) VALUES (?, ?, 'missing')`);
  DEFAULT_EQUIPMENT_ITEMS.forEach(({ key }) => stmt.run(soldierId, key));
}

export function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('lohem','samal','rasap','mefaked','magad')),
      phone TEXT,
      unit_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS soldiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      user_id INTEGER REFERENCES users(id),
      last_mission_end TEXT,
      total_guard_hours REAL DEFAULT 0,
      total_mission_hours REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'מתוכנן' CHECK(status IN ('מתוכנן','פעיל','הסתיים','בוטל')),
      urgency TEXT NOT NULL DEFAULT 'רגיל' CHECK(urgency IN ('רגיל','דחוק','חירום')),
      type TEXT DEFAULT 'כללי',
      required_count INTEGER DEFAULT 1,
      vehicle TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      soldier_id INTEGER NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
      role_in_mission TEXT DEFAULT 'לוחם',
      assigned_by INTEGER REFERENCES users(id),
      rest_warning INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(mission_id, soldier_id)
    );

    CREATE TABLE IF NOT EXISTS equipment_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      total_quantity INTEGER NOT NULL DEFAULT 0,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      min_required INTEGER DEFAULT 0,
      unit_of_measure TEXT DEFAULT 'יחידה',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS equipment_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      soldier_id INTEGER NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES equipment_items(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'הונפק' CHECK(status IN ('הונפק','הוחזר')),
      issued_at TEXT DEFAULT (datetime('now','localtime')),
      returned_at TEXT,
      issued_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS soldier_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      soldier_id INTEGER NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'missing' CHECK(status IN ('missing','issued','returned')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      updated_by INTEGER REFERENCES users(id),
      UNIQUE(soldier_id, item_type)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS rations_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL CHECK(meal_type IN ('ארוחת בוקר','ארוחת צהריים','ארוחת ערב')),
      total_count INTEGER,
      vegan_count INTEGER DEFAULT 0,
      vegetarian_count INTEGER DEFAULT 0,
      lactose_free_count INTEGER DEFAULT 0,
      gluten_free_count INTEGER DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migrations: add columns to existing DBs
  try {
    const cols = db.prepare("PRAGMA table_info(soldiers)").all().map(c => c.name);
    if (!cols.includes('serial_num')) db.exec('ALTER TABLE soldiers ADD COLUMN serial_num INTEGER');
    if (!cols.includes('gender')) db.exec(`ALTER TABLE soldiers ADD COLUMN gender TEXT DEFAULT 'זכר'`);
    if (!cols.includes('company')) db.exec('ALTER TABLE soldiers ADD COLUMN company TEXT');
    if (!cols.includes('mil_shirt')) db.exec('ALTER TABLE soldiers ADD COLUMN mil_shirt TEXT');
    if (!cols.includes('mil_pants')) db.exec('ALTER TABLE soldiers ADD COLUMN mil_pants TEXT');
  } catch (e) { console.warn('Migration note:', e.message); }

  const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (existing.cnt === 0) {
    const hash = bcrypt.hashSync('1234', 10);
    const users = [
      ['magad1', hash, 'אלוף יוסי כהן', 'magad', '050-1111111'],
      ['mefaked1', hash, 'סרן רוני לוי', 'mefaked', '050-2222222'],
      ['mefaked2', hash, 'סרן מיכל אבי', 'mefaked', '050-3333333'],
      ['rasap1', hash, 'סמ"ר דניאל גל', 'rasap', '050-4444444'],
      ['samal1', hash, 'טוראי שי כהן', 'samal', '050-5555555'],
      ['samal2', hash, 'טוראי נעמה שר', 'samal', '050-6666666'],
      ['lohem1', hash, 'טוראי אדם לוי', 'lohem', '050-7777771'],
      ['lohem2', hash, 'טוראי שרה מור', 'lohem', '050-7777772'],
      ['lohem3', hash, 'טוראי בן דוד', 'lohem', '050-7777773'],
      ['lohem4', hash, 'טוראי רינה כץ', 'lohem', '050-7777774'],
      ['lohem5', hash, 'טוראי אורי שם', 'lohem', '050-7777775'],
    ];
    const ins = db.prepare('INSERT INTO users (username,password,full_name,role,phone) VALUES (?,?,?,?,?)');
    users.forEach(u => ins.run(...u));

    const soldierSeed = [
      [1, '1234567', 'אדם לוי', 'lohem', 'זמין', '050-7777771', 'א', '1', 'זכר', 'M', 'M', 'ב', 'ב', '42'],
      [2, '2345678', 'שרה מור', 'lohem', 'זמין', '050-7777772', 'א', '1', 'נקבה', 'S', 'S', 'ק', 'ק', '38'],
      [3, '3456789', 'בן דוד', 'lohem', 'זמין', '050-7777773', 'ב', '2', 'זכר', 'L', 'L', 'ג', 'ג', '44'],
      [4, '4567890', 'רינה כץ', 'lohem', 'מנוחה', '050-7777774', 'ב', '2', 'נקבה', 'S', 'S', 'ק', 'ק', '38'],
      [5, '5678901', 'אורי שם', 'lohem', 'חופשה', '050-7777775', 'ג', '3', 'זכר', 'XL', 'L', 'מ', 'מ', '45'],
      [6, '6789012', 'דניאל גל', 'rasap', 'זמין', '050-4444444', 'א', '1', 'זכר', 'L', 'L', 'ב', 'ב', '43'],
      [7, '7890123', 'שי כהן', 'samal', 'זמין', '050-5555555', 'ב', '2', 'זכר', 'M', 'M', 'ב', 'ב', '42'],
      [8, '8901234', 'נעמה שר', 'samal', 'זמין', '050-6666666', 'ג', '3', 'נקבה', 'XS', 'XS', 'ק', 'ק', '36'],
    ];
    const insSoldier = db.prepare(`
      INSERT INTO soldiers (serial_num,personal_id,full_name,role,status,phone,company,team,gender,civil_shirt,civil_pants,mil_shirt,mil_pants,mil_boots)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    soldierSeed.forEach(s => {
      const res = insSoldier.run(...s);
      seedDefaultEquipment(res.lastInsertRowid);
    });

    const equip = [
      ['קסדה', 'ציוד מגן', 10, 8, 8],
      ['אפוד', 'ציוד מגן', 10, 7, 8],
      ['נשק אישי', 'נשק', 10, 10, 8],
      ['מים (2L)', 'לוגיסטיקה', 50, 35, 30],
      ['רציה', 'תקשורת', 5, 4, 4],
      ['עזרה ראשונה', 'רפואה', 10, 9, 8],
    ];
    const insEquip = db.prepare('INSERT INTO equipment_items (name,category,total_quantity,available_quantity,min_required) VALUES (?,?,?,?,?)');
    equip.forEach(e => insEquip.run(...e));

    const today = new Date().toISOString().slice(0, 10);
    const insMission = db.prepare(`
      INSERT INTO missions (title,description,location,start_time,end_time,status,urgency,type,required_count)
      VALUES (?,?,?,?,?,?,?,?,?)
    `);
    insMission.run('שמירת בסיס', 'שמירה על שערי הבסיס', 'שער ראשי', `${today} 20:00`, `${today} 04:00`, 'מתוכנן', 'רגיל', 'שמירה', 2);
    insMission.run('סיור לילי', 'סיור בשטח מאובטח', 'שטח אימונים', `${today} 22:00`, `${today} 06:00`, 'מתוכנן', 'דחוק', 'סיור', 3);
  } else {
    // Backfill default equipment for existing soldiers
    const existingSoldiers = db.prepare('SELECT id FROM soldiers').all();
    existingSoldiers.forEach(s => seedDefaultEquipment(s.id));
  }

  console.log('✅ Database initialized');
  return db;
}
